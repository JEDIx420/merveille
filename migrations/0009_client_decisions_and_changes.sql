-- 0009_client_decisions_and_changes.sql
-- Merveille Designs: Client References, Material Selections, Suggestions, Change Requests, and Pre-work Commercial Gates.

-- 1. Client References (Inspiration files, URLs, area tags, uploader)
CREATE TABLE IF NOT EXISTS client_references (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
  file_id TEXT REFERENCES files(id),
  external_url TEXT,
  caption TEXT NOT NULL,
  room_area TEXT,
  category TEXT,
  created_at INTEGER NOT NULL
);

-- 2. Client Reference Comments
CREATE TABLE IF NOT EXISTS client_reference_comments (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL REFERENCES client_references(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 3. Material Selection Items
CREATE TABLE IF NOT EXISTS material_selection_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  question TEXT NOT NULL,
  needed_by_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, AWAITING_MAIN_CLIENT, SELECTED, CHANGES_REQUESTED, READY_FOR_EXECUTION, CANCELLED
  selected_option_id TEXT,
  selected_by_user_id TEXT REFERENCES users(id),
  selected_at INTEGER,
  change_request_id TEXT,
  internal_notes TEXT,
  responsible_manager_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 4. Material Selection Options
CREATE TABLE IF NOT EXISTS material_selection_options (
  id TEXT PRIMARY KEY,
  selection_item_id TEXT NOT NULL REFERENCES material_selection_items(id) ON DELETE CASCADE,
  option_label TEXT NOT NULL,
  description TEXT,
  file_id TEXT REFERENCES files(id),
  external_link TEXT,
  cost_implication_minor INTEGER NOT NULL DEFAULT 0,
  schedule_implication_days INTEGER NOT NULL DEFAULT 0,
  is_recommended INTEGER NOT NULL DEFAULT 0,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- 5. Material Selection Suggestions & Comments (Representative preferences)
CREATE TABLE IF NOT EXISTS material_selection_suggestions (
  id TEXT PRIMARY KEY,
  selection_item_id TEXT NOT NULL REFERENCES material_selection_items(id) ON DELETE CASCADE,
  option_id TEXT REFERENCES material_selection_options(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  suggestion_type TEXT NOT NULL DEFAULT 'SUGGESTION', -- SUGGESTION, COMMENT
  comment_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 6. Change Requests
CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL, -- MATERIAL_SELECTION, CLIENT_REQUEST, SITE_CONDITION, DESIGN_REVISION, DISCUSSION
  source_reference_id TEXT,
  affected_original_scope TEXT,
  current_version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, ESTIMATING, AWAITING_CLIENT, ACCEPTED_AWAITING_PAYMENT, PAYMENT_CONFIRMED, AUTHORIZED, IN_PROGRESS, COMPLETED, DECLINED, CANCELLED
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 7. Change Request Versions (Versioned estimates with scope, price, pre-work payment, schedule impact)
CREATE TABLE IF NOT EXISTS change_request_versions (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  scope_summary TEXT NOT NULL,
  exclusions TEXT,
  price_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  required_prework_payment_minor INTEGER NOT NULL DEFAULT 0,
  schedule_impact_days INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, ISSUED, ACCEPTED, SUPERSEDED, DECLINED
  accepted_by_user_id TEXT REFERENCES users(id),
  accepted_at INTEGER,
  acceptance_notes TEXT,
  allocated_receipt_id TEXT REFERENCES receipts(id),
  allocated_payment_minor INTEGER NOT NULL DEFAULT 0,
  authorized_by_user_id TEXT REFERENCES users(id),
  authorized_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 8. Change Request Comments
CREATE TABLE IF NOT EXISTS change_request_comments (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 9. Column Additions for linking tasks and allocations
ALTER TABLE tasks ADD COLUMN change_request_id TEXT;
ALTER TABLE receipt_allocations ADD COLUMN change_request_id TEXT;
ALTER TABLE receipt_allocations ADD COLUMN change_request_version_id TEXT;
