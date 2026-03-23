'use strict';

const express = require('express');
const router = express.Router();
const {
  listProjects,
  getProject,
  registerProject,
  unregisterProject,
  getTasksDir,
} = require('../services/projectManager');
const { parseAllTasks } = require('../services/taskParser');

// GET /api/projects
router.get('/', (req, res) => {
  const projects = listProjects();
  res.json(projects);
});

// GET /api/projects/:name
router.get('/:name', (req, res) => {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasksDir = getTasksDir(project.name);
  const tasks = parseAllTasks(tasksDir);

  const stats = { total: tasks.length, byStatus: {}, byPriority: {} };
  for (const t of tasks) {
    stats.byStatus[t.status] = (stats.byStatus[t.status] || 0) + 1;
    stats.byPriority[t.priority] = (stats.byPriority[t.priority] || 0) + 1;
  }

  res.json({ ...project, stats });
});

// POST /api/projects  { name, path }
router.post('/', (req, res) => {
  const { name, path: projectPath } = req.body;
  if (!name || !projectPath) {
    return res.status(400).json({ error: '"name" and "path" are required' });
  }
  try {
    registerProject(name, projectPath);
    res.status(201).json(getProject(name));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/projects/:name
router.delete('/:name', (req, res) => {
  try {
    unregisterProject(req.params.name);
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
