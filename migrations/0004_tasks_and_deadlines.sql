-- 0004_tasks_and_deadlines.sql
-- Merveille Designs: Tasks, Manager-controlled Deadlines, Reopening, and Internal Evidence.

-- 1. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id TEXT REFERENCES project_stages(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
  status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT', -- PENDING_ASSIGNMENT, TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED
  creator_user_id TEXT NOT NULL REFERENCES users(id),
  assignee_user_id TEXT REFERENCES users(id),
  original_due_date TEXT, -- YYYY-MM-DD
  effective_due_date TEXT, -- YYYY-MM-DD
  completed_at INTEGER,
  completed_by_user_id TEXT REFERENCES users(id),
  blocker_reason TEXT,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 2. Task Events Table (Audit history for deadlines, reassignments, completions, reopens)
CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL, -- TASK_CREATED, TASK_ASSIGNED, TASK_STARTED, TASK_BLOCKED, TASK_UNBLOCKED, TASK_COMPLETED, TASK_REOPENED, TASK_CANCELLED, TASK_DEADLINE_CHANGED, TASK_ASSIGNMENT_CHANGED
  old_state TEXT,
  new_state TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- 3. Task Comments Table (Internal discussions and reference attachments)
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  attachment_file_id TEXT REFERENCES files(id),
  created_at INTEGER NOT NULL
);
