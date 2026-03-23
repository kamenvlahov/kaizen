'use strict';

const express = require('express');
const path = require('path');
const router = express.Router({ mergeParams: true });

const { getProject, getTasksDir } = require('../services/projectManager');
const { parseAllTasks, VALID_STATUSES } = require('../services/taskParser');
const { updateTask } = require('../services/taskWriter');

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function requireProject(req, res, next) {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: `Project "${req.params.name}" not found` });
  req.tasksDir = getTasksDir(project.name);
  next();
}

// GET /api/projects/:name/board
// Returns tasks grouped by status, sorted by priority within each column
router.get('/', requireProject, (req, res) => {
  const tasks = parseAllTasks(req.tasksDir);

  const board = {};
  for (const status of VALID_STATUSES) board[status] = [];

  for (const task of tasks) {
    const col = board[task.status] || board['todo'];
    col.push(task);
  }

  for (const col of Object.values(board)) {
    col.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  }

  res.json(board);
});

// PATCH /api/projects/:name/board/move  { taskId, newStatus }
router.patch('/move', requireProject, (req, res) => {
  const { taskId, newStatus } = req.body;

  if (!taskId) return res.status(400).json({ error: '"taskId" is required' });
  if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: `"newStatus" must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const filePath = path.join(req.tasksDir, `${taskId.toUpperCase()}.md`);
  try {
    updateTask(filePath, { status: newStatus });
    res.json({ taskId: taskId.toUpperCase(), status: newStatus });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
