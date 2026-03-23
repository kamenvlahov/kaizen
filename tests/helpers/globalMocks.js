/**
 * Sets up global mocks for browser-loaded component scripts.
 * All components are IIFEs attached to window in the browser;
 * in tests we provide jest mock equivalents.
 */
function setupGlobalMocks() {
  global.API = {
    getProjects:  jest.fn().mockResolvedValue([]),
    getProject:   jest.fn().mockResolvedValue({}),
    getGitConfig: jest.fn().mockResolvedValue({
      enabled: false, platform: 'auto-detect', remoteUrl: '',
      token: '', baseBranch: 'main', reviewer: '',
    }),
    saveGitConfig: jest.fn().mockResolvedValue({}),
    testGitConfig: jest.fn().mockResolvedValue({ success: true, username: 'user' }),
    createProject: jest.fn().mockResolvedValue({}),
  };

  global.Kanban = {
    init:       jest.fn(),
    setProject: jest.fn().mockResolvedValue(undefined),
    reload:     jest.fn(),
  };

  global.ListView = {
    init:       jest.fn(),
    setProject: jest.fn().mockResolvedValue(undefined),
    reload:     jest.fn(),
  };

  global.TaskDetail      = { open: jest.fn() };
  global.TaskCreateModal = { open: jest.fn() };

  // socket.io global — triggered after script.onload
  global.io = jest.fn().mockReturnValue({
    on:   jest.fn(),
    emit: jest.fn(),
  });
}

/**
 * Intercepts the dynamic <script> injection in app.js that loads socket.io,
 * and fires onload synchronously so the IIFE can complete.
 */
function mockScriptInjection() {
  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'script') {
      // Intercept src assignment; fire onload on next tick
      Object.defineProperty(el, 'src', {
        set(val) { setTimeout(() => el.onload && el.onload(), 0); },
        get() { return ''; },
      });
    }
    return el;
  });
  // Prevent real script from being appended to head
  jest.spyOn(document.head, 'appendChild').mockImplementation(() => {});
}

module.exports = { setupGlobalMocks, mockScriptInjection };
