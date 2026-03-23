'use strict';

const path = require('path');
const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { parseTask, VALID_STATUSES } = require('../../server/services/taskParser');
const { updateTask } = require('../../server/services/taskWriter');
const { getTasksDir } = require('../../server/services/projectManager');

module.exports = function status(taskId, newStatus, options) {
  try {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    const id = taskId.toUpperCase();
    const filePath = path.join(tasksDir, `${id}.md`);

    const task = parseTask(filePath);
    const oldStatus = task.status;

    updateTask(filePath, { status: newStatus });

    console.log(chalk.green(`✓ ${id}: ${chalk.gray(oldStatus)} → ${chalk.yellow(newStatus)}`));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Task "${taskId}" not found`));
    } else {
      console.error(chalk.red(`Error: ${err.message}`));
    }
    process.exit(1);
  }
};
