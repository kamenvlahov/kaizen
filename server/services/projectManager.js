'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

/**
 * Normalize a user-supplied project path: expand a leading ~, make it absolute
 * and drop any trailing separator.
 *
 * The UI's path browser (`/api/browse`) already expands ~ when it suggests and
 * validates directories, so registration has to accept the same input —-
 * otherwise a path the form marked valid is rejected on submit.
 */
function normalizeProjectPath(projectPath) {
  if (!projectPath) return projectPath;
  let expanded = String(projectPath).trim();
  if (expanded === '~' || expanded.startsWith('~/')) {
    expanded = os.homedir() + expanded.slice(1);
  }
  return path.resolve(expanded);
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaults = { port: 3000, projects: [] };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
    return defaults;
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function listProjects() {
  return readConfig().projects;
}

function getProject(name) {
  return readConfig().projects.find(p => p.name === name) || null;
}

/**
 * Register a new project.
 * Creates central tasks dir, symlink, updates .gitignore, injects CLAUDE.md section.
 * @param {string} name
 * @param {string} projectPath
 * @param {object|null} gitConfig - Optional git integration config
 */
function registerProject(name, projectPath, gitConfig = null) {
  const config = readConfig();

  if (config.projects.find(p => p.name === name)) {
    throw new Error(`Project "${name}" is already registered`);
  }

  projectPath = normalizeProjectPath(projectPath);

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Path does not exist: ${projectPath}`);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${projectPath}`);
  }

  const tasksRelDir = `projects/${name}/tasks`;
  const tasksCentralDir = path.join(__dirname, '../../', tasksRelDir);
  const symlinkPath = path.join(projectPath, '.tasks');

  // 1. Create central tasks dir
  fs.mkdirSync(tasksCentralDir, { recursive: true });

  // 2. Create symlink (remove stale one first)
  try {
    if (fs.lstatSync(symlinkPath)) fs.unlinkSync(symlinkPath);
  } catch (_) {}
  fs.symlinkSync(tasksCentralDir, symlinkPath);

  // 3. Update .gitignore
  const gitignorePath = path.join(projectPath, '.gitignore');
  const gitignoreEntry = '.tasks\n';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.tasks')) {
      fs.appendFileSync(gitignorePath, `\n${gitignoreEntry}`);
    }
  } else {
    fs.writeFileSync(gitignorePath, gitignoreEntry);
  }

  // 4. Inject CLAUDE.md section
  injectClaudeMd(projectPath);

  // 5. Register in config.json
  const entry = {
    name,
    path: projectPath,
    tasksDir: tasksRelDir,
    registered: new Date().toISOString(),
  };
  if (gitConfig) entry.git = gitConfig;
  config.projects.push(entry);
  writeConfig(config);
}

/**
 * Update git config for a registered project.
 */
function updateGitConfig(name, gitConfig) {
  const config = readConfig();
  const project = config.projects.find(p => p.name === name);
  if (!project) throw new Error(`Project "${name}" not found`);
  project.git = gitConfig;
  writeConfig(config);
}

/**
 * Unregister a project (does NOT delete tasks).
 */
function unregisterProject(name) {
  const config = readConfig();
  const idx = config.projects.findIndex(p => p.name === name);
  if (idx === -1) throw new Error(`Project "${name}" not found`);

  config.projects.splice(idx, 1);
  writeConfig(config);
}

/**
 * Resolve tasks directory for a registered project.
 */
function getTasksDir(name) {
  const project = getProject(name);
  if (!project) throw new Error(`Project "${name}" not found`);
  return path.join(__dirname, '../../', project.tasksDir);
}

/**
 * Auto-detect project from a directory path (cwd detection).
 */
function detectProject(cwd) {
  const projects = listProjects();
  // Longest matching path wins (most specific)
  const match = projects
    .filter(p => cwd === p.path || cwd.startsWith(p.path + path.sep))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match || null;
}

function injectClaudeMd(projectPath) {
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  const templatePath = path.join(__dirname, '../../templates/claude-instructions.md');
  const injection = fs.readFileSync(templatePath, 'utf8');

  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    if (!content.includes('## Task System')) {
      fs.appendFileSync(claudeMdPath, `\n\n${injection}`);
    }
  } else {
    fs.writeFileSync(claudeMdPath, injection);
  }
}

module.exports = {
  readConfig,
  normalizeProjectPath,
  listProjects,
  getProject,
  registerProject,
  unregisterProject,
  updateGitConfig,
  getTasksDir,
  detectProject,
};
