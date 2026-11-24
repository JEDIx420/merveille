-- Serialize dedicated Access policy updates; stale snapshots must not overlap.
CREATE TABLE access_admission_sync_locks (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id),
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
