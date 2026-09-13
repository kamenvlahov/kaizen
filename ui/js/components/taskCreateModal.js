/* New task creation modal */
const TaskCreateModal = (() => {
  let currentProject = null;
  let onCreated = null;
  let existingTasks = [];
  let availableModels = [];
  let selectedModel = null;

  async function open(project, onCreatedCb) {
    currentProject = project;
    onCreated = onCreatedCb;
    try {
      existingTasks = await API.getTasks(project.name);
    } catch (_) {
      existingTasks = [];
    }
    // Load models in background — don't block modal open
    loadModels();
    render();
  }

  async function loadModels() {
    try {
      const data = await API.getAiModels();
      availableModels = data.models || [];
      selectedModel = data.default || (availableModels[0] || null);
      // Update model selector if modal is still open
      const sel = document.getElementById('tc-ai-model');
      if (sel) {
        sel.innerHTML = availableModels.map(m =>
          `<option value="${escHtml(m)}" ${m === selectedModel ? 'selected' : ''}>${escHtml(m)}</option>`
        ).join('');
        sel.closest('.tc-ai-model-row').style.display = availableModels.length ? 'flex' : 'none';
      }
    } catch (_) {
      availableModels = [];
      const row = document.getElementById('tc-ai-model')?.closest('.tc-ai-model-row');
      if (row) row.style.display = 'none';
    }
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
          <div class="form-row">
            <label>Tags</label>
            <input type="text" id="tc-tags" placeholder="backend, api, auth (comma-separated)">
          </div>
          <div class="form-row">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <label style="margin-bottom:0">Description</label>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="tc-ai-model-row" style="display:none;align-items:center;gap:6px">
                  <select id="tc-ai-model" style="font-size:11px;padding:2px 6px;height:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg2);color:var(--text);cursor:pointer"></select>
                </div>
                <button type="button" id="tc-refine-btn" class="btn-secondary" style="font-size:11px;padding:3px 10px;height:auto">✨ Refine</button>
              </div>
            </div>
            <textarea id="tc-description" rows="4" placeholder="Describe the task…"></textarea>
          </div>
          <div id="tc-refine-preview" style="display:none" class="form-row">
            <label>AI Refined Preview</label>
            <div id="tc-refine-content" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:14px;font-size:12px"></div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button type="button" id="tc-apply-btn" class="btn-primary" style="font-size:12px;padding:5px 14px">Apply</button>
              <button type="button" id="tc-discard-btn" class="btn-secondary" style="font-size:12px;padding:5px 14px">Discard</button>
            </div>
          </div>
          <div class="form-row">
            <label>Acceptance Criteria</label>
            <textarea id="tc-criteria" rows="3" placeholder="- [ ] Criterion 1&#10;- [ ] Criterion 2"></textarea>
            <p class="form-hint">Each line becomes a checklist item.</p>
          </div>
          <details style="margin-top:8px">
            <summary style="cursor:pointer;font-size:12px;color:var(--text-dim);user-select:none;padding:4px 0">Advanced options</summary>
            <div style="padding-top:10px;display:flex;flex-direction:column;gap:10px">
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
            </div>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="tc-cancel">Cancel</button>
          <button class="btn-primary" id="tc-create">Create Task</button>
        </div>
      </div>`;

    overlay.querySelector('#tc-close').addEventListener('click', close);
    overlay.querySelector('#tc-cancel').addEventListener('click', close);
    overlay.querySelector('#tc-create').addEventListener('click', create);
    overlay.querySelector('#tc-refine-btn').addEventListener('click', refine);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Focus title
    setTimeout(() => overlay.querySelector('#tc-title').focus(), 50);
  }

  // Holds the latest refined result so Apply can use it
  let _refinedResult = null;

  async function refine() {
    const overlay = document.getElementById('task-create-overlay');
    const title = overlay.querySelector('#tc-title').value.trim();
    const description = overlay.querySelector('#tc-description').value.trim();

    if (!title && !description) {
      overlay.querySelector('#tc-title').focus();
      overlay.querySelector('#tc-title').style.borderColor = 'var(--blocked)';
      return;
    }

    const btn = overlay.querySelector('#tc-refine-btn');
    const preview = overlay.querySelector('#tc-refine-preview');
    const content = overlay.querySelector('#tc-refine-content');

    btn.disabled = true;
    btn.textContent = '⏳ Refining…';
    preview.style.display = 'none';
    _refinedResult = null;

    const modelSel = overlay.querySelector('#tc-ai-model');
    const model = modelSel ? modelSel.value : undefined;

    try {
      const result = await API.refineTask({
        title,
        description,
        model,
        project: currentProject ? currentProject.name : undefined,
      });
      _refinedResult = result;

      const subtasksList = result.subtasks.length
        ? result.subtasks.map(s => `<li style="margin-bottom:4px">${escHtml(s)}</li>`).join('')
        : '<li style="color:var(--text-dim)">—</li>';
      const skillsList = result.suggestedSkills.length
        ? result.suggestedSkills.map(s => `<span style="display:inline-block;padding:1px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;font-size:11px;margin:2px">${escHtml(s)}</span>`).join('')
        : '<span style="color:var(--text-dim)">—</span>';

      const openQuestions = result.openQuestions || [];
      const questionsBlock = openQuestions.length
        ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
             <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Open Questions</div>
             <ul style="margin:0;padding-left:18px">${openQuestions.map(q => `<li style="margin-bottom:4px">${escHtml(q)}</li>`).join('')}</ul>
           </div>`
        : '';

      const contextUsed = result.contextUsed || [];
      const contextRow = contextUsed.length
        ? `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
             <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Project Context Used</div>
             <div>${contextUsed.map(c => `<span style="display:inline-block;padding:1px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;font-size:11px;margin:2px">${escHtml(c)}</span>`).join('')}</div>
           </div>`
        : `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-dim)">Refined without project context</div>`;

      content.innerHTML = `
        ${contextRow}
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
        </div>
        ${questionsBlock}`;

      preview.style.display = 'block';

      overlay.querySelector('#tc-apply-btn').addEventListener('click', applyRefined);
      overlay.querySelector('#tc-discard-btn').addEventListener('click', () => {
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
    const overlay = document.getElementById('task-create-overlay');

    if (_refinedResult.refinedTitle) {
      overlay.querySelector('#tc-title').value = _refinedResult.refinedTitle;
    }

    const parts = [];
    if (_refinedResult.refinedDescription) parts.push(_refinedResult.refinedDescription);
    if (_refinedResult.subtasks.length) {
      parts.push('\n**Subtasks:**\n' + _refinedResult.subtasks.map(s => `- [ ] ${s}`).join('\n'));
    }
    if (_refinedResult.openQuestions && _refinedResult.openQuestions.length) {
      parts.push('\n**Open questions:**\n' + _refinedResult.openQuestions.map(q => `- ${q}`).join('\n'));
    }
    if (parts.length) {
      overlay.querySelector('#tc-description').value = parts.join('\n\n');
    }

    if (_refinedResult.suggestedSkills.length) {
      const tagsInput = overlay.querySelector('#tc-tags');
      const existing = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ..._refinedResult.suggestedSkills])];
      tagsInput.value = merged.join(', ');
    }

    overlay.querySelector('#tc-refine-preview').style.display = 'none';
    _refinedResult = null;
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
    _refinedResult = null;
    const overlay = document.getElementById('task-create-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }

  return { open };
})();
