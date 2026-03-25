'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { readConfig } = require('./services/projectManager');
const { startWatcher, watchProject } = require('./services/fileWatcher');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../ui')));

// ── API Routes ────────────────────────────────────────────────────────────────
const projectsRouter = require('./routes/projects');
const tasksRouter    = require('./routes/tasks');
const boardRouter    = require('./routes/board');
const browseRouter   = require('./routes/browse');
const aiRouter       = require('./routes/ai');

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:name/tasks', tasksRouter);
app.use('/api/projects/:name/board', boardRouter);
app.use('/api/browse', browseRouter);
app.use('/api/ai', aiRouter);

// Expose io so routes can call watchProject after POST /api/projects
app.set('io', io);
app.set('watchProject', watchProject);

// Patch projects router to start watching newly registered projects
const origPost = projectsRouter.stack.find(l => l.route && l.route.methods.post);
// Wrap the POST /api/projects handler to call watchProject
app.post('/api/projects', (req, res, next) => {
  const oldJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 201 && body && body.name) {
      watchProject(io, body);
    }
    return oldJson(body);
  };
  next();
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  // Client can notify server which project is active (for future targeted events)
  socket.on('project:changed', ({ name }) => {
    socket.data.activeProject = name;
  });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../ui/index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const config = readConfig();
const PORT = config.port || 3000;

server.listen(PORT, () => {
  console.log(`Kaizen running at http://localhost:${PORT}`);
  startWatcher(io);
});
