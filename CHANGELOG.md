# Changelog

All notable changes to Kaizen will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-23

### Added

- File-based task management using plain Markdown files with YAML frontmatter
- Centralized task storage at `projects/{name}/tasks/` with `.tasks` symlink in each project root
- CLI (`kaizen`) with commands: `init`, `projects`, `remove`, `new`, `list`, `show`, `status`, `edit`, `delete`
- Auto-detection of the active project from the current working directory
- Express REST API with endpoints for projects, tasks, board (Kanban), and filesystem browsing
- Kanban board view in the web UI grouped by status and sorted by priority
- List view in the web UI with filtering support
- Real-time sync via Socket.IO — file changes on disk are immediately reflected in the browser
- File watcher using chokidar that emits `task:created`, `task:updated`, and `task:deleted` events
- `CLAUDE.md` template auto-injected into each registered project to give AI assistants context
- `.gitignore` updated automatically on `kaizen init` to exclude `config.json` and `projects/`
- Board move endpoint (`PATCH /api/projects/:name/board/move`) for drag-and-drop status changes
- Task filtering by `status`, `priority`, `assignee`, and `tag` via query parameters
- Configurable server port via `port` field in `config.json`
