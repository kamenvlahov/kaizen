'use strict';

const path = require('path');
const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { parseTask } = require('../../server/services/taskParser');
const { getTasksDir } = require('../../server/services/projectManager');

module.exports = function show(taskId, options) {
  try {
    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    const id = taskId.toUpperCase();
    const filePath = path.join(tasksDir, `${id}.md`);

    const task = parseTask(filePath);

    console.log();
    console.log(chalk.bold.cyan(`${task.id} — ${task.title}`));
    console.log('─'.repeat(60));
    console.log(`Status     : ${chalk.yellow(task.status)}`);
    console.log(`Priority   : ${chalk.yellow(task.priority)}`);
    console.log(`Assignee   : ${task.assignee}`);
    if (task.estimate) console.log(`Estimate   : ${task.estimate}`);
    if (task.branch)   console.log(`Branch     : ${task.branch}`);
    if (task.tags && task.tags.length) console.log(`Tags       : ${task.tags.join(', ')}`);
    if (task.dependencies && task.dependencies.length) {
      console.log(`Depends on : ${task.dependencies.join(', ')}`);
    }
    console.log(`Created    : ${task.created}`);
    console.log(`Updated    : ${task.updated}`);
    console.log('─'.repeat(60));
    console.log(task.body);
    console.log();
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Task "${taskId}" not found`));
    } else {
      console.error(chalk.red(`Error: ${err.message}`));
    }
    process.exit(1);
  }
};
