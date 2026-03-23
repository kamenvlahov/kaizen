'use strict';

const { detectProject, getProject } = require('../../server/services/projectManager');

/**
 * Resolve project name from --project option or cwd auto-detection.
 * Throws if project cannot be determined.
 */
function resolveProject(optionName) {
  if (optionName) {
    const p = getProject(optionName);
    if (!p) throw new Error(`Project "${optionName}" is not registered. Run: kaizen projects`);
    return p;
  }

  const detected = detectProject(process.cwd());
  if (!detected) {
    throw new Error(
      'Could not detect project from current directory.\n' +
      'Use --project <name> or run from inside a registered project directory.'
    );
  }
  return detected;
}

module.exports = resolveProject;
