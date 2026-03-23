/**
 * Unit tests for ProjectSettings component (ui/js/components/projectSettings.js).
 * Covers open/close lifecycle and DOM mutation.
 */

const { loadVanilla } = require('../helpers/loadVanilla');

const mockProject = { name: 'test-project' };

function loadComponent() {
  global.API = {
    getGitConfig: jest.fn().mockResolvedValue({
      enabled: false, platform: 'auto-detect', remoteUrl: '',
      token: '', baseBranch: 'main', reviewer: '',
      detectedPlatform: null,
    }),
    saveGitConfig: jest.fn().mockResolvedValue({}),
    testGitConfig: jest.fn().mockResolvedValue({ success: true, username: 'tester' }),
  };
  loadVanilla('ui/js/components/projectSettings.js');
  return global.ProjectSettings;
}

beforeEach(() => {
  document.body.innerHTML = `<div id="settings-mount" style="display:none"></div>`;
  delete global.ProjectSettings;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── open() ─────────────────────────────────────────────────────────────────

describe('ProjectSettings.open()', () => {
  test('sets settings-mount to display:block', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    expect(document.getElementById('settings-mount').style.display).toBe('block');
  });

  test('renders settings HTML into settings-mount', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    const mount = document.getElementById('settings-mount');
    expect(mount.querySelector('#settings-back')).not.toBeNull();
    expect(mount.querySelector('#git-enabled')).not.toBeNull();
    expect(mount.querySelector('#git-save-btn')).not.toBeNull();
  });

  test('renders the project name in the title', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    expect(document.body.innerHTML).toContain('test-project');
  });

  test('calls API.getGitConfig with the project name', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    expect(global.API.getGitConfig).toHaveBeenCalledWith('test-project');
  });
});

// ── close() ────────────────────────────────────────────────────────────────

describe('ProjectSettings.close()', () => {
  test('hides settings-mount', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    PS.close();
    expect(document.getElementById('settings-mount').style.display).toBe('none');
  });

  test('clears settings-mount innerHTML', async () => {
    const PS = loadComponent();
    await PS.open(mockProject, jest.fn());
    PS.close();
    expect(document.getElementById('settings-mount').innerHTML).toBe('');
  });

  test('invokes the backCallback provided to open()', async () => {
    const PS = loadComponent();
    const backCb = jest.fn();
    await PS.open(mockProject, backCb);
    PS.close();
    expect(backCb).toHaveBeenCalledTimes(1);
  });

  test('Back button triggers close and invokes backCallback', async () => {
    const PS = loadComponent();
    const backCb = jest.fn();
    await PS.open(mockProject, backCb);
    document.getElementById('settings-back').click();
    expect(backCb).toHaveBeenCalledTimes(1);
  });
});
