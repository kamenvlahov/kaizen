'use strict';

const express = require('express');
const path = require('path');
const router = express.Router({ mergeParams: true });

const { getProject, getTasksDir } = require('../services/projectManager');
const { parseTask, parseAllTasks, validateTask, VALID_STATUSES } = require('../services/taskParser');
const { writeTask, updateTask, deleteTask } = require('../services/taskWriter');
const { nextId } = require('../utils/idGenerator');

function requireProject(req, res, next) {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: `Project "${req.params.name}" not found` });
  req.project = project;
  req.tasksDir = getTasksDir(project.name);
  next();
}

function taskFilePath(tasksDir, taskId) {
  return path.join(tasksDir, `${taskId.toUpperCase()}.md`);
}

// GET /api/projects/:name/tasks
router.get('/', requireProject, (req, res) => {
  let tasks = parseAllTasks(req.tasksDir);

  const { status, priority, tag, assignee } = req.query;
  if (status)   tasks = tasks.filter(t => t.status === status);
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (assignee) tasks = tasks.filter(t => t.assignee === assignee);
  if (tag)      tasks = tasks.filter(t => t.tags && t.tags.includes(tag));

  res.json(tasks);
});

// GET /api/projects/:name/tasks/:id
router.get('/:id', requireProject, (req, res) => {
  try {
    const task = parseTask(taskFilePath(req.tasksDir, req.params.id));
    res.json(task);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:name/tasks
router.post('/', requireProject, (req, res) => {
  const data = req.body;
  const errors = validateTask(data);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const id = nextId(req.tasksDir);
  const now = new Date().toISOString();

  const task = {
    id,
    title: data.title,
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    created: now,
    updated: now,
    assignee: data.assignee || 'unassigned',
    dependencies: data.dependencies || [],
    tags: data.tags || [],
    estimate: data.estimate || null,
    branch: data.branch || null,
    body: data.body || '',
  };

  writeTask(req.tasksDir, task);
  res.status(201).json(task);
});

// PUT /api/projects/:name/tasks/:id  (full replace)
router.put('/:id', requireProject, (req, res) => {
  const filePath = taskFilePath(req.tasksDir, req.params.id);
  try {
    parseTask(filePath); // verify exists
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
  }

  const errors = validateTask(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  updateTask(filePath, req.body);
  res.json(parseTask(filePath));
});

// PATCH /api/projects/:name/tasks/:id  (partial update)
router.patch('/:id', requireProject, (req, res) => {
  const filePath = taskFilePath(req.tasksDir, req.params.id);
  try {
    parseTask(filePath); // verify exists
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
  }

  if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: `Invalid status: ${req.body.status}` });
  }

  updateTask(filePath, req.body);
  res.json(parseTask(filePath));
});

// DELETE /api/projects/:name/tasks/:id
router.delete('/:id', requireProject, (req, res) => {
  const filePath = taskFilePath(req.tasksDir, req.params.id);
  try {
    deleteTask(filePath);
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
