-- Additive upgrade. Old invitation links are retired; historical rows retained.
ALTER TABLE project_memberships ADD COLUMN finance_access INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_memberships ADD COLUMN finance_author INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_memberships ADD COLUMN invoice_issue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invitations ADD COLUMN grants_json TEXT;
ALTER TABLE invitations ADD COLUMN admission_status TEXT NOT NULL DEFAULT 'PENDING_SETUP';
UPDATE invitations SET status='REVOKED', token='retired:' || id WHERE status='PENDING';
CREATE TABLE bootstrap_state (id INTEGER PRIMARY KEY CHECK(id=1), invitation_id TEXT NOT NULL UNIQUE, consumed_at INTEGER);
CREATE TABLE access_admission_jobs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, desired_state TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING_SETUP', attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at INTEGER NOT NULL);
CREATE TABLE security_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
-- Assertion rows intentionally fail CHECK inside D1 batch to roll back guard races.
CREATE TABLE command_assertions (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
-- Existing fixture accounts are retained for history but cannot authenticate without a deliberate binding.
CREATE TABLE identity_recovery_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
-- Infrastructure-only setup input: one INSERT is atomic, including the trigger effects.
CREATE TABLE bootstrap_setup (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, token_digest TEXT NOT NULL, invitation_id TEXT NOT NULL, operator_id TEXT NOT NULL, expires_at INTEGER NOT NULL, admission_status TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TRIGGER prepare_bootstrap AFTER INSERT ON bootstrap_setup BEGIN
 INSERT INTO command_assertions(id,ok) SELECT 'bootstrap-guard',CASE WHEN NOT EXISTS(SELECT 1 FROM bootstrap_state) AND NOT EXISTS(SELECT 1 FROM identities WHERE provider='cloudflare_access') THEN 1 ELSE 0 END;
 INSERT INTO users(id,email,display_name,status,created_at) VALUES(NEW.operator_id,'bootstrap-'||NEW.operator_id||'@invalid.example','Bootstrap operator','DISABLED',NEW.created_at);
 INSERT INTO invitations(id,org_id,email,display_name,intended_role,token,status,expires_at,created_by,created_at,grants_json,admission_status) VALUES(NEW.invitation_id,'org_merveille_main',NEW.email,'Initial administrator','ADMIN',NEW.token_digest,'PENDING',NEW.expires_at,NEW.operator_id,NEW.created_at,'{"roles":["ADMIN"],"projects":[]}',NEW.admission_status);
 INSERT INTO bootstrap_state(id,invitation_id) VALUES(1,NEW.invitation_id);
 INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,created_at) VALUES(NEW.invitation_id||'-setup','org_merveille_main',NEW.operator_id,'BOOTSTRAP',NEW.invitation_id,'BOOTSTRAP_PREPARED',NEW.created_at);
END;

-- Quarantine the exact baseline-seeded demo administrator, preserving referenced history.
UPDATE users SET status='DISABLED',disabled_at=1795478400000 WHERE id='usr_admin_001' AND email='admin@merveilledesigns.com' AND NOT EXISTS(SELECT 1 FROM identities WHERE user_id='usr_admin_001' AND provider='cloudflare_access');
