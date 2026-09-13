/**
 * Smoke tests for the dashboard (app.js orchestration layer).
 *
 * These tests verify that the critical happy-path flows do not crash and
 * produce the expected top-level behaviour. There is no login — the app
 * starts directly on the dashboard.
 */

const fs   = require('fs');
const path = require('path');

const { setupDOM }                             = require('../helpers/domSetup');
const { setupGlobalMocks, mockScriptInjection } = require('../helpers/globalMocks');

const appSource = fs.readFileSync(
  path.resolve(__dirname, '../../ui/js/app.js'),
  'utf8'
);

// Captured references to private callbacks exposed through mocks
let onSwitchProject;   // 2nd arg of ProjectSwitcher.init
let onOpenSettings;    // 3rd arg of ProjectSwitcher.init
let socketHandlers;    // map of event → handler registered via socket.on

async function loadApp() {
  socketHandlers = {};

  const mockSocket = {
    on:   jest.fn((event, cb) => { socketHandlers[event] = cb; }),
    emit: jest.fn(),
  };
  global.io = jest.fn().mockReturnValue(mockSocket);

  global.ProjectSwitcher = {
    init:     jest.fn((container, onSwitch, onSettings) => {
      onSwitchProject = onSwitch;
      onOpenSettings  = onSettings;
    }),
    reload:   jest.fn(),
    getActive: jest.fn(),
  };

  global.ProjectSettings = {
    open:  jest.fn(),
    close: jest.fn(),
  };

  // eslint-disable-next-line no-eval
  eval(appSource);

  // Let the async IIFE settle + socket.io onload fire
  await new Promise(r => setTimeout(r, 20));
}

beforeEach(async () => {
  onSwitchProject = undefined;
  onOpenSettings  = undefined;

  setupDOM();
  setupGlobalMocks();
  mockScriptInjection();
  await loadApp();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ── 1. App initialisation ───────────────────────────────────────────────────

describe('App initialisation', () => {
  test('kanban-mount is visible by default', () => {
    const el = document.getElementById('kanban-mount');
    expect(el.style.display).not.toBe('none');
  });

  test('list-mount is hidden by default', () => {
    const el = document.getElementById('list-mount');
    expect(el.style.display).toBe('none');
  });

  test('settings-mount is hidden by default', () => {
    const el = document.getElementById('settings-mount');
    expect(el.style.display).toBe('none');
  });

  test('start-claude-btn is hidden before a project is selected', () => {
    const btn = document.getElementById('start-claude-btn');
    expect(btn.style.display).toBe('none');
  });

  test('ProjectSwitcher.init is called once', () => {
    expect(global.ProjectSwitcher.init).toHaveBeenCalledTimes(1);
  });

  test('Kanban.init is called once', () => {
    expect(global.Kanban.init).toHaveBeenCalledTimes(1);
  });

  test('ListView.init is called once', () => {
    expect(global.ListView.init).toHaveBeenCalledTimes(1);
  });
});

// ── 2. View switching via tabs ──────────────────────────────────────────────

describe('Tab view switching', () => {
  test('clicking the list tab hides kanban-mount', () => {
    document.querySelector('.tab-btn[data-view="list"]').click();
    expect(document.getElementById('kanban-mount').style.display).toBe('none');
  });

  test('clicking the list tab shows list-mount', () => {
    document.querySelector('.tab-btn[data-view="list"]').click();
    expect(document.getElementById('list-mount').style.display).not.toBe('none');
  });

  test('clicking the kanban tab after list restores kanban-mount', () => {
    document.querySelector('.tab-btn[data-view="list"]').click();
    document.querySelector('.tab-btn[data-view="kanban"]').click();
    expect(document.getElementById('kanban-mount').style.display).not.toBe('none');
  });

  test('clicking list tab calls ListView.setProject when a project is active', async () => {
    const project = { name: 'smoke-proj', path: '/tmp/smoke' };
    await onSwitchProject(project);

    document.querySelector('.tab-btn[data-view="list"]').click();
    expect(global.ListView.setProject).toHaveBeenCalledWith(project);
  });
});

// ── 3. Project switching ────────────────────────────────────────────────────

describe('Project switching', () => {
  test('switching project calls Kanban.setProject', async () => {
    const project = { name: 'proj-a', path: '/tmp/a' };
    await onSwitchProject(project);
    expect(global.Kanban.setProject).toHaveBeenCalledWith(project);
  });

  test('switching project calls ListView.setProject', async () => {
    const project = { name: 'proj-a', path: '/tmp/a' };
    await onSwitchProject(project);
    expect(global.ListView.setProject).toHaveBeenCalledWith(project);
  });

  test('switching project makes start-claude-btn visible when project has a path', async () => {
    await onSwitchProject({ name: 'proj-a', path: '/tmp/a' });
    expect(document.getElementById('start-claude-btn').style.display).not.toBe('none');
  });

  test('switching to a project without a path keeps start-claude-btn hidden', async () => {
    await onSwitchProject({ name: 'proj-b' });
    expect(document.getElementById('start-claude-btn').style.display).toBe('none');
  });
});

// ── 4. New Task button ──────────────────────────────────────────────────────

describe('New Task button', () => {
  test('opens TaskCreateModal when a project is active', async () => {
    await onSwitchProject({ name: 'proj-a', path: '/tmp/a' });
    document.getElementById('new-task-btn').click();
    expect(global.TaskCreateModal.open).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'proj-a' }),
      expect.any(Function)
    );
  });

  test('does not open TaskCreateModal when no project is selected', () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    document.getElementById('new-task-btn').click();
    expect(global.TaskCreateModal.open).not.toHaveBeenCalled();
  });
});

