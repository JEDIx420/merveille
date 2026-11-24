-- 0010_site_issues_and_snags.sql
-- Merveille Designs: Site Issues, Snag Tracking, Evidence, Verified Closure, and Confidential Remediation Notes.

-- 1. Snags / Site Issues
CREATE TABLE IF NOT EXISTS snags (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snag_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_area TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
  status TEXT NOT NULL DEFAULT 'REPORTED', -- REPORTED, OPEN, IN_PROGRESS, BLOCKED, READY_FOR_VERIFICATION, CLOSED, REOPENED, DUPLICATE, NOT_ACCEPTED
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  reported_at INTEGER NOT NULL,
  assigned_to_user_id TEXT REFERENCES users(id),
  assigned_by_user_id TEXT REFERENCES users(id),
  target_date TEXT,
  related_drawing_id TEXT REFERENCES drawings(id),
  is_client_shared INTEGER NOT NULL DEFAULT 0,
  is_charged_work INTEGER NOT NULL DEFAULT 0,
  change_request_id TEXT REFERENCES change_requests(id),
  internal_cost_minor INTEGER,
  internal_notes TEXT,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Snag Attachments (Before/after photos, verification evidence)
CREATE TABLE IF NOT EXISTS snag_attachments (
  id TEXT PRIMARY KEY,
  snag_id TEXT NOT NULL REFERENCES snags(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id),
  attachment_type TEXT NOT NULL DEFAULT 'BEFORE_PHOTO', -- BEFORE_PHOTO, AFTER_PHOTO, EVIDENCE
  is_internal_only INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- 3. Snag Audit Events (Transitions, triage, resolution, verification, reopens)
CREATE TABLE IF NOT EXISTS snag_events (
  id TEXT PRIMARY KEY,
  snag_id TEXT NOT NULL REFERENCES snags(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  notes TEXT,
  resolution_evidence TEXT,
  created_at INTEGER NOT NULL
);

-- 4. Snag Comments (Threaded communication with internal isolation)
CREATE TABLE IF NOT EXISTS snag_comments (
  id TEXT PRIMARY KEY,
  snag_id TEXT NOT NULL REFERENCES snags(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  is_internal_only INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 5. Link Tasks to Snags
ALTER TABLE tasks ADD COLUMN snag_id TEXT;
