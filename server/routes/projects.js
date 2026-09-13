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

// How long to watch a freshly spawned terminal before calling the launch good.
// A working launch keeps running, so anything that exits inside this window
// failed to start; anything still alive after it is treated as success.
const LAUNCH_SETTLE_MS = 2000;

// WSL2's interop channel to the Windows host times out intermittently. It shows
// up as this message on stderr and the terminal never appears. A retry usually
// lands, so it is worth one before giving up.
const INTEROP_ERROR = /UtilAcceptVsock|accept4 failed|failed to (?:launch|start) interop/i;

const MAX_LAUNCH_ATTEMPTS = 2;

/**
 * Spawn the terminal once and wait long enough to see whether it survived.
 * Resolves { ok: true } when the process is still running after the settle
 * window, otherwise { ok: false, reason, transient } describing the failure.
 */
function launchTerminal(wtExe, args) {
  return new Promise(resolve => {
    let child;
    try {
      // stderr is piped rather than ignored — it carries the interop error that
      // explains an otherwise silent failure.
      child = spawn(wtExe, args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      return resolve({ ok: false, reason: err.message, transient: false });
    }

    let stderr = '';
    let settled = false;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => { stderr += chunk; });
    }

    child.on('error', err => {
      finish({
        ok: false,
        reason: err.code === 'ENOENT' ? `Terminal executable not found: ${wtExe}` : err.message,
        transient: false,
      });
    });

    child.on('exit', code => {
      if (code === 0) return finish({ ok: true });
      const detail = stderr.trim().split('\n').pop() || `exit code ${code}`;
      finish({ ok: false, reason: detail, transient: INTEROP_ERROR.test(stderr) });
    });

    // Still alive after the settle window — the terminal is up.
    const timer = setTimeout(() => {
      child.unref();
      finish({ ok: true });
    }, LAUNCH_SETTLE_MS);
  });
}

// POST /api/projects/:name/start-claude
router.post('/:name/start-claude', async (req, res) => {
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
  const args = ['new-tab', '--startingDirectory', uncPath, '--', 'bash', '-lc', `cd "${projectPath}" && source ~/.nvm/nvm.sh && claude "провери задачите си"`];

  let last = null;
  for (let attempt = 1; attempt <= MAX_LAUNCH_ATTEMPTS; attempt++) {
    last = await launchTerminal(wtExe, args);
    if (last.ok) {
      if (attempt > 1) console.log(`[start-claude] launched on attempt ${attempt}`);
      return res.json({ success: true, attempts: attempt });
    }
    console.error(`[start-claude] attempt ${attempt} failed: ${last.reason}`);
    if (!last.transient) break;
  }

  const message = last.transient
    ? 'WSL interop timed out — the terminal did not start. Retrying often works; if it keeps failing, run "wsl --shutdown" from Windows and reopen WSL.'
    : `Could not start the terminal: ${last.reason}`;

  res.status(502).json({ error: message, detail: last.reason });
});

module.exports = router;
