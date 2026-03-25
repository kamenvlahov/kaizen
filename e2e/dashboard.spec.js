'use strict';

/**
 * Smoke tests — Dashboard (Playwright E2E)
 *
 * Each test group spins up a real server (via playwright.config.js webServer),
 * registers a temporary project via the API, and drives a real Chromium browser.
 * No login — the app opens directly on the dashboard.
 */

const { test, expect } = require('@playwright/test');
const { createTestProject, deleteTestProject, createTask, selectProject } = require('./helpers/project');

// ── Shared state ─────────────────────────────────────────────────────────────

let proj;

test.beforeEach(async ({ request }) => {
  proj = await createTestProject(request);
});

test.afterEach(async ({ request }) => {
  if (proj) await deleteTestProject(request, proj.name, proj.path);
});

// ── 1. Page loads ─────────────────────────────────────────────────────────────

test.describe('Page load', () => {
  test('dashboard renders without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('topbar is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#topbar')).toBeVisible();
  });

  test('logo text is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toContainText('kaizen');
  });

  test('Kanban tab is active by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.tab-btn[data-view="kanban"]')).toHaveClass(/active/);
  });

  test('New Task button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#new-task-btn')).toBeVisible();
  });

  test('WebSocket indicator is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ws-indicator')).toBeVisible();
  });

  test('WebSocket connects and indicator turns green', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ws-indicator')).toHaveClass(/connected/, { timeout: 5000 });
  });
});

// ── 2. Project switcher ───────────────────────────────────────────────────────

test.describe('Project switcher', () => {
  test('registered project appears in the switcher', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#project-switcher-mount')).toContainText(proj.name, { timeout: 5000 });
  });

  test('selecting a project shows start-claude-btn', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await selectProject(page, proj.name);
    await expect(page.locator('#start-claude-btn')).toBeVisible({ timeout: 3000 });
  });
});

// ── 3. Tab switching ──────────────────────────────────────────────────────────

test.describe('Tab switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await selectProject(page, proj.name);
  });

  test('clicking List tab shows list-mount', async ({ page }) => {
    await page.locator('.tab-btn[data-view="list"]').click();
    await expect(page.locator('#list-mount')).toBeVisible();
  });

  test('clicking List tab hides kanban-mount', async ({ page }) => {
    await page.locator('.tab-btn[data-view="list"]').click();
    await expect(page.locator('#kanban-mount')).toBeHidden();
  });

  test('clicking Kanban tab restores kanban-mount', async ({ page }) => {
    await page.locator('.tab-btn[data-view="list"]').click();
    await page.locator('.tab-btn[data-view="kanban"]').click();
    await expect(page.locator('#kanban-mount')).toBeVisible();
  });

  test('active tab has "active" class', async ({ page }) => {
    await page.locator('.tab-btn[data-view="list"]').click();
    await expect(page.locator('.tab-btn[data-view="list"]')).toHaveClass(/active/);
    await expect(page.locator('.tab-btn[data-view="kanban"]')).not.toHaveClass(/active/);
  });
});

// ── 4. Kanban board ───────────────────────────────────────────────────────────

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page, request }) => {
    await createTask(request, proj.name, { title: 'Smoke task alpha', status: 'todo', priority: 'high' });
    await createTask(request, proj.name, { title: 'Smoke task beta',  status: 'in-progress', priority: 'medium' });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await selectProject(page, proj.name);
  });

  test('renders Kanban columns', async ({ page }) => {
    const cols = page.locator('.kanban-col');
    await expect(cols).toHaveCount(7); // backlog, todo, in-progress, review, done, blocked, archived
  });

  test('Todo column contains the todo task', async ({ page }) => {
    const todoCol = page.locator('.kanban-col[data-status="todo"]');
    await expect(todoCol).toContainText('Smoke task alpha');
  });

  test('In Progress column contains the in-progress task', async ({ page }) => {
    const ipCol = page.locator('.kanban-col[data-status="in-progress"]');
    await expect(ipCol).toContainText('Smoke task beta');
  });

  test('task card shows priority badge', async ({ page }) => {
    const card = page.locator('.task-card').filter({ hasText: 'Smoke task alpha' });
    await expect(card.locator('.card-priority-badge')).toContainText('high');
  });

  test('clicking a task card opens the detail overlay', async ({ page }) => {
    await page.locator('.task-card').filter({ hasText: 'Smoke task alpha' }).click();
    await expect(page.locator('#task-detail-overlay')).not.toHaveClass(/hidden/);
  });
});

// ── 5. New Task modal ─────────────────────────────────────────────────────────

test.describe('New Task modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await selectProject(page, proj.name);
  });

  test('clicking + New Task opens the create overlay', async ({ page }) => {
    await page.locator('#new-task-btn').click();
    await expect(page.locator('#task-create-overlay')).not.toHaveClass(/hidden/);
  });

  test('creating a task adds a card to the Kanban board', async ({ page }) => {
    await page.locator('#new-task-btn').click();

    await page.locator('#tc-title').fill('E2E created task');
    await page.locator('#tc-create').click();

    // Board should reload and show the new card
    await expect(page.locator('.task-card').filter({ hasText: 'E2E created task' })).toBeVisible({ timeout: 5000 });
  });
});

// ── 6. List view ──────────────────────────────────────────────────────────────

test.describe('List view', () => {
  test.beforeEach(async ({ page, request }) => {
    await createTask(request, proj.name, { title: 'List view task', status: 'todo' });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await selectProject(page, proj.name);
    await page.locator('.tab-btn[data-view="list"]').click();
    await page.waitForTimeout(300);
  });

  test('renders a row for each task', async ({ page }) => {
    await expect(page.locator('#list-mount')).toContainText('List view task');
  });

  test('clicking a task row opens detail overlay', async ({ page }) => {
    await page.locator('#list-mount').getByText('List view task').click();
    await expect(page.locator('#task-detail-overlay')).not.toHaveClass(/hidden/);
  });
});
