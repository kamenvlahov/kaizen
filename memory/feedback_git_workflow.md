---
name: git_workflow_on_task_completion
description: Always commit and push before setting task status to review — do not skip this step
type: feedback
---

Before changing any task's status to `review`, always:
1. Stage and commit all task-related changes to the task's branch (`feature/tests`, `task/TASK-NNN`, etc.)
2. Push the branch to origin
3. Only then update the task frontmatter status to `review`

**Why:** The CLAUDE.md instructions explicitly state this order. Skipping it means work is on disk but not in version control when the task is handed off for review.

**How to apply:** At the end of every task, before touching the `status` field, run the git commit + push sequence. This is mandatory, not optional.
