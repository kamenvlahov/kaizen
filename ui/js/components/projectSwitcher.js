/* Project switcher dropdown */
const ProjectSwitcher = (() => {
  let projects = [];
  let activeProject = null;
  let onSwitch = null;

  function render(container) {
    container.innerHTML = `
      <div class="project-switcher">
        <button class="project-switcher-btn" id="ps-btn">
          <span id="ps-label">No project</span> ▾
        </button>
        <div class="project-dropdown" id="ps-dropdown"></div>
      </div>`;

    document.getElementById('ps-btn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('ps-dropdown').classList.toggle('open');
    });

    document.addEventListener('click', () => {
      const dd = document.getElementById('ps-dropdown');
      if (dd) dd.classList.remove('open');
    });
  }

  function updateDropdown() {
    const dd = document.getElementById('ps-dropdown');
    const label = document.getElementById('ps-label');
    if (!dd) return;

    label.textContent = activeProject ? activeProject.name : 'No project';

    const items = projects.map(p => `
      <div class="project-dropdown-item ${activeProject && activeProject.name === p.name ? 'active' : ''}"
           data-name="${p.name}">
        <span>${p.name}</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span class="proj-count">${p.stats ? p.stats.total : '?'} tasks</span>
          <button class="proj-settings-btn" data-settings="${p.name}" title="Git settings">⚙</button>
        </span>
      </div>`).join('');

    dd.innerHTML = `
      ${items}
      <div class="project-dropdown-divider"></div>
      <div class="project-dropdown-add" id="ps-add">+ Register project</div>`;

    dd.querySelectorAll('.project-dropdown-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.proj-settings-btn')) return;
        const p = projects.find(x => x.name === el.dataset.name);
        if (p) switchTo(p);
        dd.classList.remove('open');
      });
    });

    dd.querySelectorAll('.proj-settings-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.remove('open');
        const p = projects.find(x => x.name === btn.dataset.settings);
        if (p) openSettings(p);
      });
    });

    document.getElementById('ps-add').addEventListener('click', () => {
      dd.classList.remove('open');
      showAddProjectForm();
    });
  }

  function switchTo(project) {
    activeProject = project;
    updateDropdown();
    if (onSwitch) onSwitch(project);
  }

  function openSettings(project) {
    ProjectSettings.open(project, () => {
      // Restore the normal view after closing settings
      if (onSwitch && activeProject) onSwitch(activeProject);
    });
  }

  async function load() {
    try {
      const list = await API.getProjects();
      // Enrich with stats
      projects = await Promise.all(list.map(p => API.getProject(p.name).catch(() => p)));
      if (projects.length && !activeProject) switchTo(projects[0]);
      else updateDropdown();
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  }

  function showAddProjectForm() {
    const overlay = document.createElement('div');
    overlay.className = 'reg-overlay';
    overlay.innerHTML = `
      <div class="reg-modal">
        <div class="modal-header">
          <h2>Register Project</h2>
          <button class="modal-close" id="reg-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>Project Name</label>
            <input type="text" id="reg-name" placeholder="my-project" autocomplete="off">
          </div>
          <div class="form-row">
            <label>Project Path</label>
            <div class="path-input-wrap">
              <input type="text" id="reg-path" placeholder="~/projects/my-project" autocomplete="off">
              <span class="path-status" id="reg-path-status"></span>
            </div>
            <div class="path-suggestions hidden" id="reg-suggestions"></div>
            <div class="form-hint" id="reg-path-hint"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="reg-cancel">Cancel</button>
          <button class="btn-primary" id="reg-submit">Register</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const nameInput  = document.getElementById('reg-name');
    const pathInput  = document.getElementById('reg-path');
    const statusEl   = document.getElementById('reg-path-status');
    const hintsEl    = document.getElementById('reg-suggestions');
    const hintText   = document.getElementById('reg-path-hint');

    let debounceTimer = null;
    let selectedIdx = -1;
    let currentDirs = [];

    function closeSuggestions() {
      hintsEl.classList.add('hidden');
      currentDirs = [];
      selectedIdx = -1;
    }

    function renderSuggestions(dirs) {
      currentDirs = dirs;
      selectedIdx = -1;
      if (!dirs.length) { closeSuggestions(); return; }
      hintsEl.innerHTML = dirs.map((d, i) =>
        `<div class="path-suggestion-item" data-idx="${i}">${d.path}</div>`
      ).join('');
      hintsEl.classList.remove('hidden');
      hintsEl.querySelectorAll('.path-suggestion-item').forEach(el => {
        el.addEventListener('mousedown', e => {
          e.preventDefault();
          pathInput.value = currentDirs[+el.dataset.idx].path + '/';
          closeSuggestions();
          triggerBrowse(pathInput.value);
        });
      });
    }

    function highlightItem(idx) {
      hintsEl.querySelectorAll('.path-suggestion-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });
    }

    function triggerBrowse(val) {
      clearTimeout(debounceTimer);
      statusEl.textContent = '';
      hintText.textContent = '';
      if (!val.trim()) { closeSuggestions(); return; }
      fetch('/api/browse?path=' + encodeURIComponent(val))
        .then(r => r.json())
        .then(data => {
          if (data.resolved) {
            hintText.textContent = 'Resolved: ' + data.resolved;
            // Check if exact match (path ends with / or is a listed dir itself)
            const isExact = data.directories.some(d => d.path === data.resolved) ||
                            val.endsWith('/') || val.endsWith('\\');
            statusEl.textContent = isExact ? '✓' : '';
            statusEl.className = 'path-status ' + (isExact ? 'valid' : '');
          } else {
            statusEl.textContent = '✗';
            statusEl.className = 'path-status invalid';
            hintText.textContent = data.error || 'Directory not found';
          }
          renderSuggestions(data.directories || []);
        })
        .catch(() => closeSuggestions());
    }

    pathInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => triggerBrowse(pathInput.value), 300);
    });

    pathInput.addEventListener('keydown', e => {
      if (!currentDirs.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, currentDirs.length - 1);
        highlightItem(selectedIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, -1);
        highlightItem(selectedIdx);
      } else if (e.key === 'Enter' && selectedIdx >= 0) {
        e.preventDefault();
        pathInput.value = currentDirs[selectedIdx].path + '/';
        closeSuggestions();
        triggerBrowse(pathInput.value);
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });

    pathInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));

    function closeModal() { document.body.removeChild(overlay); }

    document.getElementById('reg-close').addEventListener('click', closeModal);
    document.getElementById('reg-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    document.getElementById('reg-submit').addEventListener('click', () => {
      const name = nameInput.value.trim();
      const projPath = pathInput.value.trim();
      if (!name || !projPath) { alert('Name and path are required.'); return; }
      API.createProject({ name, path: projPath })
        .then(() => { closeModal(); load(); })
        .catch(err => alert('Error: ' + err.message));
    });

    nameInput.focus();
  }

  return {
    init(container, cb) {
      onSwitch = cb;
      render(container);
      load();
    },
    reload: load,
    getActive: () => activeProject,
  };
})();
