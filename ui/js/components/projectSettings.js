/* Project Git Settings view */
const ProjectSettings = (() => {
  let currentProject = null;
  let onBack = null;
  let tokenDirty = false;

  function getMount() {
    return document.getElementById('settings-mount');
  }

  async function open(project, backCallback) {
    currentProject = project;
    onBack = backCallback;
    tokenDirty = false;

    const mount = getMount();
    mount.style.display = 'block';
    mount.innerHTML = `
      <div class="settings-container">
        <div class="settings-header">
          <button class="btn-back" id="settings-back">← Back</button>
          <h1 class="settings-title">Settings — ${project.name}</h1>
        </div>
        <div class="settings-card">
          <h2 class="settings-section-title">Git Integration</h2>
          <div class="form-row settings-toggle-row">
            <label class="toggle-label">
              <span>Enable Git integration</span>
              <label class="toggle-switch">
                <input type="checkbox" id="git-enabled">
                <span class="toggle-slider"></span>
              </label>
            </label>
          </div>
          <div class="form-row">
            <label>Platform</label>
            <select id="git-platform">
              <option value="auto-detect">Auto-detect</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
            <div class="form-hint" id="git-platform-hint"></div>
          </div>
          <div class="form-row">
            <label>Remote URL</label>
            <input type="text" id="git-remote-url" readonly placeholder="Detected from git remote">
          </div>
          <div class="form-row">
            <label>API Token</label>
            <div class="token-input-wrap">
              <input type="password" id="git-token" placeholder="Paste token to update" autocomplete="off">
              <button class="token-toggle" id="token-toggle" type="button" title="Show/hide token">👁</button>
            </div>
            <div class="form-hint">Leave unchanged to keep existing token</div>
          </div>
          <div class="form-row">
            <label>Base Branch</label>
            <input type="text" id="git-base-branch" placeholder="main">
          </div>
          <div class="form-row">
            <label>Reviewer <span style="font-weight:400;text-transform:none">(optional)</span></label>
            <input type="text" id="git-reviewer" placeholder="username">
          </div>
          <div class="settings-actions">
            <button class="btn-secondary" id="git-test-btn">Test Connection</button>
            <div class="test-result" id="git-test-result"></div>
            <button class="btn-primary" id="git-save-btn">Save</button>
          </div>
        </div>
      </div>`;

    document.getElementById('settings-back').addEventListener('click', close);

    document.getElementById('git-platform').addEventListener('change', () => {
      updatePlatformHint(null);
    });

    document.getElementById('token-toggle').addEventListener('click', () => {
      const input = document.getElementById('git-token');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('git-token').addEventListener('input', () => {
      tokenDirty = true;
    });

    document.getElementById('git-save-btn').addEventListener('click', save);
    document.getElementById('git-test-btn').addEventListener('click', testConnection);

    await loadConfig();
  }

  async function loadConfig() {
    try {
      const cfg = await API.getGitConfig(currentProject.name);
      document.getElementById('git-enabled').checked = cfg.enabled;
      document.getElementById('git-platform').value = cfg.platform || 'auto-detect';
      document.getElementById('git-remote-url').value = cfg.remoteUrl || '';
      document.getElementById('git-token').value = cfg.token || '';
      document.getElementById('git-base-branch').value = cfg.baseBranch || 'main';
      document.getElementById('git-reviewer').value = cfg.reviewer || '';
      updatePlatformHint(cfg.detectedPlatform);
    } catch (err) {
      console.error('Failed to load git config', err);
    }
  }

  function updatePlatformHint(detected) {
    const hint = document.getElementById('git-platform-hint');
    if (!hint) return;
    const selected = document.getElementById('git-platform').value;
    if (selected === 'auto-detect' && detected) {
      hint.textContent = `Detected: ${detected}`;
    } else {
      hint.textContent = '';
    }
  }

  async function save() {
    const btn = document.getElementById('git-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const token = document.getElementById('git-token').value;

    try {
      await API.saveGitConfig(currentProject.name, {
        enabled: document.getElementById('git-enabled').checked,
        platform: document.getElementById('git-platform').value,
        token: tokenDirty ? token : token, // always send; server checks if masked
        baseBranch: document.getElementById('git-base-branch').value.trim() || 'main',
        reviewer: document.getElementById('git-reviewer').value.trim(),
      });
      tokenDirty = false;
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 1500);
    } catch (err) {
      alert('Save failed: ' + err.message);
      btn.textContent = 'Save';
      btn.disabled = false;
    }
  }

  async function testConnection() {
    const btn = document.getElementById('git-test-btn');
    const resultEl = document.getElementById('git-test-result');
    btn.disabled = true;
    resultEl.className = 'test-result';
    resultEl.textContent = 'Testing…';

    try {
      const result = await API.testGitConfig(currentProject.name);
      if (result.success) {
        resultEl.className = 'test-result success';
        resultEl.textContent = `✓ Connected as ${result.username}`;
      } else {
        resultEl.className = 'test-result error';
        resultEl.textContent = `✗ ${result.error}`;
      }
    } catch (err) {
      resultEl.className = 'test-result error';
      resultEl.textContent = `✗ ${err.message}`;
    }

    btn.disabled = false;
  }

  function close() {
    const mount = getMount();
    mount.style.display = 'none';
    mount.innerHTML = '';
    if (onBack) onBack();
  }

  return { open, close };
})();
