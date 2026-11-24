-- 0003_files_and_media.sql
-- Merveille Designs: Private files, media, upload sessions, and retention integrity.

-- 1. Files Metadata Table
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  file_class TEXT NOT NULL, -- IMAGE, PDF, CAD, VIDEO, DOCUMENT
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, READY, DELETED
  is_internal_only INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT, -- SITE_IMAGE, FEASIBILITY, DRAWING, INVOICE, GENERAL
  reference_id TEXT,
  is_referenced INTEGER NOT NULL DEFAULT 0, -- 1 when attached to released drawing, invoice, or legal record
  created_at INTEGER NOT NULL,
  finalized_at INTEGER
);

-- 2. Upload Sessions Table (Tracks multipart upload progress and state)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  expected_size_bytes INTEGER NOT NULL,
  file_class TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  parts_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, ABORTED, EXPIRED
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 3. Upload Parts Table (Records individual uploaded chunk ETags for bounded retry)
CREATE TABLE IF NOT EXISTS upload_parts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL,
  UNIQUE(session_id, part_number)
);
