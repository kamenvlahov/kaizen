'use strict';

const path = require('path');
const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { deleteTask } = require('../../server/services/taskWriter');
const { getTasksDir } = require('../../server/services/projectManager');

module.exports = async function del(taskId, options) {
  const { default: inquirer } = await import('inquirer');

  try {
    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    const id = taskId.toUpperCase();
    const filePath = path.join(tasksDir, `${id}.md`);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Delete ${chalk.cyan(id)}? This cannot be undone.`,
      default: false,
    }]);

    if (!confirm) {
      console.log(chalk.gray('Cancelled.'));
      return;
    }

    deleteTask(filePath);
    console.log(chalk.green(`✓ ${id} deleted`));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Task "${taskId}" not found`));
    } else {
      console.error(chalk.red(`Error: ${err.message}`));
    }
    process.exit(1);
  }
};
