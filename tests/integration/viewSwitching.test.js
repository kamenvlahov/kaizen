/**
 * Integration tests for the full view-switching chain in app.js.
 *
 * Since showSettingsView() and showNormalViews() are private inside app.js's
 * async IIFE, we access them by capturing the callbacks passed to:
 *   - ProjectSwitcher.init  → 3rd arg  = showSettingsView
 *   - ProjectSettings.open  → 2nd arg  = showNormalViews
 */

const fs   = require('fs');
const path = require('path');

const { setupDOM }                         = require('../helpers/domSetup');
const { setupGlobalMocks, mockScriptInjection } = require('../helpers/globalMocks');

const appSource = fs.readFileSync(
  path.resolve(__dirname, '../../ui/js/app.js'),
  'utf8'
);

// Captured references to private functions inside app.js
let showSettingsView;
let showNormalViews;

// DOM element references
let kanbanMount, listMount, settingsMount;

async function loadApp() {
  // ProjectSettings mock: capture showNormalViews from second arg of open()
  global.ProjectSettings = {
    open: jest.fn((project, backCb) => {
      showNormalViews = backCb;
      // Simulate real behavior: settings-mount becomes visible
      document.getElementById('settings-mount').style.display = 'block';
    }),
    close: jest.fn(),
  };

  // ProjectSwitcher mock: capture showSettingsView from third arg of init()
  global.ProjectSwitcher = {
    init: jest.fn((container, onSwitch, onSettings) => {
      showSettingsView = onSettings;
    }),
    reload: jest.fn(),
    getActive: jest.fn(),
  };

  // eslint-disable-next-line no-eval
  eval(appSource);

  // Let the async IIFE settle + socket.io onload fire
  await new Promise(r => setTimeout(r, 20));
}

beforeEach(async () => {
  showSettingsView = undefined;
  showNormalViews  = undefined;

  setupDOM();
  setupGlobalMocks();
  mockScriptInjection();

  kanbanMount   = document.getElementById('kanban-mount');
  listMount     = document.getElementById('list-mount');
  settingsMount = document.getElementById('settings-mount');

  await loadApp();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ── showSettingsView() ─────────────────────────────────────────────────────

describe('showSettingsView()', () => {
  const project = { name: 'my-project' };

  test('hides kanban-mount', () => {
    showSettingsView(project);
    expect(kanbanMount.style.display).toBe('none');
  });

  test('hides list-mount', () => {
    showSettingsView(project);
    expect(listMount.style.display).toBe('none');
  });

  test('calls ProjectSettings.open with the correct project', () => {
    showSettingsView(project);
    expect(global.ProjectSettings.open).toHaveBeenCalledWith(
      project,
      expect.any(Function)
    );
  });

  test('calls ProjectSettings.open with showNormalViews as the callback', () => {
    showSettingsView(project);
    // After the call, showNormalViews must have been captured
    expect(typeof showNormalViews).toBe('function');
  });
});

// ── showNormalViews() ──────────────────────────────────────────────────────

describe('showNormalViews()', () => {
  const project = { name: 'my-project' };

  beforeEach(() => {
    // Enter settings view first so mounts are hidden
    showSettingsView(project);
  });

  test('hides settings-mount', () => {
    showNormalViews();
    expect(settingsMount.style.display).toBe('none');
  });

  test('restores kanban-mount when activeView is kanban (default)', () => {
    showNormalViews();
    // Default activeView in app.js is 'kanban'; display should not be 'none'
    expect(kanbanMount.style.display).not.toBe('none');
  });

  test('keeps list-mount hidden when activeView is kanban', () => {
    showNormalViews();
    expect(listMount.style.display).toBe('none');
  });
});

// ── Full chain: gear click → showSettingsView → mount visibility ───────────

describe('Full chain via ProjectSwitcher callback', () => {
  test('invoking onOpenSettings callback hides kanban and list', () => {
    const project = { name: 'chain-test' };
    // Simulates: gear icon click → ProjectSwitcher.openSettings(p) → onOpenSettings(p)
    showSettingsView(project);

    expect(kanbanMount.style.display).toBe('none');
    expect(listMount.style.display).toBe('none');
  });

  test('invoking back callback restores normal views', () => {
    const project = { name: 'chain-test' };
    showSettingsView(project);   // hides mounts, captures showNormalViews
    showNormalViews();            // simulates Back button click

    expect(settingsMount.style.display).toBe('none');
    expect(kanbanMount.style.display).not.toBe('none');
  });
});

// ── Known-failing: documents expected but currently unimplemented behavior ─

describe('Expected behavior (documented as known-failing)', () => {
  // showSettingsView() does NOT directly set settings-mount to display:block.
  // It delegates this to ProjectSettings.open(). If ProjectSettings.open is
  // never called (or fails), the settings panel will not appear.
  // This test uses a mock that does NOT set display:block, mirroring the gap.
  test.failing('showSettingsView() directly makes settings-mount visible without relying on ProjectSettings.open', () => {
    // Override: open() does nothing (does not set display:block)
    global.ProjectSettings.open = jest.fn();

    showSettingsView({ name: 'test' });

    // Expected: settings-mount is visible. Actual: still display:none because
    // showSettingsView itself never sets settings-mount.style.display = 'block'.
    expect(settingsMount.style.display).toBe('block');
  });
});
