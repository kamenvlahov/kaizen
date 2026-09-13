# Kaizen

File-based task board for developers working with AI coding assistants.

Tasks are plain Markdown files with YAML frontmatter stored in a centralized directory. A symlink at `{project}/.tasks` gives both humans and AI assistants direct access. Changes are reflected in real time in the web UI via WebSocket.

## Requirements

- Node.js 18 or later
- npm
- [Ollama](https://ollama.com) (optional — required for AI task refinement)

## Installation

```bash
git clone git@github.com:kamenvlahov/kaizen.git
cd kaizen
npm install
npm link   # makes `kaizen` available globally
```

## Starting the server

```bash
npm start
# → http://localhost:3000
```

The port defaults to `3000`. You can override it by adding a `port` field to `config.json`:

```json
{
  "port": 4000,
  "projects": []
}
```

> `config.json` is created automatically on first `kaizen init` and is gitignored.

## CLI

### Project management

```bash
kaizen init --name <name> --path <path>   # Register a project
kaizen projects                           # List all registered projects
kaizen remove <name>                      # Unregister a project
```

### Task management

```bash
kaizen new [--project <name>]                          # Create task interactively
kaizen list [--project <name>] [--status <s>] [--priority <p>]
kaizen show <taskId> [--project <name>]
kaizen status <taskId> <newStatus> [--project <name>]
kaizen edit <taskId> [--project <name>]                # Opens $EDITOR
kaizen delete <taskId> [--project <name>]
```

**Valid statuses:** `backlog` · `todo` · `in-progress` · `review` · `done` · `blocked` · `archived`
**Valid priorities:** `critical` · `high` · `medium` · `low`

When running a command from inside a registered project directory the `--project` flag is optional — Kaizen auto-detects the project from the current working directory.

## API

Base URL: `http://localhost:3000/api`

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all registered projects |
| `GET` | `/api/projects/:name` | Get project details and task stats |
| `POST` | `/api/projects` | Register a new project — body: `{ "name": "", "path": "" }` |
| `DELETE` | `/api/projects/:name` | Unregister a project |
| `POST` | `/api/projects/:name/start-claude` | Open a new Windows Terminal tab in the project directory and start Claude Code |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:name/tasks` | List tasks. Query params: `status`, `priority`, `assignee`, `tag` |
| `GET` | `/api/projects/:name/tasks/:id` | Get a single task |
| `POST` | `/api/projects/:name/tasks` | Create a task |
| `PUT` | `/api/projects/:name/tasks/:id` | Full update |
| `PATCH` | `/api/projects/:name/tasks/:id` | Partial update |
| `DELETE` | `/api/projects/:name/tasks/:id` | Delete a task |

**Task body (POST/PUT):**

```json
{
  "title": "My task",
  "status": "todo",
  "priority": "medium",
  "assignee": "claude-code",
  "dependencies": ["TASK-001"],
  "tags": ["backend"],
  "estimate": "2h",
  "branch": "feature/my-task",
  "body": "## Description\n..."
}
```

### Board (Kanban)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:name/board` | Tasks grouped by status, sorted by priority |
| `PATCH` | `/api/projects/:name/board/move` | Move task to a new status — body: `{ "taskId": "TASK-001", "newStatus": "in-progress" }` |

### Utilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/browse?path=<path>` | Browse filesystem directories (used by the UI project registration form) |

## WebSocket events

Connect to `http://localhost:3000` with Socket.IO. The server emits these events when task files change on disk:

| Event | Payload |
|-------|---------|
| `task:created` | `{ project, task }` |
| `task:updated` | `{ project, task }` |
| `task:deleted` | `{ project, taskId }` |

You can also emit `project:changed` with `{ name }` to tell the server which project the client is currently viewing.

## Start Claude

The **▶ Start Claude** button appears in the top-right corner of the UI when a project is selected. Clicking it opens a new Windows Terminal tab, changes into the project directory, and launches `claude` (Claude Code CLI) — so you can start working on tasks immediately without leaving the browser.

**Requirements:**

- Running on Windows with WSL2
- [Windows Terminal](https://aka.ms/terminal) installed
- [Claude Code](https://claude.ai/code) CLI installed (`npm install -g @anthropic-ai/claude-code` or follow the official docs)

**How it works:**

1. Open the Kaizen UI at `http://localhost:3000`
2. Select a project from the sidebar
3. Click **▶ Start Claude** in the top-right corner
4. A new Windows Terminal tab opens in the project directory with Claude Code running

The button calls `POST /api/projects/:name/start-claude` on the server. The server converts the Linux path to a WSL2 UNC path (`\\wsl$\<distro>\...`) and spawns `wt.exe` with the `--startingDirectory` flag.

**Environment variables (optional):**

| Variable | Default | Description |
|----------|---------|-------------|
| `WSL_DISTRO_NAME` | `Ubuntu` | Name of your WSL2 distro |
| `WT_EXE` | `wt.exe` | Path to Windows Terminal executable |

## AI Task Refinement (Ollama)

Kaizen integrates with [Ollama](https://ollama.com) to let you refine tasks using a local LLM. When you open a task for editing in the UI, a **Refine** button sends the task title and description to Ollama, which returns a structured refinement with subtasks and suggested skills.

The refinement is **grounded in the target project** — Kaizen reads the project's own files and feeds them to the model, so it names real modules instead of inventing plausible-looking ones.

### Setup

1. Install Ollama: https://ollama.com/download

2. Pull a model (default is `qwen2.5:7b`):

   ```bash
   ollama pull qwen2.5:7b
   ```

3. Make sure Ollama is running before starting Kaizen:

   ```bash
   ollama serve
   ```

4. Start Kaizen as usual:

   ```bash
   npm start
   ```

To use a different model, set the `OLLAMA_MODEL` environment variable:

```bash
OLLAMA_MODEL=llama3.2 npm start
```

### How it works

The **Refine** button in the task edit panel calls `POST /api/ai/refine-task` with the task title, description, and optionally a task type. Ollama returns a JSON payload that is applied back to the edit form:

```json
{
  "refinedTitle": "...",
  "refinedDescription": "...",
  "subtasks": ["..."],
  "suggestedSkills": ["..."],
  "openQuestions": ["..."],
  "contextUsed": ["package.json", "CLAUDE.md", "file tree", "existing tasks"]
}
```

### Open questions

Rather than silently inventing an answer to something the task never specified, the model returns up to three `openQuestions` — scope, trigger conditions, unstated limits. They appear in the refine preview and, on **Apply**, are written into the task: an `**Open questions:**` block in the new-task form, or a dedicated `## Open Questions` section in the task body when refining an existing task (existing sections are left untouched).

A task with nothing genuinely unresolved returns an empty list. On a 7B model this is advisory, not exact — it occasionally asks about an already-clear task, which costs one click to ignore.

If Ollama is not running the server returns a `503` and the UI shows an error — the rest of Kaizen continues to work normally.

### Project context

When the request carries a `project` name, `server/services/projectContext.js` assembles a context block from the registered project's own directory and prepends it to the prompt. Sources, each with its own character budget:

| Source | What is sent |
|--------|--------------|
| `package.json` | Name, description, dependencies, devDependencies, scripts — the real tech stack |
| `CLAUDE.md` | The project's conventions and constraints (falls back to `README.md` if absent) |
| File tree | Directories and filenames to depth 4, skipping `node_modules`, `.git`, build output and other noise |
| Existing tasks | `TASK-NNN [status] Title` for every non-archived task, so the model avoids restating work already on the board |

No single directory can contribute more than 12 entries to the tree, so one folder full of generated fixtures cannot crowd out the actual source directories.

Context is read from disk on every request — nothing is cached, matching Kaizen's file-system-as-source-of-truth rule.

The response field `contextUsed` lists which sources were actually found, and the UI shows them as chips above the refined preview. Context gathering never fails a refinement: an unregistered project, a missing path or an unreadable file simply yields `"contextUsed": []` and the model is prompted without it.

**Note on small models:** grounding sharply improves file and module accuracy, but a 7B model can still occasionally name a technology that is not in the stack. Larger models via `OLLAMA_MODEL` reduce this.

### AI API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai/models` | List available Ollama models |
| `POST` | `/api/ai/refine-task` | Refine a task — body: `{ "title", "description", "type", "model", "project" }` |

The `model` field in the request body is optional and defaults to `OLLAMA_MODEL` env var or `qwen2.5:7b`.

The `project` field is optional — pass a registered project name to ground the refinement in that project's files. Omit it and the task is refined from its title and description alone.

## Task file format

Tasks live at `projects/{name}/tasks/TASK-NNN.md` (and are accessible via the `.tasks` symlink in each project root).

```markdown
---
id: TASK-001
title: My task
status: todo
priority: medium
assignee: claude-code   # claude-code | human | unassigned
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
dependencies: []
tags: []
estimate: "2h"
branch: "feature/my-task"
---

## Description

## Acceptance Criteria

## Subtasks

## Context

## Notes
```
