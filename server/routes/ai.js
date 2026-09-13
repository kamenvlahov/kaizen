'use strict';

const express = require('express');
const router = express.Router();

const projectContext = require('../services/projectContext');

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
- Where the task leaves a decision genuinely unspecified, put that decision in "openQuestions" instead of quietly inventing an answer. Scope, trigger conditions, where something is surfaced to the user, and limits nobody stated are the usual gaps. Inventing a plausible answer to one of these is a failure, not a refinement.
- Do not ask what the project context already answers, and do not ask the reader to confirm a choice you already made. Ask at most 3, each answerable in one line. Nothing genuinely unresolved means an empty list.

When a "Project Context" section is provided, ground the refinement in it:
- Name real files, directories and modules from the project structure — never invent paths
- Follow the conventions and constraints stated in the project's CLAUDE.md
- Match the actual tech stack from package.json. Never name a framework, library or language feature that does not appear in the dependencies or the file tree — in particular, do not assume React, Vue, TypeScript or JSX unless they are listed
- Check the existing tasks and do not restate work already covered by another task; reference sibling tasks by ID when relevant
- Draw suggested skills only from technologies that appear in the provided context

Before answering, re-read the dependency list in the context. Every technology you name in "suggestedSkills" must appear there or in the file tree.

Respond ONLY with valid JSON in this exact shape, no markdown fences:
{
  "refinedTitle": "string",
  "refinedDescription": "string",
  "subtasks": ["string"],
  "suggestedSkills": ["string"],
  "openQuestions": ["string"]
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
  const { title, description, type, project } = req.body || {};

  if (!title && !description) {
    return res.status(400).json({ error: 'At least one of title or description is required' });
  }

  const model = req.body.model || DEFAULT_MODEL;

  // Optional: ground the refinement in the target project. Never fatal — an
  // unregistered or unreadable project just yields no context.
  const context = projectContext.build(project);

  const userContent = [
    context ? `## Project Context\n\n${context.text}` : null,
    context ? '## Task to refine' : null,
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
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.slice(0, 3) : [],
      model,
      contextUsed: context ? context.sources : [],
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Ollama request timed out after 30s' });
    }
    return res.status(503).json({ error: 'Ollama is not running or unreachable', detail: err.message });
  }
});

module.exports = router;
