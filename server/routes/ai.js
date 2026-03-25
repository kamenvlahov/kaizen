'use strict';

const express = require('express');
const router = express.Router();

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `You are a task refinement assistant for software development teams using AI coding assistants.

Given a task title and description, produce a refined, well-structured task optimized for AI coding assistant execution (e.g. Claude Code).

Rules:
- Make the task atomic and actionable
- Surface all implied subtasks
- Be specific about files, functions, or modules involved when inferable
- Suggest relevant skills or context the AI assistant will need

Respond ONLY with valid JSON in this exact shape, no markdown fences:
{
  "refinedTitle": "string",
  "refinedDescription": "string",
  "subtasks": ["string"],
  "suggestedSkills": ["string"]
}`;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// GET /api/ai/models — list available Ollama models
router.get('/models', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`, {}, 5000);
    if (!response.ok) {
      return res.status(502).json({ error: 'Ollama returned an error', status: response.status });
    }
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    return res.json({ models, default: DEFAULT_MODEL });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Ollama is not running or unreachable (timeout)' });
    }
    return res.status(503).json({ error: 'Ollama is not running or unreachable', detail: err.message });
  }
});

// POST /api/ai/refine-task — refine a task using Ollama
router.post('/refine-task', async (req, res) => {
  const { title, description, type } = req.body || {};

  if (!title && !description) {
    return res.status(400).json({ error: 'At least one of title or description is required' });
  }

  const model = req.body.model || DEFAULT_MODEL;
  const userContent = [
    type ? `Task type: ${type}` : null,
    title ? `Title: ${title}` : null,
    description ? `Description:\n${description}` : null,
  ].filter(Boolean).join('\n\n');

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    stream: false,
  };

  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_BASE}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'Ollama returned an error', status: response.status, detail: text });
    }

    const data = await response.json();
    const content = data?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response if model added extra text
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return res.status(502).json({ error: 'Ollama response was not valid JSON', raw: content });
        }
      } else {
        return res.status(502).json({ error: 'Ollama response was not valid JSON', raw: content });
      }
    }

    return res.json({
      refinedTitle: parsed.refinedTitle || title || '',
      refinedDescription: parsed.refinedDescription || description || '',
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
      suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills : [],
      model,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Ollama request timed out after 30s' });
    }
    return res.status(503).json({ error: 'Ollama is not running or unreachable', detail: err.message });
  }
});

module.exports = router;
