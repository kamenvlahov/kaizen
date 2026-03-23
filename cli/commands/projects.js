'use strict';

const chalk = require('chalk');
const { listProjects } = require('../../server/services/projectManager');
const { parseAllTasks } = require('../../server/services/taskParser');
const { getTasksDir } = require('../../server/services/projectManager');
const path = require('path');

module.exports = function projects() {
  const list = listProjects();

  if (list.length === 0) {
    console.log(chalk.yellow('No projects registered. Run: kaizen init --name <name> --path <path>'));
    return;
  }

  console.log(chalk.bold('\nRegistered Projects\n'));

  for (const p of list) {
    let taskCount = '?';
    try {
      const tasks = parseAllTasks(getTasksDir(p.name));
      const byStatus = {};
      for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      const parts = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`);
      taskCount = tasks.length === 0 ? '0 tasks' : parts.join(', ');
    } catch (_) {}

    console.log(`  ${chalk.cyan(p.name.padEnd(20))} ${p.path}`);
    console.log(`  ${''.padEnd(20)} ${chalk.gray(taskCount)}`);
    console.log();
  }
};
