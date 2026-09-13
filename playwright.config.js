'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    headless: false,
    launchOptions: {
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
  },
  webServer: {
    command: 'PORT=3001 node server/index.js',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
