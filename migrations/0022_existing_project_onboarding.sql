-- Existing work is recorded independently of enquiry intake. Commercial gates remain authoritative.
CREATE TABLE project_onboarding (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  reported_start_date TEXT,
  handover_notes TEXT NOT NULL,
  commercial_notes TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE(org_id, request_key)
);
CREATE TRIGGER onboarding_immutable_update BEFORE UPDATE ON project_onboarding BEGIN
  SELECT RAISE(ABORT, 'Original onboarding record is immutable');
END;
