-- Explicit archived receipt purpose: new outside payments settle an existing issued obligation.
ALTER TABLE receipts ADD COLUMN settlement_invoice_id TEXT REFERENCES invoices(id);
CREATE INDEX receipt_settlement_obligation ON receipts(settlement_invoice_id) WHERE settlement_invoice_id IS NOT NULL;
