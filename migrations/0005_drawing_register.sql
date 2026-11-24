-- 0005_drawing_register.sql
-- Merveille Designs: Drawing Register, Version-bound Consultant Approvals, and Manager Final Release.

-- 1. Logical Drawings Table (Stable identity per sheet/number)
CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number TEXT NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL, -- ARCHITECTURAL, STRUCTURAL, MEP, LANDSCAPE, INTERIOR, CIVIL
  current_released_version_id TEXT,
  is_withdrawn INTEGER NOT NULL DEFAULT 0,
  withdrawal_reason TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, drawing_number)
);

-- 2. Drawing Versions Table (Immutable version snapshots)
CREATE TABLE IF NOT EXISTS drawing_versions (
  id TEXT PRIMARY KEY,
  drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL, -- V1, V2, V3...
  file_id TEXT NOT NULL REFERENCES files(id),
  cad_file_id TEXT REFERENCES files(id),
  submission_note TEXT,
  author_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, IN_REVIEW, CONSULTANT_APPROVED, RELEASED, SUPERSEDED, CHANGES_REQUESTED, REJECTED, WITHDRAWN
  released_at INTEGER,
  released_by_user_id TEXT REFERENCES users(id),
  superseded_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(drawing_id, version_label)
);

-- 3. Drawing Reviews Table (Designated consultant review requirements and decisions)
CREATE TABLE IF NOT EXISTS drawing_reviews (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES drawing_versions(id) ON DELETE CASCADE,
  consultant_user_id TEXT NOT NULL REFERENCES users(id),
  is_required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, CHANGES_REQUESTED, REJECTED
  decision_reason TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(version_id, consultant_user_id)
);
