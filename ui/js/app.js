/* Main app — view routing, WebSocket, orchestration */
(async () => {
  const kanbanMount = document.getElementById('kanban-mount');
  const listMount   = document.getElementById('list-mount');
  let activeView = 'kanban';
  let activeProject = null;

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

  // ── Project switcher ─────────────────────────────────────────────────────────
  ProjectSwitcher.init(
    document.getElementById('project-switcher-mount'),
    async project => {
      activeProject = project;
      // Hide settings, show normal views
      document.getElementById('settings-mount').style.display = 'none';
      kanbanMount.style.display = activeView === 'kanban' ? '' : 'none';
      listMount.style.display   = activeView === 'list'   ? '' : 'none';
      // Notify WebSocket server
      if (window._socket) window._socket.emit('project:changed', { name: project.name });
      await Kanban.setProject(project);
      await ListView.setProject(project);
    }
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
