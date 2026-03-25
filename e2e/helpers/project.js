'use strict';

/**
 * Helpers for creating and cleaning up test projects via the Kaizen API.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const BASE_URL = 'http://localhost:3001';

/**
 * Creates a temp directory + registers a project via the API.
 * Returns { name, path, tasksDir } for use in tests.
 */
async function createTestProject(request, suffix = '') {
  const name     = `e2e-test${suffix}-${Date.now()}`;
  const projPath = fs.mkdtempSync(path.join(os.tmpdir(), `kaizen-e2e-`));

  const res = await request.post(`${BASE_URL}/api/projects`, {
    data: { name, path: projPath },
  });

  if (res.status() !== 201) {
    throw new Error(`Failed to create test project: ${await res.text()}`);
  }

  const project = await res.json();
  return { name, path: projPath, tasksDir: project.tasksDir };
}

/**
 * Deletes a project via the API and removes its temp directory.
 */
async function deleteTestProject(request, name, projPath) {
  await request.delete(`${BASE_URL}/api/projects/${name}`);
  try { fs.rmSync(projPath, { recursive: true, force: true }); } catch (_) {}
}

/**
 * Creates a task in a project via the API.
 */
async function createTask(request, projectName, fields = {}) {
  const res = await request.post(`${BASE_URL}/api/projects/${projectName}/tasks`, {
    data: {
      title:    fields.title    || 'Smoke test task',
      status:   fields.status   || 'todo',
      priority: fields.priority || 'medium',
      assignee: fields.assignee || 'unassigned',
      ...fields,
    },
  });
  if (res.status() !== 201) {
    throw new Error(`Failed to create task: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Selects a project in the UI by opening the dropdown and clicking the item.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function selectProject(page, name) {
  await page.locator('#ps-btn').click();
  await page.locator(`.project-dropdown-item[data-name="${name}"]`).click();
  // Wait for Kanban/List to load
  await page.waitForTimeout(400);
}

module.exports = { createTestProject, deleteTestProject, createTask, selectProject };
