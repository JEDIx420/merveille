-- 0002_projects_and_enquiries.sql
-- Merveille Designs: Enquiries, Feasibility Studies, Project Stages, and Lifecycle Events.

-- 1. Enquiries Table
CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_account_id TEXT REFERENCES client_accounts(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  site_location TEXT NOT NULL,
  requirements_text TEXT,
  lead_manager_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, REQUIREMENTS_REVIEW, FEASIBILITY_REVIEW, QUOTE_PREPARATION, ON_HOLD, LOST, DECLINED, CONVERTED
  decline_reason TEXT,
  linked_project_id TEXT REFERENCES projects(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 2. Feasibility Studies Table
CREATE TABLE IF NOT EXISTS feasibility_studies (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  observations TEXT NOT NULL,
  site_constraints TEXT,
  recommendations TEXT NOT NULL,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, COMPLETED
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- 3. Project Stages Table (Ordered workflow phases for a project)
CREATE TABLE IF NOT EXISTS project_stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  planned_start_date TEXT,
  planned_completion_date TEXT,
  actual_completion_date TEXT,
  completed_by_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED
  revision INTEGER NOT NULL DEFAULT 1
);

-- 4. Project Lifecycle Events (Audit history for stage completions, pause, resume, cancel)
CREATE TABLE IF NOT EXISTS project_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL, -- STAGE_COMPLETED, PROJECT_PAUSED, PROJECT_RESUMED, PROJECT_ACTIVATED, PROJECT_COMPLETED, PROJECT_CANCELLED
  old_state TEXT,
  new_state TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- 5. Extend Projects Table with Commercial Activation Gates if needed
-- D1 SQLite supports ADD COLUMN
ALTER TABLE projects ADD COLUMN site_location TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN quote_accepted_at INTEGER;
ALTER TABLE projects ADD COLUMN advance_confirmed_at INTEGER;
ALTER TABLE projects ADD COLUMN activated_at INTEGER;
ALTER TABLE projects ADD COLUMN activated_by_user_id TEXT REFERENCES users(id);
ALTER TABLE projects ADD COLUMN pause_reason TEXT;
ALTER TABLE projects ADD COLUMN cancel_reason TEXT;
