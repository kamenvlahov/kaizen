'use strict';

const chalk = require('chalk');
const resolveProject = require('./_resolveProject');
const { nextId } = require('../../server/utils/idGenerator');
const { writeTask } = require('../../server/services/taskWriter');
const { parseAllTasks } = require('../../server/services/taskParser');
const { getTasksDir } = require('../../server/services/projectManager');

module.exports = async function newTask(options) {
  const { default: inquirer } = await import('inquirer');

  try {
    const project = resolveProject(options.project);
    const tasksDir = getTasksDir(project.name);
    const existingTasks = parseAllTasks(tasksDir);
    const existingIds = existingTasks.map(t => t.id);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Title:',
        validate: v => v.trim() ? true : 'Title is required',
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Priority:',
        choices: ['critical', 'high', 'medium', 'low'],
        default: 'medium',
      },
      {
        type: 'list',
        name: 'assignee',
        message: 'Assignee:',
        choices: ['claude-code', 'human', 'unassigned'],
        default: 'claude-code',
      },
      {
        type: 'input',
        name: 'tags',
        message: 'Tags (comma-separated, optional):',
      },
      {
        type: 'checkbox',
        name: 'dependencies',
        message: 'Dependencies (tasks that must be done first):',
        choices: existingIds,
        when: existingIds.length > 0,
      },
      {
        type: 'input',
        name: 'estimate',
        message: 'Estimate (e.g. 2h, 1d — optional):',
      },
      {
        type: 'input',
        name: 'branch',
        message: 'Git branch (optional):',
      },
      {
        type: 'editor',
        name: 'description',
        message: 'Description (opens $EDITOR — optional):',
        default: '',
      },
    ]);

    const id = nextId(tasksDir);
    const now = new Date().toISOString();

    const tags = answers.tags
      ? answers.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const body = buildBody(answers.description);

    writeTask(tasksDir, {
      id,
      title: answers.title.trim(),
      status: 'todo',
      priority: answers.priority,
      created: now,
      updated: now,
      assignee: answers.assignee,
      dependencies: answers.dependencies || [],
      tags,
      estimate: answers.estimate.trim() || null,
      branch: answers.branch.trim() || null,
      body,
    });

    console.log(chalk.green(`\n✓ Created ${chalk.cyan(id)}: ${answers.title.trim()}`));
    console.log(chalk.gray(`  ${tasksDir}/${id}.md`));
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
};

function buildBody(description) {
  const desc = description && description.trim() ? description.trim() : '';
  return `## Description

${desc}

## Acceptance Criteria

- [ ]

## Subtasks

- [ ]

## Context

## Notes
`;
}
