/* New task creation modal */
const TaskCreateModal = (() => {
  let currentProject = null;
  let onCreated = null;
  let existingTasks = [];

  async function open(project, onCreatedCb) {
    currentProject = project;
    onCreated = onCreatedCb;
    try {
      existingTasks = await API.getTasks(project.name);
    } catch (_) {
      existingTasks = [];
    }
    render();
  }

  function render() {
    const overlay = document.getElementById('task-create-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>New Task</h2>
          <button class="modal-close" id="tc-close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Title *</label>
            <input type="text" id="tc-title" placeholder="What needs to be done?">
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label>Priority</label>
              <select id="tc-priority">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium" selected>Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div class="form-row">
              <label>Assignee</label>
              <select id="tc-assignee">
                <option value="claude-code" selected>claude-code</option>
                <option value="human">human</option>
                <option value="unassigned">unassigned</option>
              </select>
            </div>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label>Estimate</label>
              <input type="text" id="tc-estimate" placeholder="e.g. 2h, 1d">
            </div>
            <div class="form-row">
              <label>Branch</label>
              <input type="text" id="tc-branch" placeholder="feature/my-branch">
            </div>
          </div>
          <div class="form-row">
            <label>Tags</label>
            <input type="text" id="tc-tags" placeholder="backend, api, auth (comma-separated)">
          </div>
          ${existingTasks.length ? `
          <div class="form-row">
            <label>Dependencies</label>
            <div id="tc-deps" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
              ${existingTasks.map(t => `
                <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px">
                  <input type="checkbox" value="${t.id}"> <span style="font-family:var(--mono)">${t.id}</span> <span style="color:var(--text-dim)">${escHtml(t.title.slice(0,30))}</span>
                </label>`).join('')}
            </div>
          </div>` : ''}
          <div class="form-row">
            <label>Description</label>
            <textarea id="tc-description" rows="4" placeholder="Describe the task…"></textarea>
          </div>
          <div class="form-row">
            <label>Acceptance Criteria</label>
            <textarea id="tc-criteria" rows="4" placeholder="- [ ] Criterion 1&#10;- [ ] Criterion 2"></textarea>
            <p class="form-hint">Each line becomes a checklist item.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="tc-cancel">Cancel</button>
          <button class="btn-primary" id="tc-create">Create Task</button>
        </div>
      </div>`;

    overlay.querySelector('#tc-close').addEventListener('click', close);
    overlay.querySelector('#tc-cancel').addEventListener('click', close);
    overlay.querySelector('#tc-create').addEventListener('click', create);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Focus title
    setTimeout(() => overlay.querySelector('#tc-title').focus(), 50);
  }

  async function create() {
    const overlay = document.getElementById('task-create-overlay');
    const title = overlay.querySelector('#tc-title').value.trim();
    if (!title) {
      overlay.querySelector('#tc-title').focus();
      overlay.querySelector('#tc-title').style.borderColor = 'var(--blocked)';
      return;
    }

    const tags = overlay.querySelector('#tc-tags').value
      .split(',').map(t => t.trim()).filter(Boolean);

    const deps = [...overlay.querySelectorAll('#tc-deps input:checked')]
      .map(cb => cb.value);

    const description = overlay.querySelector('#tc-description').value.trim();
    const criteria = overlay.querySelector('#tc-criteria').value.trim();

    const body = buildBody(description, criteria);

    const taskData = {
      title,
      priority:     overlay.querySelector('#tc-priority').value,
      assignee:     overlay.querySelector('#tc-assignee').value,
      estimate:     overlay.querySelector('#tc-estimate').value.trim() || null,
      branch:       overlay.querySelector('#tc-branch').value.trim() || null,
      tags,
      dependencies: deps,
      body,
    };

    try {
      await API.createTask(currentProject.name, taskData);
      close();
      if (onCreated) onCreated();
    } catch (err) {
      alert('Error creating task: ' + err.message);
    }
  }

  function buildBody(description, criteria) {
    const criteriaLines = criteria
      ? criteria.split('\n').map(l => l.startsWith('- ') ? l : `- [ ] ${l}`).join('\n')
      : '- [ ]';

    return `## Description\n\n${description || ''}\n\n## Acceptance Criteria\n\n${criteriaLines}\n\n## Subtasks\n\n- [ ]\n\n## Context\n\n## Notes\n`;
  }

  function close() {
    const overlay = document.getElementById('task-create-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }

  return { open };
})();
