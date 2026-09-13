'use strict';

const fs = require('fs');
const path = require('path');
const { getProject, getTasksDir } = require('./projectManager');
const { parseAllTasks } = require('./taskParser');

// Character budgets per source — keeps the assembled prompt within a small
// local model's context window.
const LIMITS = {
  claudeMd: 2500,
  readme: 1200,
  packageJson: 800,
  tree: 1800,
  tasks: 1500,
};

// One noisy directory (generated fixtures, per-run output) must not starve the
// rest of the tree out of the character budget.
const MAX_ENTRIES_PER_DIR = 12;

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
  'vendor', '__pycache__', '.venv', 'venv', 'target', 'test-results',
  '.cache', '.idea', '.vscode', 'tmp', '.tasks',
]);

function truncate(text, max) {
  if (!text) return '';
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + `\n… [truncated, ${clean.length - max} more chars]`;
}

function readFileIfExists(filePath, max) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return truncate(fs.readFileSync(filePath, 'utf8'), max);
  } catch (_) {
    return null;
  }
}

/**
 * Summarize package.json into stack-relevant lines rather than dumping it whole.
 */
function readPackageSummary(projectPath) {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const lines = [];
    if (pkg.name) lines.push(`name: ${pkg.name}`);
    if (pkg.description) lines.push(`description: ${pkg.description}`);
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    if (deps.length) lines.push(`dependencies: ${deps.join(', ')}`);
    if (devDeps.length) lines.push(`devDependencies: ${devDeps.join(', ')}`);
    const scripts = Object.keys(pkg.scripts || {});
    if (scripts.length) lines.push(`scripts: ${scripts.join(', ')}`);
    return truncate(lines.join('\n'), LIMITS.packageJson);
  } catch (_) {
    return null;
  }
}

/**
 * Shallow directory tree so the model can name real files and modules instead
 * of inventing plausible-looking paths.
 */
function buildTree(projectPath, maxDepth = 4) {
  const lines = [];

  function walk(dir, prefix, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    const dirs = entries
      .filter(e => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const d of dirs.slice(0, MAX_ENTRIES_PER_DIR)) {
      lines.push(`${prefix}${d.name}/`);
      walk(path.join(dir, d.name), prefix + '  ', depth + 1);
    }
    if (dirs.length > MAX_ENTRIES_PER_DIR) {
      lines.push(`${prefix}… ${dirs.length - MAX_ENTRIES_PER_DIR} more directories`);
    }

    for (const f of files.slice(0, MAX_ENTRIES_PER_DIR)) {
      lines.push(`${prefix}${f.name}`);
    }
    if (files.length > MAX_ENTRIES_PER_DIR) {
      lines.push(`${prefix}… ${files.length - MAX_ENTRIES_PER_DIR} more files`);
    }
  }

  walk(projectPath, '', 1);
  return truncate(lines.join('\n'), LIMITS.tree);
}

/**
 * Existing tasks as id/status/title lines — lets the model avoid duplicating
 * work and reference sibling tasks by ID.
 */
function buildTaskList(projectName) {
  try {
    const tasksDir = getTasksDir(projectName);
    const tasks = parseAllTasks(tasksDir);
    if (!tasks.length) return null;
    const lines = tasks
      .filter(t => t.status !== 'archived')
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(t => `${t.id} [${t.status}] ${t.title}`);
    return truncate(lines.join('\n'), LIMITS.tasks);
  } catch (_) {
    return null;
  }
}

/**
 * Gather everything known about a registered project into a prompt-ready block.
 * Never throws — an unregistered or unreadable project yields a null context so
 * refinement still runs without it.
 *
 * @param {string} projectName
 * @returns {{ text: string, sources: string[], projectPath: string } | null}
 */
function build(projectName) {
  if (!projectName) return null;

  const project = getProject(projectName);
  if (!project || !project.path || !fs.existsSync(project.path)) return null;

  const sections = [];
  const sources = [];

  sections.push(`Project name: ${project.name}\nProject path: ${project.path}`);

  const pkg = readPackageSummary(project.path);
  if (pkg) {
    sections.push(`### package.json\n${pkg}`);
    sources.push('package.json');
  }

  const claudeMd = readFileIfExists(path.join(project.path, 'CLAUDE.md'), LIMITS.claudeMd);
  if (claudeMd) {
    sections.push(`### CLAUDE.md (project conventions)\n${claudeMd}`);
    sources.push('CLAUDE.md');
  }

  // README adds little once CLAUDE.md is present — only read it as a fallback.
  if (!claudeMd) {
    const readme = readFileIfExists(path.join(project.path, 'README.md'), LIMITS.readme);
    if (readme) {
      sections.push(`### README.md\n${readme}`);
      sources.push('README.md');
    }
  }

  const tree = buildTree(project.path);
  if (tree) {
    sections.push(`### Directory structure\n${tree}`);
    sources.push('file tree');
  }

  const tasks = buildTaskList(project.name);
  if (tasks) {
    sections.push(`### Existing tasks on the board\n${tasks}`);
    sources.push('existing tasks');
  }

  return {
    text: sections.join('\n\n'),
    sources,
    projectPath: project.path,
  };
}

module.exports = { build, LIMITS };
