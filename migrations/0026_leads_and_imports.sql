-- 0026_leads_and_imports.sql
-- Stage N02: Simple Leads pipeline (extending enquiries with nullable contact_email/site_location),
-- canonical lead follow-ups, compact activity history, and reviewed spreadsheet import provenance.

PRAGMA foreign_keys = OFF;

CREATE TABLE enquiries_new (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_account_id TEXT REFERENCES client_accounts(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  site_location TEXT,
  requirements_text TEXT,
  lead_manager_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN', -- Legacy status preserved
  lead_stage TEXT NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, DISCUSSION, PROPOSAL, WON, LOST, ON_HOLD
  decline_reason TEXT,
  linked_project_id TEXT REFERENCES projects(id),
  source_label TEXT,
  budget_text TEXT,
  labels_json TEXT,
  import_batch_id TEXT,
  source_external_id TEXT,
  extra_metadata_json TEXT,
  snoozed_until INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

INSERT INTO enquiries_new (
  id, org_id, client_account_id, contact_name, contact_email, contact_phone,
  site_location, requirements_text, lead_manager_id, status, lead_stage,
  decline_reason, linked_project_id, revision, created_at
)
SELECT
  id, org_id, client_account_id, contact_name, contact_email, contact_phone,
  site_location, requirements_text, lead_manager_id, status,
  CASE status
    WHEN 'OPEN' THEN 'NEW'
    WHEN 'REQUIREMENTS_REVIEW' THEN 'CONTACTED'
    WHEN 'FEASIBILITY_REVIEW' THEN 'DISCUSSION'
    WHEN 'QUOTE_PREPARATION' THEN 'PROPOSAL'
    WHEN 'CONVERTED' THEN 'WON'
    WHEN 'LOST' THEN 'LOST'
    WHEN 'DECLINED' THEN 'LOST'
    WHEN 'ON_HOLD' THEN 'ON_HOLD'
    ELSE 'NEW'
  END,
  decline_reason, linked_project_id, revision, created_at
FROM enquiries;

DROP TABLE enquiries;
ALTER TABLE enquiries_new RENAME TO enquiries;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_enquiries_org_stage ON enquiries(org_id, lead_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_source_ext ON enquiries(org_id, source_external_id);

CREATE TABLE IF NOT EXISTS lead_followups (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enquiry_id TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  action_text TEXT NOT NULL,
  due_date TEXT, -- YYYY-MM-DD (optional)
  due_time TEXT, -- HH:MM (optional, Asia/Kolkata; null means date-only)
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  completed_by_user_id TEXT REFERENCES users(id),
  outcome_note TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_followups_due ON lead_followups(org_id, is_completed, due_date);
CREATE INDEX IF NOT EXISTS idx_lead_followups_enquiry ON lead_followups(enquiry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enquiry_id TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL, -- NOTE, CALL_OUTCOME, STAGE_CHANGE, OWNER_CHANGE, FOLLOWUP_COMPLETED, REOPENED
  summary TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_enquiry ON lead_activities(enquiry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  import_kind TEXT NOT NULL, -- LEADS, ASANA_TASKS
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  file_bytes INTEGER NOT NULL,
  r2_key TEXT,
  mapping_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, PARTIAL, UNDONE
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  undone_at INTEGER,
  undone_by_user_id TEXT REFERENCES users(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_batch_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sheet_name TEXT,
  row_number INTEGER NOT NULL,
  source_external_id TEXT,
  row_sha256 TEXT,
  action TEXT NOT NULL, -- CREATED, UPDATED, SKIPPED, REJECTED, UNDONE
  target_entity_type TEXT, -- ENQUIRY, TASK, PERSONAL_TASK
  target_entity_id TEXT,
  target_revision_at_import INTEGER,
  before_json TEXT,
  after_json TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_batch_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_rows_source ON import_batch_rows(org_id, source_external_id);
