-- 0025_workspace_and_external_billing.sql
-- Stage N01: Canonical task subtasks/checklists/collaborators, private personal tasks,
-- and version-bound external-commercial clearance with cutover mode.

ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);
ALTER TABLE tasks ADD COLUMN section_label TEXT;
ALTER TABLE tasks ADD COLUMN source_external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source_ext ON tasks(org_id, source_external_id);

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_collaborators (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS personal_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'TODO', -- TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED, PROMOTED
  due_date TEXT, -- YYYY-MM-DD (self-managed personal date)
  section_label TEXT,
  parent_task_id TEXT REFERENCES personal_tasks(id),
  source_external_id TEXT,
  promoted_project_task_id TEXT REFERENCES tasks(id),
  completed_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_owner ON personal_tasks(owner_user_id, org_id, status);

CREATE TABLE IF NOT EXISTS personal_task_checklist_items (
  id TEXT PRIMARY KEY,
  personal_task_id TEXT NOT NULL REFERENCES personal_tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

ALTER TABLE organizations ADD COLUMN commercial_mode TEXT NOT NULL DEFAULT 'LEGACY_PORTAL';

CREATE TABLE IF NOT EXISTS external_commercial_clearances (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- QUOTATION, CHANGE_REQUEST
  entity_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  clearance_type TEXT NOT NULL, -- ADVANCE_RECEIVED, PAYMENT_CLEARED, WAIVED_BY_ADMIN, EXTERNAL_TERMS_MET
  external_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, CORRECTED, REVOKED
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  supersedes_clearance_id TEXT REFERENCES external_commercial_clearances(id),
  recorded_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ext_clearance_entity
  ON external_commercial_clearances(project_id, entity_type, entity_id, version_number, recorded_at DESC);
