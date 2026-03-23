'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Scans a tasks directory and returns the next sequential TASK-NNN ID.
 * @param {string} tasksDir - Absolute path to the tasks directory
 * @returns {string} Next ID, e.g. "TASK-004"
 */
function nextId(tasksDir) {
  let max = 0;

  if (fs.existsSync(tasksDir)) {
    const files = fs.readdirSync(tasksDir);
    for (const file of files) {
      const match = file.match(/^TASK-(\d+)\.md$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
  }

  return `TASK-${String(max + 1).padStart(3, '0')}`;
}

module.exports = { nextId };
