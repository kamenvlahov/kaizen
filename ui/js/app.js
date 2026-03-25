/* Main app — view routing, WebSocket, orchestration */
(async () => {
  const kanbanMount   = document.getElementById('kanban-mount');
  const listMount     = document.getElementById('list-mount');
  const settingsMount = document.getElementById('settings-mount');
  let activeView = 'kanban';
  let activeProject = null;

  // ── Helpers to show/hide views ───────────────────────────────────────────────
  function showNormalViews() {
    settingsMount.style.display = 'none';
    kanbanMount.style.display   = activeView === 'kanban' ? '' : 'none';
    listMount.style.display     = activeView === 'list'   ? '' : 'none';
  }

  function showSettingsView(project) {
    kanbanMount.style.display = 'none';
    listMount.style.display   = 'none';
    ProjectSettings.open(project, showNormalViews);
  }

  // ── View switching ───────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeView = btn.dataset.view;
      kanbanMount.style.display = activeView === 'kanban' ? '' : 'none';
      listMount.style.display   = activeView === 'list'   ? '' : 'none';
      if (activeProject) {
        if (activeView === 'kanban') Kanban.setProject(activeProject);
        else ListView.setProject(activeProject);
      }
    });
  });

  // ── Start Claude button ───────────────────────────────────────────────────────
  const startClaudeBtn = document.getElementById('start-claude-btn');

  function updateStartClaudeBtn(project) {
    if (project && project.path) {
      startClaudeBtn.style.display = '';
      startClaudeBtn.disabled = false;
    } else {
      startClaudeBtn.style.display = 'none';
    }
  }

  startClaudeBtn.addEventListener('click', async () => {
    if (!activeProject) return;
    startClaudeBtn.disabled = true;
    startClaudeBtn.textContent = 'Starting…';
    try {
      await API.startClaude(activeProject.name);
      startClaudeBtn.textContent = '✓ Claude started';
      setTimeout(() => {
        startClaudeBtn.textContent = '▶ Start Claude';
        startClaudeBtn.disabled = false;
      }, 2000);
    } catch (err) {
      startClaudeBtn.textContent = '✗ ' + err.message;
      setTimeout(() => {
        startClaudeBtn.textContent = '▶ Start Claude';
        startClaudeBtn.disabled = false;
      }, 3000);
    }
  });

  // ── Project switcher ─────────────────────────────────────────────────────────
  ProjectSwitcher.init(
    document.getElementById('project-switcher-mount'),
    async project => {
      activeProject = project;
      updateStartClaudeBtn(project);
      showNormalViews();
      // Notify WebSocket server
      if (window._socket) window._socket.emit('project:changed', { name: project.name });
      await Kanban.setProject(project);
      await ListView.setProject(project);
    },
    showSettingsView
  );

  // ── Kanban & List init ───────────────────────────────────────────────────────
  Kanban.init(taskId => {
    if (activeProject) {
      TaskDetail.open(activeProject, taskId, null, () => {
        Kanban.reload();
        ListView.reload();
        ProjectSwitcher.reload();
      });
    }
  });

  ListView.init(taskId => {
    if (activeProject) {
      TaskDetail.open(activeProject, taskId, null, () => {
        Kanban.reload();
        ListView.reload();
        ProjectSwitcher.reload();
      });
    }
  });

  // ── New Task button ──────────────────────────────────────────────────────────
  document.getElementById('new-task-btn').addEventListener('click', () => {
    if (!activeProject) return alert('Select a project first.');
    TaskCreateModal.open(activeProject, () => {
      Kanban.reload();
      ListView.reload();
      ProjectSwitcher.reload();
    });
  });

  // ── WebSocket ────────────────────────────────────────────────────────────────
  const wsIndicator = document.getElementById('ws-indicator');

  // socket.io is served by the server at /socket.io/socket.io.js
  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = () => {
    const socket = io();
    window._socket = socket;

    socket.on('connect', () => {
      wsIndicator.className = 'ws-dot connected';
      wsIndicator.title = 'WebSocket connected';
      if (activeProject) socket.emit('project:changed', { name: activeProject.name });
    });

    socket.on('disconnect', () => {
      wsIndicator.className = 'ws-dot disconnected';
      wsIndicator.title = 'WebSocket disconnected';
    });

    function refresh(data) {
      if (!activeProject) return;
      if (data.projectName && data.projectName !== activeProject.name) return;
      Kanban.reload();
      ListView.reload();
      ProjectSwitcher.reload();
    }

    socket.on('task:created', refresh);
    socket.on('task:updated', refresh);
    socket.on('task:deleted', refresh);
  };
  document.head.appendChild(script);
})();
