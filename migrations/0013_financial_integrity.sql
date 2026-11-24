-- Existing duplicate issue/confirmation sources must be reconciled before this upgrade.
-- This deliberately reports duplicates instead of deleting historical financial records.
CREATE UNIQUE INDEX IF NOT EXISTS financial_unique_journal_source ON journal_entries(org_id, source_type, source_id) WHERE source_type IN ('INVOICE_ISSUED','RECEIPT_CONFIRMED','EXPENSE_POSTED','CONSULTANT_BILL_POSTED','PAYROLL_POSTED');
CREATE TABLE IF NOT EXISTS financial_guard (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
CREATE TABLE IF NOT EXISTS finance_sequences (org_id TEXT NOT NULL, kind TEXT NOT NULL, year INTEGER NOT NULL, value INTEGER NOT NULL CHECK(value > 0), PRIMARY KEY(org_id,kind,year));
CREATE TABLE IF NOT EXISTS finance_operations (org_id TEXT NOT NULL, operation_key TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(org_id,operation_key));
-- Transactional domain events inherit the same commit as their financial audit record.
CREATE TRIGGER IF NOT EXISTS financial_outbox AFTER INSERT ON audit_events
WHEN NEW.entity_type IN ('INVOICE','RECEIPT','ALLOCATION','QUOTATION','SCHEDULE','ACCOUNTING','PAYROLL','CHANGE')
BEGIN
 INSERT INTO outbox_events(id,org_id,event_type,entity_type,entity_id,payload_json,status,created_at) VALUES(NEW.id||'-event',NEW.org_id,NEW.action,NEW.entity_type,NEW.entity_id,COALESCE(NEW.new_state,'{}'),'PENDING',NEW.created_at);
END;
CREATE UNIQUE INDEX IF NOT EXISTS financial_payroll_period ON payroll_records(org_id,user_id,period_month,COALESCE(project_id,''));
CREATE UNIQUE INDEX IF NOT EXISTS financial_change_versions ON change_request_versions(change_request_id,version_number);
-- Read-only preflight report. Existing broken postings are retained for explicit reconciliation.
CREATE VIEW IF NOT EXISTS financial_reconciliation_errors AS
SELECT 'JOURNAL_UNBALANCED' AS kind,je.org_id,je.id AS record_id FROM journal_entries je LEFT JOIN journal_lines jl ON jl.journal_entry_id=je.id GROUP BY je.id HAVING COUNT(jl.id)<2 OR COALESCE(SUM(jl.debit_minor),0)!=COALESCE(SUM(jl.credit_minor),0) OR COALESCE(SUM(jl.debit_minor),0)<=0
UNION ALL
SELECT 'RECEIPT_POSTING_MISSING',r.org_id,r.id FROM receipts r WHERE r.status='CONFIRMED' AND NOT EXISTS(SELECT 1 FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE je.org_id=r.org_id AND je.source_type='RECEIPT_CONFIRMED' AND je.source_id=r.id GROUP BY je.id HAVING SUM(jl.debit_minor)=r.amount_minor AND SUM(jl.credit_minor)=r.amount_minor)
UNION ALL
SELECT 'INVOICE_POSTING_MISSING',i.org_id,i.id FROM invoices i WHERE i.status='ISSUED' AND NOT EXISTS(SELECT 1 FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE je.org_id=i.org_id AND je.source_type='INVOICE_ISSUED' AND je.source_id=i.id GROUP BY je.id HAVING SUM(jl.debit_minor)=i.total_minor AND SUM(jl.credit_minor)=i.total_minor);