// ── 5. Start Claude button ──────────────────────────────────────────────────

describe('Start Claude button', () => {
  beforeEach(async () => {
    global.API.startClaude = jest.fn().mockResolvedValue({});
    await onSwitchProject({ name: 'proj-a', path: '/tmp/a' });
  });

  test('calls API.startClaude with the active project name on click', async () => {
    document.getElementById('start-claude-btn').click();
    expect(global.API.startClaude).toHaveBeenCalledWith('proj-a');
  });

  test('button is disabled while starting', () => {
    // Do not await — check synchronous disabled state
    document.getElementById('start-claude-btn').click();
    expect(document.getElementById('start-claude-btn').disabled).toBe(true);
  });

  test('button re-enables after successful start', async () => {
    document.getElementById('start-claude-btn').click();
    await new Promise(r => setTimeout(r, 2500));
    expect(document.getElementById('start-claude-btn').disabled).toBe(false);
  });
});

// ── 6. WebSocket events trigger reloads ────────────────────────────────────

describe('WebSocket event handling', () => {
  beforeEach(async () => {
    await onSwitchProject({ name: 'proj-a', path: '/tmp/a' });
  });

  test('task:created reloads Kanban', () => {
    socketHandlers['task:created']({ projectName: 'proj-a' });
    expect(global.Kanban.reload).toHaveBeenCalled();
  });

  test('task:updated reloads ListView', () => {
    socketHandlers['task:updated']({ projectName: 'proj-a' });
    expect(global.ListView.reload).toHaveBeenCalled();
  });

  test('task:deleted reloads ProjectSwitcher', () => {
    socketHandlers['task:deleted']({ projectName: 'proj-a' });
    expect(global.ProjectSwitcher.reload).toHaveBeenCalled();
  });

  test('events for a different project do not trigger reloads', () => {
    jest.clearAllMocks();
    socketHandlers['task:created']({ projectName: 'other-proj' });
    expect(global.Kanban.reload).not.toHaveBeenCalled();
  });
});

// ── 7. Settings view ────────────────────────────────────────────────────────

describe('Settings view', () => {
  test('opening settings hides kanban-mount', () => {
    onOpenSettings({ name: 'proj-a' });
    expect(document.getElementById('kanban-mount').style.display).toBe('none');
  });

  test('opening settings hides list-mount', () => {
    onOpenSettings({ name: 'proj-a' });
    expect(document.getElementById('list-mount').style.display).toBe('none');
  });

  test('opening settings calls ProjectSettings.open', () => {
    onOpenSettings({ name: 'proj-a' });
    expect(global.ProjectSettings.open).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'proj-a' }),
      expect.any(Function)
    );
  });
});
