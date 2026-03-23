## Task System

This project uses a file-based task management system. Tasks are in `.tasks/` directory.

### Reading Tasks

- Check `.tasks/` for your assigned tasks (assignee: claude-code)
- Parse YAML frontmatter for metadata (status, priority, dependencies)
- Read Markdown body for requirements (Description, Acceptance Criteria, Subtasks, Context)
- Respect dependency order — do not start a task if its dependencies are not `done`

### Working on Tasks

1. Before starting: change status to `in-progress` (update frontmatter `status` field)
2. Update `updated` timestamp when modifying a task
3. Check off subtasks as you complete them (`- [x]`)
4. Add progress notes in the `## Notes` section
5. When finished: change status to `review`

### Task Format

Tasks use YAML frontmatter (between `---` markers) + Markdown body.
Frontmatter fields: id, title, status, priority, created, updated, assignee, dependencies, tags, estimate, branch.
Body sections: ## Description, ## Acceptance Criteria, ## Subtasks, ## Context, ## Notes.

### Rules

- NEVER change a task's `id` or `created` fields
- ALWAYS update `updated` timestamp on any modification
- NEVER start a task with unfinished dependencies (status != done)
- ALWAYS mark status as `review` (not `done`) when you finish — human reviews and marks done
- If blocked, change status to `blocked` and explain in ## Notes
