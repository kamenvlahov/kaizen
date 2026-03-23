'use strict';

const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { getTasksDir } = require('../../server/services/projectManager');

module.exports = function edit(taskId, options) {
  try {
    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    const id = taskId.toUpperCase();
    const filePath = path.join(tasksDir, `${id}.md`);

    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Task "${taskId}" not found`));
    } else {
      console.error(chalk.red(`Error: ${err.message}`));
    }
    process.exit(1);
  }
};
