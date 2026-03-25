# Kaizen

File-based task board for developers working with AI coding assistants.

Tasks are plain Markdown files with YAML frontmatter stored in a centralized directory. A symlink at `{project}/.tasks` gives both humans and AI assistants direct access. Changes are reflected in real time in the web UI via WebSocket.

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

The port defaults to `3000`. You can override it by setting `port` in `config.json`.

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
