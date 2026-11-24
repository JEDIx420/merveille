-- 0007_commercial_finance.sql
-- Merveille Designs: Quotations, Payment Schedules, Invoices, Receipts, Allocations, and Balanced Ledger Primitives.

-- 1. Quotations (Versioned commercial proposals with client acceptance)
CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_amount_minor INTEGER NOT NULL,
  required_advance_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, ACCEPTED, REJECTED, SUPERSEDED
  accepted_by_user_id TEXT REFERENCES users(id),
  accepted_at INTEGER,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, version_number)
);

-- 2. Quotation Line Items
CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_rate_minor INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL
);

-- 3. Payment Schedules (Upfront agreed milestone schedule, manager-only revisions)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quotation_id TEXT REFERENCES quotations(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'AGREED', -- AGREED, SUPERSEDED
  revision_reason TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, version_number)
);

-- 4. Payment Schedule Items (Explicit date/stage triggers)
CREATE TABLE IF NOT EXISTS payment_schedule_items (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES payment_schedules(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  trigger_type TEXT NOT NULL, -- DATE_ONLY, STAGE_ONLY, DATE_AND_STAGE, DATE_OR_STAGE
  target_date TEXT, -- YYYY-MM-DD
  target_stage_name TEXT,
  is_advance INTEGER NOT NULL DEFAULT 0,
  billed_amount_minor INTEGER NOT NULL DEFAULT 0
);

-- 5. Invoices (Staff draft -> Manager approve -> Staff issue)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE, -- Allocated on issue e.g. MD-INV-2026-0001
  schedule_item_id TEXT REFERENCES payment_schedule_items(id),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, IN_REVIEW, APPROVED, ISSUED, CANCELLED
  current_version_number INTEGER NOT NULL DEFAULT 1,
  issued_version_number INTEGER,
  issued_at INTEGER,
  issued_by_user_id TEXT REFERENCES users(id),
  settlement_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, SETTLED_BY_CREDIT
  total_minor INTEGER NOT NULL DEFAULT 0,
  allocated_minor INTEGER NOT NULL DEFAULT 0,
  outstanding_minor INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- 6. Invoice Versions (Immutable snapshots with manager approval tracking)
CREATE TABLE IF NOT EXISTS invoice_versions (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, IN_REVIEW, APPROVED, CHANGES_REQUESTED
  approved_by_user_id TEXT REFERENCES users(id),
  approved_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(invoice_id, version_number)
);

-- 7. Invoice Line Items (Items per version snapshot)
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_version_id TEXT NOT NULL REFERENCES invoice_versions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_rate_minor INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL
);

-- 8. Receipts (External payments, reported by staff/client, confirmed ONLY by admin)
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE,
  currency TEXT NOT NULL DEFAULT 'INR',
  amount_minor INTEGER NOT NULL,
  allocated_minor INTEGER NOT NULL DEFAULT 0,
  unallocated_minor INTEGER NOT NULL,
  received_date TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- NEFT, RTGS, UPI, CHEQUE, BANK_TRANSFER
  reference_note TEXT,
  evidence_file_id TEXT REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'REPORTED', -- REPORTED, CONFIRMED, REJECTED, REVERSED
  idempotency_key TEXT UNIQUE,
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  confirmed_by_user_id TEXT REFERENCES users(id),
  confirmed_at INTEGER,
  reversal_reason TEXT,
  reversed_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 9. Receipt Allocations (Part-payments, advances applied to invoices)
CREATE TABLE IF NOT EXISTS receipt_allocations (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  allocated_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- 10. Balanced Journal Entries & Lines (Accounting foundation)
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- INVOICE_ISSUED, RECEIPT_CONFIRMED, RECEIPT_ALLOCATED, RECEIPT_REVERSED
  source_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  debit_minor INTEGER NOT NULL DEFAULT 0,
  credit_minor INTEGER NOT NULL DEFAULT 0
);
