'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const chalk = require('chalk');
const { registerProject } = require('../../server/services/projectManager');

module.exports = async function init(options) {
  const name = options.name.trim();

  // Expand ~ and resolve relative paths
  let rawPath = options.path;
  if (rawPath === '~' || rawPath.startsWith('~/')) {
    rawPath = os.homedir() + rawPath.slice(1);
  }
  const projectPath = path.resolve(rawPath);

  if (!fs.existsSync(projectPath)) {
    console.error(chalk.red(`Error: Directory does not exist: ${projectPath}`));
    process.exit(1);
  }

  console.log(`  Resolved  : ${chalk.cyan(projectPath)}`);

  try {
    registerProject(name, projectPath);
    console.log(chalk.green(`✓ Project "${name}" registered`));
    console.log(`  Tasks dir : ${chalk.cyan(`projects/${name}/tasks/`)}`);
    console.log(`  Symlink   : ${chalk.cyan(`${projectPath}/.tasks`)}`);
    console.log(`  CLAUDE.md : ${chalk.cyan('injected task system instructions')}`);
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
};
