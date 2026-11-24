-- Optimistic version and unique visible reference for site-issue commands.
ALTER TABLE snags ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX snag_project_reference ON snags(org_id,project_id,snag_number);
