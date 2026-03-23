'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');

// GET /api/browse?path=/home/user/pro
router.get('/', (req, res) => {
  const inputPath = req.query.path || os.homedir();

  // Expand ~
  let expandedPath = inputPath;
  if (expandedPath === '~' || expandedPath.startsWith('~/')) {
    expandedPath = os.homedir() + expandedPath.slice(1);
  }

  // Split into parent dir + partial name filter
  let parentDir, filter;
  if (expandedPath.endsWith('/') || expandedPath.endsWith(path.sep)) {
    parentDir = expandedPath;
    filter = '';
  } else {
    parentDir = path.dirname(expandedPath);
    filter = path.basename(expandedPath).toLowerCase();
  }

  try {
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const directories = entries
      .filter(d => d.isDirectory() && d.name.toLowerCase().startsWith(filter))
      .slice(0, 20)
      .map(d => ({ name: d.name, path: path.join(parentDir, d.name) }));

    res.json({ resolved: expandedPath, directories });
  } catch (_err) {
    res.json({ resolved: null, directories: [], error: 'Directory not found' });
  }
});

module.exports = router;
