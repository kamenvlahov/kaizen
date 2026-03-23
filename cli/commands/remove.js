'use strict';

const chalk = require('chalk');
const { unregisterProject } = require('../../server/services/projectManager');

module.exports = function remove(name) {
  try {
    unregisterProject(name);
    console.log(chalk.green(`✓ Project "${name}" removed from registry`));
    console.log(chalk.gray('  (Task files were not deleted)'));
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
};
