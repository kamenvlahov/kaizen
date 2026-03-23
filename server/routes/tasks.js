'use strict';

const express = require('express');
const path = require('path');
const router = express.Router({ mergeParams: true });

const { getProject, getTasksDir } = require('../services/projectManager');
const { parseTask, parseAllTasks, validateTask, VALID_STATUSES } = require('../services/taskParser');
const { writeTask, updateTask, deleteTask } = require('../services/taskWriter');
const { nextId } = require('../utils/idGenerator');
const gitService = require('../services/gitService');

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
  let task;
  try {
    task = parseTask(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
  }

  const newStatus = req.body.status;
  if (newStatus && !VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status: ${newStatus}` });
  }

  updateTask(filePath, req.body);
  res.json(parseTask(filePath));

  // Git integration (async, non-blocking — file watcher broadcasts any task updates)
  if (newStatus && newStatus !== task.status) {
    const project = req.project;
    if (project && project.git && project.git.enabled) {
      const taskId = req.params.id.toUpperCase();
      if (newStatus === 'in-progress') {
        setImmediate(() => {
          const result = gitService.createBranch(project.path, taskId, project.git.baseBranch);
          if (result.success) {
            updateTask(filePath, { branch: result.branch });
          } else {
            console.warn(`[git] Branch creation failed for ${taskId}: ${result.error}`);
          }
        });
      } else if (newStatus === 'review') {
        setImmediate(async () => {
          try {
            const current = parseTask(filePath);
            const result = await gitService.pushAndCreateMR(project, taskId, current.title, current.body);
            if (result.success) {
              updateTask(filePath, { mr_url: result.mrUrl });
            } else {
              console.warn(`[git] MR creation failed for ${taskId}: ${result.error}`);
            }
          } catch (err) {
            console.warn(`[git] Unexpected error for ${taskId}: ${err.message}`);
          }
        });
      }
    }
  }
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
