'use strict';

const path = require('path');
const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { parseTask, VALID_STATUSES } = require('../../server/services/taskParser');
const { updateTask } = require('../../server/services/taskWriter');
const { getTasksDir, getProject } = require('../../server/services/projectManager');
const gitService = require('../../server/services/gitService');

module.exports = async function status(taskId, newStatus, options) {
  try {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const projectMeta = resolveProject(options.project);
    const project = getProject(projectMeta.name);
    const tasksDir = getTasksDir(project.name);
    const id = taskId.toUpperCase();
    const filePath = path.join(tasksDir, `${id}.md`);

    const task = parseTask(filePath);
    const oldStatus = task.status;

    updateTask(filePath, { status: newStatus });

    console.log(chalk.green(`✓ ${id}: ${chalk.gray(oldStatus)} → ${chalk.yellow(newStatus)}`));

    // Git integration
    if (project.git && project.git.enabled) {
      if (newStatus === 'in-progress') {
        const result = gitService.createBranch(project.path, id, project.git.baseBranch);
        if (result.success) {
          updateTask(filePath, { branch: result.branch });
          console.log(chalk.cyan(`  Branch: ${result.branch}`));
        } else {
          console.log(chalk.yellow(`  Warning: Branch creation failed: ${result.error}`));
        }
      } else if (newStatus === 'review') {
        const currentTask = parseTask(filePath);
        const result = await gitService.pushAndCreateMR(
          project,
          id,
          currentTask.title,
          currentTask.body
        );
        if (result.success) {
          updateTask(filePath, { mr_url: result.mrUrl });
          console.log(chalk.cyan(`  MR: ${result.mrUrl}`));
        } else {
          console.log(chalk.yellow(`  Warning: MR creation failed: ${result.error}`));
        }
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Task "${taskId}" not found`));
    } else {
      console.error(chalk.red(`Error: ${err.message}`));
    }
    process.exit(1);
  }
};
