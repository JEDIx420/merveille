-- Extend infrastructure-only recovery to reviewed, active legacy accounts without a binding.
-- No user or grant is created, and suspended accounts cannot use initial linking.
DROP TRIGGER recover_verified_identity;
CREATE TRIGGER recover_verified_identity AFTER INSERT ON identity_recovery_requests BEGIN
 INSERT INTO command_assertions(id,ok) SELECT NEW.id,CASE WHEN length(trim(NEW.reason))>0 AND EXISTS(SELECT 1 FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=NEW.user_id AND lower(u.email)=NEW.email AND ((NEW.old_subject='' AND u.status='ACTIVE' AND m.is_active=1 AND NOT EXISTS(SELECT 1 FROM identities WHERE user_id=u.id)) OR EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.issuer=NEW.issuer AND i.subject=NEW.old_subject AND i.provider='cloudflare_access'))) THEN 1 ELSE 0 END;
 UPDATE identities SET subject=NEW.new_subject WHERE user_id=NEW.user_id AND issuer=NEW.issuer AND subject=NEW.old_subject AND provider='cloudflare_access';
 INSERT INTO identities(id,user_id,provider,issuer,subject,email,created_at) SELECT NEW.id||'-binding',NEW.user_id,'cloudflare_access',NEW.issuer,NEW.new_subject,NEW.email,NEW.created_at WHERE NEW.old_subject='' AND NOT EXISTS(SELECT 1 FROM identities WHERE user_id=NEW.user_id);
 INSERT INTO identity_recovery_events(id,user_id,reason,created_at) VALUES(NEW.id,NEW.user_id,NEW.reason,NEW.created_at);
 INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,reason,created_at) SELECT NEW.id,m.org_id,'INFRASTRUCTURE_OPERATOR','USER',NEW.user_id,CASE WHEN NEW.old_subject='' THEN 'IDENTITY_LINKED' ELSE 'IDENTITY_RECOVERED' END,NEW.reason,NEW.created_at FROM organization_memberships m WHERE m.user_id=NEW.user_id LIMIT 1;
 DELETE FROM command_assertions WHERE id=NEW.id;
END;
