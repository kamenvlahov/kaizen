/* Filterable, sortable task list */
const ListView = (() => {
  let currentProject = null;
  let allTasks = [];
  let sortCol = 'id';
  let sortAsc = true;
  let filters = { search: '', status: '', priority: '', assignee: '' };
  let onRowClick = null;

  const STATUSES   = ['', 'backlog', 'todo', 'in-progress', 'review', 'done', 'blocked', 'archived'];
  const PRIORITIES = ['', 'critical', 'high', 'medium', 'low'];
  const ASSIGNEES  = ['', 'claude-code', 'human', 'unassigned'];
  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  function toolbar() {
    return `
      <div class="list-toolbar">
        <input type="text" id="lv-search" placeholder="Search…" value="${escHtml(filters.search)}">
        <select id="lv-status">
          ${STATUSES.map(s => `<option value="${s}" ${filters.status===s?'selected':''}>${s||'All statuses'}</option>`).join('')}
        </select>
        <select id="lv-priority">
          ${PRIORITIES.map(p => `<option value="${p}" ${filters.priority===p?'selected':''}>${p||'All priorities'}</option>`).join('')}
        </select>
        <select id="lv-assignee">
          ${ASSIGNEES.map(a => `<option value="${a}" ${filters.assignee===a?'selected':''}>${a||'All assignees'}</option>`).join('')}
        </select>
      </div>`;
  }

  function sortArrow(col) {
    if (sortCol !== col) return `<span class="sort-arrow">↕</span>`;
    return `<span class="sort-arrow">${sortAsc ? '↑' : '↓'}</span>`;
  }

  function tableHead() {
    const cols = [
      { key: 'id',       label: 'ID' },
      { key: 'title',    label: 'Title' },
      { key: 'status',   label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'assignee', label: 'Assignee' },
      { key: 'updated',  label: 'Updated' },
    ];
    return `<thead><tr>${cols.map(c =>
      `<th class="${sortCol===c.key?'sorted':''}" data-col="${c.key}">${c.label} ${sortArrow(c.key)}</th>`
    ).join('')}</tr></thead>`;
  }

  function filteredSorted() {
    let tasks = allTasks.filter(t => {
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase()) && !t.id.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status   && t.status   !== filters.status)   return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.assignee && t.assignee !== filters.assignee) return false;
      return true;
    });

    tasks.sort((a, b) => {
      let va = a[sortCol] || '', vb = b[sortCol] || '';
      if (sortCol === 'priority') { va = PRIORITY_ORDER[va] ?? 9; vb = PRIORITY_ORDER[vb] ?? 9; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });
    return tasks;
  }

  function taskRow(task) {
    const upd = task.updated ? task.updated.slice(0, 10) : '';
    return `
      <tr data-id="${task.id}">
        <td class="td-id">${task.id}</td>
        <td class="td-title"><span>${escHtml(task.title)}</span></td>
        <td><span class="status-badge status-${task.status}">${task.status}</span></td>
        <td><span class="priority-dot dot-${task.priority}"></span>${task.priority}</td>
        <td>${task.assignee}</td>
        <td style="color:var(--text-dim);font-family:var(--mono);font-size:12px">${upd}</td>
      </tr>`;
  }

  function render(container) {
    if (!currentProject) {
      container.innerHTML = `<div class="empty-state"><p>No project selected.</p></div>`;
      return;
    }
    const tasks = filteredSorted();
    container.innerHTML = `
      ${toolbar()}
      <div class="list-table-wrap">
        <table>
          ${tableHead()}
          <tbody>
            ${tasks.length ? tasks.map(taskRow).join('') : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim)">No tasks found.</td></tr>`}
          </tbody>
        </table>
      </div>`;
    bindEvents(container);
  }

  function bindEvents(container) {
    container.querySelector('#lv-search').addEventListener('input', e => {
      filters.search = e.target.value; render(container);
    });
    container.querySelector('#lv-status').addEventListener('change', e => {
      filters.status = e.target.value; render(container);
    });
    container.querySelector('#lv-priority').addEventListener('change', e => {
      filters.priority = e.target.value; render(container);
    });
    container.querySelector('#lv-assignee').addEventListener('change', e => {
      filters.assignee = e.target.value; render(container);
    });
    container.querySelectorAll('thead th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        render(container);
      });
    });
    container.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', () => { if (onRowClick) onRowClick(row.dataset.id); });
    });
  }

  async function reload() {
    if (!currentProject) return;
    try {
      allTasks = await API.getTasks(currentProject.name);
      render(document.getElementById('list-mount'));
    } catch (err) {
      console.error('List load failed', err);
    }
  }

  return {
    init(onClickCb) { onRowClick = onClickCb; },
    async setProject(project) {
      currentProject = project;
      filters = { search: '', status: '', priority: '', assignee: '' };
      sortCol = 'id'; sortAsc = true;
      await reload();
    },
    reload,
  };
})();
