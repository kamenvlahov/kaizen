'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const DEFAULT_BODY = `## Description

## Acceptance Criteria

## Subtasks

## Context

## Notes
`;

/**
 * Serialize a task object back to a .md file.
 * @param {string} tasksDir - Absolute path to tasks directory
 * @param {object} task - Task object (must have id)
 */
function writeTask(tasksDir, task) {
  const filePath = path.join(tasksDir, `${task.id}.md`);
  const frontmatter = buildFrontmatter(task);
  const body = task.body !== undefined ? task.body : DEFAULT_BODY;
  const content = matter.stringify(body, frontmatter);
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Apply a partial update to an existing task file.
 * Reads current file, merges fields, writes back.
 * @param {string} filePath - Absolute path to existing .md file
 * @param {object} updates - Fields to update (frontmatter + optionally body)
 */
function updateTask(filePath, updates) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: current, content: currentBody } = matter(raw);

  const newFrontmatter = buildFrontmatter({ ...current, ...updates });
  const newBody = updates.body !== undefined ? updates.body : currentBody;
  newFrontmatter.updated = new Date().toISOString();

  const content = matter.stringify(newBody, newFrontmatter);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Delete a task file.
 */
function deleteTask(filePath) {
  fs.unlinkSync(filePath);
}

function buildFrontmatter(task) {
  const fm = {
    id: task.id,
    title: task.title || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    created: task.created || new Date().toISOString(),
    updated: task.updated || new Date().toISOString(),
    assignee: task.assignee || 'unassigned',
  };

  if (Array.isArray(task.dependencies) && task.dependencies.length > 0) {
    fm.dependencies = task.dependencies;
  }
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    fm.tags = task.tags;
  }
  if (task.estimate) fm.estimate = task.estimate;
  if (task.branch) fm.branch = task.branch;

  return fm;
}

module.exports = { writeTask, updateTask, deleteTask, DEFAULT_BODY };
