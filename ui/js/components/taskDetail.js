/* Task detail / edit panel */
const TaskDetail = (() => {
  let currentProject = null;
  let task = null;
  let editMode = false;
  let onClose = null;
  let onUpdated = null;

  const STATUSES = ['todo', 'in-progress', 'review', 'done', 'blocked'];

  function open(project, taskId, closeCb, updatedCb) {
    currentProject = project;
    onClose = closeCb;
    onUpdated = updatedCb;
    editMode = false;
    load(taskId);
  }

  async function load(taskId) {
    try {
      task = await API.getTask(currentProject.name, taskId);
      renderOverlay();
    } catch (err) {
      alert('Failed to load task: ' + err.message);
    }
  }

  function renderOverlay() {
    const overlay = document.getElementById('task-detail-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="modal task-detail-modal">${modalContent()}</div>`;
    bindEvents(overlay);
  }

  function modalContent() {
    return `
      <div class="modal-header">
        <h2><span style="font-family:var(--mono);color:var(--text-dim)">${task.id}</span>
            ${editMode ? `<input id="detail-title-input" value="${escHtml(task.title)}" style="margin-left:8px;font-size:15px;font-weight:600;background:var(--bg3);border:1px solid var(--border);color:var(--text-bright);padding:4px 8px;border-radius:4px;width:340px">` : ` — ${escHtml(task.title)}`}
        </h2>
        <div style="display:flex;gap:8px;align-items:center">
          ${editMode
            ? `<button class="btn-primary" id="detail-save">Save</button>
               <button class="btn-secondary" id="detail-cancel">Cancel</button>`
            : `<button class="btn-secondary" id="detail-edit">Edit</button>
               <button class="btn-danger" id="detail-delete">Delete</button>`}
          <button class="modal-close" id="detail-close">×</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="detail-layout">
          <div class="detail-body">
            ${editMode
              ? `<textarea id="detail-body-input" style="width:100%;min-height:420px;font-family:var(--mono);font-size:12px;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:4px">${escHtml(task.body)}</textarea>`
              : `<div class="detail-body-view">${renderBody(task.body)}</div>`}
          </div>
          <div class="detail-meta">
            <div class="meta-row">
              <span class="meta-label">Status</span>
              <div class="status-btn-group">
                ${STATUSES.map(s => `<button class="status-btn ${task.status===s?'current':''}" data-s="${s}">${s}</button>`).join('')}
              </div>
            </div>
            <div class="meta-row">
              <span class="meta-label">Priority</span>
              ${editMode
                ? `<select id="detail-priority" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px;border-radius:4px">
                     ${['critical','high','medium','low'].map(p => `<option value="${p}" ${task.priority===p?'selected':''}>${p}</option>`).join('')}
                   </select>`
                : `<span class="meta-value"><span class="priority-dot dot-${task.priority}"></span>${task.priority}</span>`}
            </div>
            <div class="meta-row">
              <span class="meta-label">Assignee</span>
              ${editMode
                ? `<select id="detail-assignee" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px;border-radius:4px">
                     ${['claude-code','human','unassigned'].map(a => `<option value="${a}" ${task.assignee===a?'selected':''}>${a}</option>`).join('')}
                   </select>`
                : `<span class="meta-value">${task.assignee}</span>`}
            </div>
            ${task.estimate ? `<div class="meta-row"><span class="meta-label">Estimate</span><span class="meta-value mono">${task.estimate}</span></div>` : ''}
            ${task.branch   ? `<div class="meta-row"><span class="meta-label">Branch</span><span class="meta-value mono">${task.branch}</span></div>` : ''}
            ${task.tags && task.tags.length ? `<div class="meta-row"><span class="meta-label">Tags</span><span class="meta-value">${task.tags.map(t=>`<span class="tag-chip">${t}</span>`).join(' ')}</span></div>` : ''}
            ${task.dependencies && task.dependencies.length
              ? `<div class="meta-row"><span class="meta-label">Dependencies</span>
                 <div>${task.dependencies.map(d => `<span class="dep-link" data-dep="${d}">${d}</span>`).join('')}</div></div>`
              : ''}
            <div class="meta-row" style="margin-top:auto">
              <span class="meta-label">Created</span>
              <span class="meta-value mono" style="font-size:11px">${(task.created||'').slice(0,10)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Updated</span>
              <span class="meta-value mono" style="font-size:11px">${(task.updated||'').slice(0,10)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderBody(body) {
    if (!body) return '<p style="color:var(--text-dim)">No content.</p>';
    // Simple markdown-ish render: H2, checkboxes, paragraphs
    const lines = body.split('\n');
    let html = '';
    let inList = false;
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${escHtml(line.slice(3))}</h2>`;
      } else if (/^- \[[ xX]\]/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        const checked = /^- \[[xX]\]/.test(line);
        const text = escHtml(line.replace(/^- \[[ xX]\]\s*/, ''));
        html += `<li><input type="checkbox" ${checked ? 'checked' : ''} disabled> ${text}</li>`;
      } else if (line.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${escHtml(line.slice(2))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim()) html += `<p>${escHtml(line)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function bindEvents(overlay) {
    overlay.querySelector('#detail-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Status buttons
    overlay.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.s;
        if (newStatus === task.status) return;
        try {
          await API.patchTask(currentProject.name, task.id, { status: newStatus });
          task.status = newStatus;
          if (onUpdated) onUpdated();
          renderOverlay();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      });
    });

    // Edit / Save / Cancel / Delete
    const editBtn = overlay.querySelector('#detail-edit');
    if (editBtn) editBtn.addEventListener('click', () => { editMode = true; renderOverlay(); });

    const cancelBtn = overlay.querySelector('#detail-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { editMode = false; renderOverlay(); });

    const saveBtn = overlay.querySelector('#detail-save');
    if (saveBtn) saveBtn.addEventListener('click', saveEdit);

    const deleteBtn = overlay.querySelector('#detail-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete ${task.id}?`)) return;
      try {
        await API.deleteTask(currentProject.name, task.id);
        if (onUpdated) onUpdated();
        close();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // Dependency links
    overlay.querySelectorAll('.dep-link').forEach(link => {
      link.addEventListener('click', () => {
        close();
        // Re-open with dependency task
        setTimeout(() => open(currentProject, link.dataset.dep, onClose, onUpdated), 50);
      });
    });
  }

  async function saveEdit() {
    const overlay = document.getElementById('task-detail-overlay');
    const titleInput = overlay.querySelector('#detail-title-input');
    const bodyInput = overlay.querySelector('#detail-body-input');
    const priorityInput = overlay.querySelector('#detail-priority');
    const assigneeInput = overlay.querySelector('#detail-assignee');

    const updates = {
      ...task,
      title: titleInput ? titleInput.value : task.title,
      body: bodyInput ? bodyInput.value : task.body,
      priority: priorityInput ? priorityInput.value : task.priority,
      assignee: assigneeInput ? assigneeInput.value : task.assignee,
    };

    try {
      task = await API.updateTask(currentProject.name, task.id, updates);
      editMode = false;
      if (onUpdated) onUpdated();
      renderOverlay();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }

  function close() {
    const overlay = document.getElementById('task-detail-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    task = null;
    editMode = false;
    if (onClose) onClose();
  }

  return { open };
})();
