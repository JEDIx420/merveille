-- Infrastructure-only requests are not exposed by any application endpoint.
CREATE TABLE identity_recovery_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,issuer TEXT NOT NULL,old_subject TEXT NOT NULL,new_subject TEXT NOT NULL,email TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TRIGGER recover_verified_identity AFTER INSERT ON identity_recovery_requests BEGIN
 INSERT INTO command_assertions(id,ok) SELECT NEW.id,CASE WHEN length(trim(NEW.reason))>0 AND EXISTS(SELECT 1 FROM users u JOIN identities i ON i.user_id=u.id JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=NEW.user_id AND lower(u.email)=NEW.email AND i.issuer=NEW.issuer AND i.subject=NEW.old_subject AND i.provider='cloudflare_access') THEN 1 ELSE 0 END;
 UPDATE identities SET subject=NEW.new_subject WHERE user_id=NEW.user_id AND issuer=NEW.issuer AND subject=NEW.old_subject AND provider='cloudflare_access';
 INSERT INTO identity_recovery_events(id,user_id,reason,created_at) VALUES(NEW.id,NEW.user_id,NEW.reason,NEW.created_at);
 INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,reason,created_at) SELECT NEW.id,m.org_id,'INFRASTRUCTURE_OPERATOR','USER',NEW.user_id,'IDENTITY_RECOVERED',NEW.reason,NEW.created_at FROM organization_memberships m WHERE m.user_id=NEW.user_id LIMIT 1;
 DELETE FROM command_assertions WHERE id=NEW.id;
END;
-- Successful assertions do not accumulate; CHECK still aborts a failed transaction.
CREATE TRIGGER clear_command_assertion AFTER INSERT ON command_assertions BEGIN DELETE FROM command_assertions WHERE id=NEW.id; END;
CREATE TRIGGER clear_financial_assertion AFTER INSERT ON financial_guard BEGIN DELETE FROM financial_guard WHERE id=NEW.id; END;
