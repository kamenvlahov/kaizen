/* Task detail / edit panel */
const TaskDetail = (() => {
  let currentProject = null;
  let task = null;
  let editMode = false;
  let onClose = null;
  let onUpdated = null;
  let _availableModels = [];
  let _selectedModel = null;
  let _refinedResult = null;

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
    if (editMode) loadModels();
  }

  async function loadModels() {
    try {
      const data = await API.getAiModels();
      _availableModels = data.models || [];
      _selectedModel = data.default || (_availableModels[0] || null);
      const sel = document.getElementById('td-ai-model');
      if (sel) {
        sel.innerHTML = _availableModels.map(m =>
          `<option value="${escHtml(m)}" ${m === _selectedModel ? 'selected' : ''}>${escHtml(m)}</option>`
        ).join('');
        sel.closest('.td-ai-model-row').style.display = _availableModels.length ? 'flex' : 'none';
      }
    } catch (_) {
      _availableModels = [];
      const row = document.getElementById('td-ai-model')?.closest('.td-ai-model-row');
      if (row) row.style.display = 'none';
    }
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
              ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                   <span style="font-size:11px;color:var(--text-dim);font-weight:600">Body</span>
                   <div style="display:flex;align-items:center;gap:8px">
                     <div class="td-ai-model-row" style="display:none;align-items:center;gap:6px">
                       <select id="td-ai-model" style="font-size:11px;padding:2px 6px;height:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg2);color:var(--text);cursor:pointer"></select>
                     </div>
                     <button type="button" id="td-refine-btn" class="btn-secondary" style="font-size:11px;padding:3px 10px;height:auto">✨ Refine</button>
                   </div>
                 </div>
                 <textarea id="detail-body-input" style="width:100%;min-height:380px;font-family:var(--mono);font-size:12px;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:4px">${escHtml(task.body)}</textarea>
                 <div id="td-refine-preview" style="display:none;margin-top:10px">
                   <div id="td-refine-content" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:14px;font-size:12px"></div>
                   <div style="display:flex;gap:8px;margin-top:8px">
                     <button type="button" id="td-apply-btn" class="btn-primary" style="font-size:12px;padding:5px 14px">Apply</button>
                     <button type="button" id="td-discard-btn" class="btn-secondary" style="font-size:12px;padding:5px 14px">Discard</button>
                   </div>
                 </div>`
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
            ${task.branch   ? `<div class="meta-row"><span class="meta-label">Branch</span><span class="meta-value mono">${escHtml(task.branch)}</span></div>` : ''}
            ${task.mr_url   ? `<div class="meta-row"><span class="meta-label">MR / PR</span><span class="meta-value"><a href="${escHtml(task.mr_url)}" target="_blank" rel="noopener" style="color:var(--accent)">${escHtml(task.mr_url)}</a></span></div>` : ''}
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
    if (editBtn) editBtn.addEventListener('click', () => { editMode = true; _refinedResult = null; renderOverlay(); });

    const cancelBtn = overlay.querySelector('#detail-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { editMode = false; _refinedResult = null; renderOverlay(); });

    const refineBtn = overlay.querySelector('#td-refine-btn');
    if (refineBtn) refineBtn.addEventListener('click', refine);

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

  async function refine() {
    const overlay = document.getElementById('task-detail-overlay');
    const titleInput = overlay.querySelector('#detail-title-input');
    const bodyInput = overlay.querySelector('#detail-body-input');
    const title = titleInput ? titleInput.value.trim() : task.title;
    const description = bodyInput ? bodyInput.value.trim() : '';

    if (!title && !description) {
      if (titleInput) { titleInput.focus(); titleInput.style.borderColor = 'var(--blocked)'; }
      return;
    }

    const btn = overlay.querySelector('#td-refine-btn');
    const preview = overlay.querySelector('#td-refine-preview');
    const content = overlay.querySelector('#td-refine-content');

    btn.disabled = true;
    btn.textContent = '⏳ Refining…';
    preview.style.display = 'none';
    _refinedResult = null;

    const modelSel = overlay.querySelector('#td-ai-model');
    const model = modelSel ? modelSel.value : undefined;

    try {
      const result = await API.refineTask({ title, description, model });
      _refinedResult = result;

      const subtasksList = result.subtasks.length
        ? result.subtasks.map(s => `<li style="margin-bottom:4px">${escHtml(s)}</li>`).join('')
        : '<li style="color:var(--text-dim)">—</li>';
      const skillsList = result.suggestedSkills.length
        ? result.suggestedSkills.map(s => `<span style="display:inline-block;padding:1px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;font-size:11px;margin:2px">${escHtml(s)}</span>`).join('')
        : '<span style="color:var(--text-dim)">—</span>';

      content.innerHTML = `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Refined Title</div>
          <div style="color:var(--text-bright)">${escHtml(result.refinedTitle)}</div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Refined Description</div>
          <div style="white-space:pre-wrap">${escHtml(result.refinedDescription)}</div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Subtasks</div>
          <ul style="margin:0;padding-left:18px">${subtasksList}</ul>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Suggested Skills</div>
          <div>${skillsList}</div>
        </div>`;

      preview.style.display = 'block';

      overlay.querySelector('#td-apply-btn').addEventListener('click', applyRefined);
      overlay.querySelector('#td-discard-btn').addEventListener('click', () => {
        preview.style.display = 'none';
        _refinedResult = null;
      });
    } catch (err) {
      content.innerHTML = `<div style="color:var(--blocked)">${escHtml(err.message)}</div>`;
      preview.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Refine';
    }
  }

  function applyRefined() {
    if (!_refinedResult) return;
    const overlay = document.getElementById('task-detail-overlay');

    const titleInput = overlay.querySelector('#detail-title-input');
    if (titleInput && _refinedResult.refinedTitle) {
      titleInput.value = _refinedResult.refinedTitle;
    }

    const bodyInput = overlay.querySelector('#detail-body-input');
    if (bodyInput) {
      bodyInput.value = applyRefinedToBody(bodyInput.value, _refinedResult);
    }

    overlay.querySelector('#td-refine-preview').style.display = 'none';
    _refinedResult = null;
  }

  function applyRefinedToBody(body, result) {
    // Replace ## Description and ## Subtasks sections; keep other sections intact
    const replaceSection = (text, heading, newContent) => {
      const re = new RegExp(`(## ${heading}\\n)([\\s\\S]*?)(?=\\n## |$)`, 'g');
      return text.replace(re, `$1\n${newContent}\n`);
    };

    let updated = body;
    if (result.refinedDescription) {
      updated = replaceSection(updated, 'Description', result.refinedDescription);
    }
    if (result.subtasks && result.subtasks.length) {
      const checklist = result.subtasks.map(s => `- [ ] ${s}`).join('\n');
      updated = replaceSection(updated, 'Subtasks', checklist);
    }
    return updated;
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
    _refinedResult = null;
    if (onClose) onClose();
  }

  return { open };
})();
