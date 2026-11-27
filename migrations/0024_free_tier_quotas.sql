-- 0024_free_tier_quotas.sql
-- Stage N00: Enforceable Cloudflare Free-tier quota policies, atomic daily/monthly counters,
-- idempotent reservations (Access seats, R2 storage, Workers AI neurons, Queues), and job monitoring.

CREATE TABLE IF NOT EXISTS quota_policies (
  org_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_access_seats INTEGER NOT NULL DEFAULT 45,
  max_r2_bytes INTEGER NOT NULL DEFAULT 8000000000,
  max_r2_primary_bytes INTEGER NOT NULL DEFAULT 4000000000,
  max_r2_backup_bytes INTEGER NOT NULL DEFAULT 4000000000,
  max_r2_class_a_monthly INTEGER NOT NULL DEFAULT 250000,
  max_r2_class_b_monthly INTEGER NOT NULL DEFAULT 2000000,
  max_ai_neurons_daily INTEGER NOT NULL DEFAULT 8000,
  max_ai_attempts_daily INTEGER NOT NULL DEFAULT 100,
  max_queue_ops_daily INTEGER NOT NULL DEFAULT 5000,
  max_d1_writes_daily INTEGER NOT NULL DEFAULT 20000,
  max_d1_reads_daily INTEGER NOT NULL DEFAULT 1000000,
  updated_by_user_id TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quota_usage_daily (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_utc TEXT NOT NULL, -- YYYY-MM-DD
  metric TEXT NOT NULL, -- AI_NEURONS, AI_ATTEMPTS, QUEUE_OPS, D1_WRITES, DYNAMIC_REQUESTS
  used_count INTEGER NOT NULL DEFAULT 0,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, day_utc, metric)
);

CREATE TABLE IF NOT EXISTS quota_usage_monthly (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month_utc TEXT NOT NULL, -- YYYY-MM
  metric TEXT NOT NULL, -- R2_CLASS_A, R2_CLASS_B
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, month_utc, metric)
);

CREATE TABLE IF NOT EXISTS quota_reservations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- R2_PRIMARY_BYTES, R2_BACKUP_BYTES, AI_NEURONS
  attempt_id TEXT NOT NULL,
  reserved_amount INTEGER NOT NULL,
  actual_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'RESERVED', -- RESERVED, COMMITTED, RELEASED, EXPIRED
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  UNIQUE (org_id, resource_type, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_quota_reservations_active
  ON quota_reservations(org_id, resource_type, status, expires_at);

CREATE TABLE IF NOT EXISTS job_execution_status (
  job_name TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  last_started_at INTEGER,
  last_succeeded_at INTEGER,
  last_status TEXT NOT NULL DEFAULT 'NEVER_RUN', -- RUNNING, OK, FAILED, DEFERRED_QUOTA
  last_error TEXT,
  items_processed INTEGER NOT NULL DEFAULT 0,
  estimated_cpu_ms REAL,
  updated_at INTEGER NOT NULL
);
