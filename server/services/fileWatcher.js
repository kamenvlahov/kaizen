'use strict';

const path = require('path');
const chokidar = require('chokidar');
const { listProjects } = require('./projectManager');

let watcher = null;

/**
 * Start watching all registered project task directories.
 * Emits socket.io events when task files change.
 * @param {import('socket.io').Server} io
 */
function startWatcher(io) {
  const projects = listProjects();
  if (projects.length === 0) return;

  const watchPaths = projects.map(p =>
    path.join(__dirname, '../../', p.tasksDir, '*.md')
  );

  watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on('add', filePath => {
    const { projectName, taskId } = parsePath(filePath, projects);
    if (taskId) io.emit('task:created', { projectName, taskId, filePath });
  });

  watcher.on('change', filePath => {
    const { projectName, taskId } = parsePath(filePath, projects);
    if (taskId) io.emit('task:updated', { projectName, taskId, filePath });
  });

  watcher.on('unlink', filePath => {
    const { projectName, taskId } = parsePath(filePath, projects);
    if (taskId) io.emit('task:deleted', { projectName, taskId });
  });

  console.log(`Watching ${watchPaths.length} project task director${watchPaths.length === 1 ? 'y' : 'ies'}`);
}

/**
 * Add a new directory to the watcher at runtime (after kaizen init via API).
 */
function watchProject(io, project) {
  if (!watcher) {
    startWatcher(io);
    return;
  }
  const watchPath = path.join(__dirname, '../../', project.tasksDir, '*.md');
  watcher.add(watchPath);
}

function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

function parsePath(filePath, projects) {
  const basename = path.basename(filePath);
  const match = basename.match(/^(TASK-\d+)\.md$/i);
  if (!match) return {};

  const taskId = match[1].toUpperCase();
  const dir = path.dirname(filePath);

  const project = projects.find(p => {
    const tasksDir = path.resolve(__dirname, '../../', p.tasksDir);
    return path.resolve(dir) === tasksDir;
  });

  return { projectName: project ? project.name : null, taskId };
}

module.exports = { startWatcher, watchProject, stopWatcher };
