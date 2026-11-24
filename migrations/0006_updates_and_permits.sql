-- 0006_updates_and_permits.sql
-- Merveille Designs: Published Updates, Internal Notes, Company Announcements, and Manual K-SMART Records.

-- 1. Project Updates (Logical update entry)
CREATE TABLE IF NOT EXISTS project_updates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id TEXT REFERENCES project_stages(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  current_published_version_id TEXT,
  is_retracted INTEGER NOT NULL DEFAULT 0,
  retraction_reason TEXT,
  retracted_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 2. Update Versions (Version snapshots with review & publication lifecycle)
CREATE TABLE IF NOT EXISTS update_versions (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  observed_date TEXT, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, IN_REVIEW, PUBLISHED, CHANGES_REQUESTED, RETRACTED
  review_feedback TEXT,
  published_at INTEGER,
  published_by_user_id TEXT REFERENCES users(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(update_id, version_number)
);

-- 3. Update Attachments (Files attached to a specific update version)
CREATE TABLE IF NOT EXISTS update_attachments (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES update_versions(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id),
  created_at INTEGER NOT NULL
);

-- 4. Project Internal Notes (Private to internal staff, strictly hidden from clients/consultants)
CREATE TABLE IF NOT EXISTS project_internal_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  attachment_file_id TEXT REFERENCES files(id),
  is_confidential INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. Company Announcements (Controlled announcements for targeted audiences)
CREATE TABLE IF NOT EXISTS company_announcements (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  audience_type TEXT NOT NULL DEFAULT 'SELECTED_PROJECTS', -- SELECTED_PROJECTS, SELECTED_CLIENTS, ALL_CLIENTS
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, RETRACTED
  published_at INTEGER,
  published_by_user_id TEXT REFERENCES users(id),
  retracted_at INTEGER,
  retraction_reason TEXT,
  created_at INTEGER NOT NULL
);

-- 6. Announcement Audiences (Targeted projects or clients for an announcement)
CREATE TABLE IF NOT EXISTS announcement_audiences (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES company_announcements(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  client_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

-- 7. K-SMART Milestones (Distinct Sanction and Completion records per project)
CREATE TABLE IF NOT EXISTS ksmart_milestones (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL, -- SANCTION, COMPLETION
  application_reference TEXT,
  tracking_label TEXT NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, IN_PROGRESS, AWAITING_RESPONSE, FOLLOW_UP_NEEDED, RECORDED_COMPLETE
  current_published_observation_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, milestone_type)
);

-- 8. K-SMART Observations (Manual dated observations with audit trail)
CREATE TABLE IF NOT EXISTS ksmart_observations (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES ksmart_milestones(id) ON DELETE CASCADE,
  observed_status_text TEXT NOT NULL,
  decision_date TEXT, -- YYYY-MM-DD
  last_checked_date TEXT NOT NULL, -- YYYY-MM-DD
  source_description TEXT NOT NULL,
  reference_url TEXT,
  staff_notes TEXT,
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  sharing_status TEXT NOT NULL DEFAULT 'INTERNAL', -- INTERNAL, SUBMITTED_FOR_SHARING, SHARED, RETURNED, RETRACTED
  manager_feedback TEXT,
  shared_at INTEGER,
  shared_by_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- 9. K-SMART Observation Files (Supports private vs client-shared evidence)
CREATE TABLE IF NOT EXISTS ksmart_observation_files (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES ksmart_observations(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id),
  is_client_shared INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
