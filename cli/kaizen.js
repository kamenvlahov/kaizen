#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('path');

program
  .name('kaizen')
  .description('File-based task board for AI-assisted development')
  .version('1.0.0');

// ── Projects ──────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Register a project with the task board')
  .requiredOption('--name <name>', 'Project name')
  .requiredOption('--path <path>', 'Absolute path to the project')
  .action(require('./commands/init'));

program
  .command('projects')
  .description('List all registered projects')
  .action(require('./commands/projects'));

program
  .command('remove <name>')
  .description('Unregister a project (does not delete tasks)')
  .action(require('./commands/remove'));

// ── Tasks ─────────────────────────────────────────────────────────────────────

program
  .command('new')
  .description('Create a new task interactively')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .action(require('./commands/new'));

program
  .command('list')
  .description('List tasks')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .option('--status <status>', 'Filter by status')
  .option('--priority <priority>', 'Filter by priority')
  .action(require('./commands/list'));

program
  .command('show <taskId>')
  .description('Show task details')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .action(require('./commands/show'));

program
  .command('status <taskId> <newStatus>')
  .description('Change task status')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .action(require('./commands/status'));

program
  .command('edit <taskId>')
  .description('Open task in $EDITOR')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .action(require('./commands/edit'));

program
  .command('delete <taskId>')
  .description('Delete a task')
  .option('--project <name>', 'Project name (default: auto-detect from cwd)')
  .action(require('./commands/delete'));

program.parse();
