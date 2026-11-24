-- 0008_accounting_and_ledger.sql
-- Merveille Designs: Expenses, Consultant Fee Bills, Payroll Allocations, Accounting Periods, and Protected Reporting.

-- 1. Project and Overhead Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- SITE_TRAVEL, PRINTING_STATIONERY, MUNICIPAL_FEES, MODEL_MAKING, SOFTWARE_LICENSE, OFFICE_OVERHEAD, OTHER
  description TEXT NOT NULL,
  supplier_name TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  incurred_date TEXT NOT NULL,
  evidence_file_id TEXT REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, APPROVED, POSTED, REJECTED
  submitted_by_user_id TEXT NOT NULL REFERENCES users(id),
  approved_by_user_id TEXT REFERENCES users(id),
  approved_at INTEGER,
  posted_by_user_id TEXT REFERENCES users(id),
  posted_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 2. Consultant Bills & Obligations
CREATE TABLE IF NOT EXISTS consultant_bills (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  consultant_user_id TEXT NOT NULL REFERENCES users(id),
  bill_reference TEXT NOT NULL,
  discipline TEXT NOT NULL, -- STRUCTURAL, MEP, LANDSCAPE, INTERIOR, CIVIL
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  bill_date TEXT NOT NULL,
  evidence_file_id TEXT REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, APPROVED, POSTED, REJECTED
  submitted_by_user_id TEXT NOT NULL REFERENCES users(id),
  approved_by_user_id TEXT REFERENCES users(id),
  approved_at INTEGER,
  posted_by_user_id TEXT REFERENCES users(id),
  posted_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 3. Payroll & Salary Allocations (ADMIN-ONLY)
CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  period_month TEXT NOT NULL, -- YYYY-MM
  gross_salary_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'POSTED',
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- 4. Accounting Periods (Controlled period closure)
CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL UNIQUE, -- e.g. 2026-10, 2026-11
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_by_user_id TEXT REFERENCES users(id),
  closed_at INTEGER,
  created_at INTEGER NOT NULL
);
