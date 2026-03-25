'use strict';

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const {
  listProjects,
  getProject,
  registerProject,
  unregisterProject,
  updateGitConfig,
  getTasksDir,
} = require('../services/projectManager');
const { parseAllTasks } = require('../services/taskParser');
const gitService = require('../services/gitService');

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

// GET /api/projects/:name/git-config
router.get('/:name/git-config', (req, res) => {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const remoteUrl = gitService.getRemoteUrl(project.path);
  const detectedPlatform = gitService.detectPlatform(remoteUrl);

  const git = project.git || {};
  const token = git.token || '';
  const maskedToken = token ? '●'.repeat(Math.max(0, token.length - 4)) + token.slice(-4) : '';

  res.json({
    enabled: git.enabled || false,
    platform: git.platform || 'auto-detect',
    token: maskedToken,
    baseBranch: git.baseBranch || 'main',
    reviewer: git.reviewer || '',
    remoteUrl: remoteUrl || '',
    detectedPlatform: detectedPlatform || null,
  });
});

// PUT /api/projects/:name/git-config
router.put('/:name/git-config', (req, res) => {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { enabled, platform, token, baseBranch, reviewer } = req.body;
  const existing = project.git || {};

  const newGit = {
    enabled: !!enabled,
    platform: platform || 'auto-detect',
    baseBranch: baseBranch || 'main',
    reviewer: reviewer || '',
    remoteUrl: existing.remoteUrl || gitService.getRemoteUrl(project.path) || '',
  };

  // Only update token if user sent a real (non-masked) value
  if (token && !token.startsWith('●')) {
    newGit.token = token;
  } else {
    newGit.token = existing.token || '';
  }

  try {
    updateGitConfig(req.params.name, newGit);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/projects/:name/git-test
router.post('/:name/git-test', async (req, res) => {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const git = project.git || {};
  let platform = git.platform;

  if (!platform || platform === 'auto-detect') {
    const remoteUrl = gitService.getRemoteUrl(project.path);
    platform = gitService.detectPlatform(remoteUrl);
  }

  if (!platform) return res.json({ success: false, error: 'Could not detect platform. Set it manually.' });
  if (!git.token) return res.json({ success: false, error: 'No token configured' });

  const result = await gitService.testConnection(platform, git.token);
  res.json(result);
});

// POST /api/projects/:name/start-claude
router.post('/:name/start-claude', (req, res) => {
  const project = getProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const projectPath = project.path;
  if (!projectPath || !fs.existsSync(projectPath)) {
    return res.status(400).json({ error: 'Project path does not exist' });
  }

  // Convert Linux path to UNC path for WSL2: /home/user/... -> \\wsl$\Ubuntu\home\user\...
  const wslDistro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
  const wtExe = process.env.WT_EXE || 'wt.exe';
  const uncPath = `\\\\wsl$\\${wslDistro}${projectPath.replace(/\//g, '\\')}`;
  try {
    const child = spawn(wtExe, ['new-tab', '--startingDirectory', uncPath, '--', 'bash', '-lc', `cd "${projectPath}" && source ~/.nvm/nvm.sh && echo "провери задачите си" | claude`], {
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (err) => {
      console.error(`[start-claude] spawn error: ${err.message} (code: ${err.code}, path: ${wtExe})`);
    });

    child.unref();
    res.json({ success: true });
  } catch (err) {
    console.error(`[start-claude] failed to spawn: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
