-- Personal presentation preferences. These do not grant business permissions.
CREATE TABLE appearance_preferences (
 org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id),
 theme TEXT NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark','light','system')),
 celebrations TEXT NOT NULL DEFAULT 'full' CHECK(celebrations IN ('full','reduced','off')),
 updated_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id)
);
CREATE TABLE celebration_events (
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
 project_id TEXT NOT NULL REFERENCES projects(id), resource_id TEXT NOT NULL,
 kind TEXT NOT NULL, actor_id TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX celebration_context ON celebration_events(org_id,project_id,created_at);
CREATE INDEX celebration_resource ON celebration_events(org_id,kind,resource_id);
CREATE TABLE celebration_consumptions (
 org_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL REFERENCES celebration_events(id),
 consumed_at INTEGER NOT NULL, PRIMARY KEY(org_id,user_id,event_id)
);
CREATE TRIGGER celebrate_project_created AFTER INSERT ON projects BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.id,NEW.id,'project_created',NULL,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_project_activated AFTER UPDATE OF status ON projects WHEN NEW.status='ACTIVE' AND OLD.status!='ACTIVE' BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.id,NEW.id,'project_activated',NULL,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_task_completed AFTER UPDATE OF status ON tasks WHEN NEW.status='COMPLETED' AND OLD.status!='COMPLETED' BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.project_id,NEW.id,'task_completed',NEW.completed_by_user_id,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_receipt_confirmed AFTER UPDATE OF status ON receipts WHEN NEW.status='CONFIRMED' AND OLD.status!='CONFIRMED' BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.project_id,NEW.id,'receipt_confirmed',NEW.confirmed_by_user_id,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_invoice_settled AFTER UPDATE OF outstanding_minor ON invoices WHEN NEW.status='ISSUED' AND OLD.outstanding_minor>0 AND NEW.outstanding_minor=0 AND NEW.settlement_status='PAID' BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.project_id,NEW.id,'invoice_settled',NULL,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_drawing_released AFTER UPDATE OF current_released_version_id ON drawings WHEN NEW.current_released_version_id IS NOT NULL AND NEW.current_released_version_id IS NOT OLD.current_released_version_id BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.project_id,NEW.current_released_version_id,'drawing_released',NULL,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_quote_accepted AFTER UPDATE OF status ON quotations WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' BEGIN
 INSERT INTO celebration_events VALUES(lower(hex(randomblob(16))),NEW.org_id,NEW.project_id,NEW.id,'quote_accepted',NEW.accepted_by_user_id,unixepoch()*1000);
END;
CREATE TRIGGER celebrate_estimate_accepted AFTER UPDATE OF status ON change_request_versions WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' BEGIN
 INSERT INTO celebration_events SELECT lower(hex(randomblob(16))),c.org_id,c.project_id,NEW.id,'estimate_accepted',NEW.accepted_by_user_id,unixepoch()*1000 FROM change_requests c WHERE c.id=NEW.change_request_id;
END;
