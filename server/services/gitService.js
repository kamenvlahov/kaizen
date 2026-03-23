'use strict';

const { execSync } = require('child_process');
const https = require('https');

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * Get remote URL for a project path.
 */
function getRemoteUrl(projectPath) {
  try {
    return exec('git remote get-url origin', projectPath);
  } catch (_) {
    return null;
  }
}

/**
 * Auto-detect git platform from remote URL.
 * Returns 'gitlab', 'github', or null.
 */
function detectPlatform(remoteUrl) {
  if (!remoteUrl) return null;
  if (remoteUrl.includes('github.com')) return 'github';
  if (remoteUrl.includes('gitlab')) return 'gitlab';
  return null;
}

/**
 * Create a branch for a task.
 * Checks out baseBranch, pulls, then creates task/<taskId>.
 * If branch already exists, checks it out instead.
 * @returns {{ success: boolean, branch?: string, error?: string }}
 */
function createBranch(projectPath, taskId, baseBranch = 'main') {
  const branchName = `task/${taskId}`;
  try {
    exec(`git -C "${projectPath}" checkout ${baseBranch}`);
    exec(`git -C "${projectPath}" pull origin ${baseBranch}`);
  } catch (err) {
    return { success: false, error: `Failed to update base branch: ${err.message}` };
  }

  try {
    exec(`git -C "${projectPath}" checkout -b ${branchName}`);
  } catch (_) {
    // Branch already exists — check it out
    try {
      exec(`git -C "${projectPath}" checkout ${branchName}`);
    } catch (err) {
      return { success: false, error: `Failed to checkout branch: ${err.message}` };
    }
  }

  return { success: true, branch: branchName };
}

/**
 * Push branch and create MR/PR on the configured platform.
 * @returns {Promise<{ success: boolean, mrUrl?: string, error?: string }>}
 */
async function pushAndCreateMR(projectConfig, taskId, taskTitle, taskDescription) {
  const git = projectConfig.git;
  const branchName = `task/${taskId}`;

  try {
    exec(`git -C "${projectConfig.path}" push origin ${branchName}`);
  } catch (err) {
    return { success: false, error: `Push failed: ${err.message}` };
  }

  try {
    let mrUrl;
    if (git.platform === 'gitlab') {
      mrUrl = await createGitLabMR(git, branchName, taskId, taskTitle, taskDescription);
    } else if (git.platform === 'github') {
      mrUrl = await createGitHubPR(git, branchName, taskId, taskTitle, taskDescription);
    } else {
      return { success: false, error: `Unknown platform: ${git.platform}` };
    }
    return { success: true, mrUrl };
  } catch (err) {
    return { success: false, error: `MR/PR creation failed: ${err.message}` };
  }
}

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createGitLabMR(git, branchName, taskId, taskTitle, taskDescription) {
  const remoteUrl = git.remoteUrl;
  // Extract project namespace: https://gitlab.com/user/project.git → user/project
  const match = remoteUrl.match(/gitlab[^/]*\/(.+?)(?:\.git)?$/);
  if (!match) throw new Error('Cannot extract project path from GitLab remote URL');

  const projectPath = encodeURIComponent(match[1]);
  const hostname = new URL(remoteUrl.startsWith('http') ? remoteUrl : `https://${remoteUrl}`).hostname;

  const payload = JSON.stringify({
    source_branch: branchName,
    target_branch: git.baseBranch || 'main',
    title: `${taskId}: ${taskTitle}`,
    description: taskDescription || '',
  });

  return httpsPost({
    hostname,
    path: `/api/v4/projects/${projectPath}/merge_requests`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': git.token,
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload).then(json => json.web_url);
}

function createGitHubPR(git, branchName, taskId, taskTitle, taskDescription) {
  const remoteUrl = git.remoteUrl;
  // Extract owner/repo: https://github.com/owner/repo.git → owner, repo
  const match = remoteUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) throw new Error('Cannot extract owner/repo from GitHub remote URL');

  const [, owner, repo] = match;

  const payload = JSON.stringify({
    title: `${taskId}: ${taskTitle}`,
    body: taskDescription || '',
    head: branchName,
    base: git.baseBranch || 'main',
  });

  return httpsPost({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/pulls`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${git.token}`,
      'User-Agent': 'kaizen-task-manager',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload).then(json => json.html_url);
}

module.exports = { createBranch, pushAndCreateMR, detectPlatform, getRemoteUrl };
