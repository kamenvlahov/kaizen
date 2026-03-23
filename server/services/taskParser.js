'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const VALID_STATUSES = ['todo', 'in-progress', 'review', 'done', 'blocked'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_ASSIGNEES = ['claude-code', 'human', 'unassigned'];

/**
 * Parse a single task .md file into a task object.
 * @param {string} filePath - Absolute path to the .md file
 * @returns {object} Task object with frontmatter fields + body sections
 */
function parseTask(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  return {
    id: frontmatter.id || path.basename(filePath, '.md'),
    title: frontmatter.title || '',
    status: frontmatter.status || 'todo',
    priority: frontmatter.priority || 'medium',
    created: frontmatter.created || null,
    updated: frontmatter.updated || null,
    assignee: frontmatter.assignee || 'unassigned',
    dependencies: frontmatter.dependencies || [],
    tags: frontmatter.tags || [],
    estimate: frontmatter.estimate || null,
    branch: frontmatter.branch || null,
    body: content.trim(),
    filePath,
  };
}

/**
 * Parse all tasks in a directory.
 * @param {string} tasksDir - Absolute path to tasks directory
 * @returns {object[]} Array of task objects, sorted by ID
 */
function parseAllTasks(tasksDir) {
  if (!fs.existsSync(tasksDir)) return [];

  const files = fs.readdirSync(tasksDir)
    .filter(f => /^TASK-\d+\.md$/i.test(f))
    .sort();

  return files.map(f => parseTask(path.join(tasksDir, f)));
}

/**
 * Validate task fields. Returns array of error strings (empty = valid).
 */
function validateTask(task) {
  const errors = [];
  if (!task.title || !task.title.trim()) errors.push('title is required');
  if (task.status && !VALID_STATUSES.includes(task.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (task.priority && !VALID_PRIORITIES.includes(task.priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (task.assignee && !VALID_ASSIGNEES.includes(task.assignee)) {
    errors.push(`assignee must be one of: ${VALID_ASSIGNEES.join(', ')}`);
  }
  return errors;
}

module.exports = { parseTask, parseAllTasks, validateTask, VALID_STATUSES, VALID_PRIORITIES, VALID_ASSIGNEES };
