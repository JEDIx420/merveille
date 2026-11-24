-- Durable notification attempts and explicit, verified channel preferences.
ALTER TABLE notifications ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN next_attempt_at INTEGER;
ALTER TABLE notifications ADD COLUMN claimed_at INTEGER;
ALTER TABLE notifications ADD COLUMN claim_token TEXT;
CREATE INDEX IF NOT EXISTS notifications_dispatch ON notifications(status, next_attempt_at);
CREATE TABLE notification_preferences (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  whatsapp_phone TEXT,
  whatsapp_verified_at INTEGER,
  whatsapp_consent_at INTEGER,
  whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(org_id, user_id)
);
CREATE TABLE backup_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL,
  manifest_key TEXT,
  manifest_sha256 TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  failure_code TEXT
);
ALTER TABLE projects ADD COLUMN pre_archive_status TEXT;
