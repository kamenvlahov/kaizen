'use strict';

const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { parseAllTasks } = require('../../server/services/taskParser');
const { getTasksDir } = require('../../server/services/projectManager');

const PRIORITY_COLOR = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.gray,
};

const STATUS_COLOR = {
  todo: chalk.gray,
  'in-progress': chalk.blue,
  review: chalk.yellow,
  done: chalk.green,
  blocked: chalk.red,
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

module.exports = function list(options) {
  try {
    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    let tasks = parseAllTasks(tasksDir);

    if (options.status) tasks = tasks.filter(t => t.status === options.status);
    if (options.priority) tasks = tasks.filter(t => t.priority === options.priority);

    tasks.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found.'));
      return;
    }

    console.log(chalk.bold(`\nProject: ${project.name}  (${tasks.length} tasks)\n`));

    const idW = 10, titleW = 40, statusW = 12, priorityW = 10, assigneeW = 14;
    const header =
      'ID'.padEnd(idW) +
      'Title'.padEnd(titleW) +
      'Status'.padEnd(statusW) +
      'Priority'.padEnd(priorityW) +
      'Assignee'.padEnd(assigneeW) +
      'Tags';
    console.log(chalk.bold(header));
    console.log('─'.repeat(header.length));

    for (const t of tasks) {
      const statusFn = STATUS_COLOR[t.status] || chalk.white;
      const priorityFn = PRIORITY_COLOR[t.priority] || chalk.white;
      const title = t.title.length > titleW - 2 ? t.title.slice(0, titleW - 4) + '…' : t.title;
      const row =
        chalk.cyan(t.id.padEnd(idW)) +
        title.padEnd(titleW) +
        statusFn(t.status.padEnd(statusW)) +
        priorityFn(t.priority.padEnd(priorityW)) +
        chalk.gray(t.assignee.padEnd(assigneeW)) +
        chalk.gray((t.tags || []).join(', '));
      console.log(row);
    }
    console.log();
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
};
