/**
 * Evaluates a vanilla JS IIFE component file and assigns its result to
 * the global scope so tests can access it as global.ComponentName.
 *
 * Component files use the pattern:
 *   const ComponentName = (() => { ... return { ... }; })();
 *
 * Inside eval(), `const` is scoped to the eval call and does not reach
 * global. This helper rewrites the top-level `const X =` to `global.X =`
 * so the component is reachable after eval.
 */
const fs   = require('fs');
const path = require('path');

function loadVanilla(filePath) {
  const source   = fs.readFileSync(path.resolve(__dirname, '../..', filePath), 'utf8');
  const modified = source.replace(/^\s*const\s+(\w+)\s*=/m, 'global.$1 =');
  // eslint-disable-next-line no-eval
  eval(modified);
}

module.exports = { loadVanilla };
