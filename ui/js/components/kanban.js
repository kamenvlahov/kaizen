/* Kanban board with drag & drop */
const Kanban = (() => {
  const COLUMNS = [
    { status: 'backlog',     label: 'Backlog' },
    { status: 'todo',        label: 'Todo' },
    { status: 'in-progress', label: 'In Progress' },
    { status: 'review',      label: 'Review' },
    { status: 'done',        label: 'Done' },
    { status: 'blocked',     label: 'Blocked' },
  ];

  let currentProject = null;
  let board = {};
  let onCardClick = null;
  let draggedId = null;
  let draggedProject = null;

  function priorityBadge(p) {
    return `<span class="card-priority-badge priority-${p}">${p}</span>`;
  }

  function tagChips(tags) {
    return (tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
  }

  function cardHtml(task) {
    return `
      <div class="task-card" data-id="${task.id}" data-priority="${task.priority}"
           draggable="true">
        <div class="card-header">
          <span class="card-id">${task.id}</span>
          ${priorityBadge(task.priority)}
        </div>
        <div class="card-title">${escHtml(task.title)}</div>
        <div class="card-footer">
          <span class="card-assignee">${task.assignee}</span>
          ${tagChips(task.tags)}
        </div>
      </div>`;
  }

  function colHtml(col) {
    const tasks = board[col.status] || [];
    return `
      <div class="kanban-col" data-status="${col.status}">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${col.label}</span>
          <span class="kanban-col-count">${tasks.length}</span>
        </div>
        <div class="kanban-col-body" data-status="${col.status}">
          ${tasks.map(cardHtml).join('')}
        </div>
      </div>`;
  }

  function render(container) {
    if (!currentProject) {
      container.innerHTML = `<div class="empty-state"><p>No project selected.</p></div>`;
      return;
    }
    container.innerHTML = COLUMNS.map(colHtml).join('');
    bindEvents(container);
  }

  function bindEvents(container) {
    // Card click → detail
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => {
        if (onCardClick) onCardClick(card.dataset.id);
      });
    });

    // Drag & drop
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        draggedId = card.dataset.id;
        draggedProject = currentProject.name;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    container.querySelectorAll('.kanban-col-body').forEach(col => {
      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const newStatus = col.dataset.status;
        if (!draggedId) return;
        try {
          await API.moveTask(draggedProject, draggedId, newStatus);
          await reload();
        } catch (err) {
          console.error('Move failed', err);
        } finally {
          draggedId = null;
        }
      });
    });
  }

  async function reload() {
    if (!currentProject) return;
    try {
      board = await API.getBoard(currentProject.name);
      render(document.getElementById('kanban-mount'));
    } catch (err) {
      console.error('Board load failed', err);
    }
  }

  return {
    init(onClickCb) { onCardClick = onClickCb; },
    async setProject(project) {
      currentProject = project;
      await reload();
    },
    reload,
  };
})();

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
