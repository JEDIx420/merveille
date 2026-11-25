import { UserPrincipal } from '@/server/auth/principal';
import { AuthorizationError } from '@/server/auth/policy';
import { Appearance, DEFAULT_APPEARANCE, Celebration } from '@/shared/experience';
export async function getAppearance(db: D1Database, p: UserPrincipal): Promise<Appearance> {
    return await db.prepare('SELECT theme,celebrations FROM appearance_preferences WHERE org_id=? AND user_id=?').bind(p.orgId, p.id).first<Appearance>() || DEFAULT_APPEARANCE;
}
export async function setAppearance(db: D1Database, p: UserPrincipal, input: unknown) {
    const v = input as Appearance;
    if (!v || !['dark', 'light', 'system'].includes(v.theme) || !['full', 'reduced', 'off'].includes(v.celebrations))
        throw new AuthorizationError('Choose a valid appearance and celebration setting.', 'INVALID_INPUT');
    await db.prepare(`INSERT INTO appearance_preferences VALUES(?,?,?,?,?) ON CONFLICT(org_id,user_id) DO UPDATE SET theme=excluded.theme,celebrations=excluded.celebrations,updated_at=excluded.updated_at`).bind(p.orgId, p.id, v.theme, v.celebrations, Date.now()).run();
    return { theme: v.theme, celebrations: v.celebrations };
}
const globalGrant = `EXISTS(SELECT 1 FROM role_assignments r WHERE r.org_id=e.org_id AND r.user_id=?2 AND r.role IN ('ADMIN','OWNER') AND r.scope='GLOBAL' AND r.revoked_at IS NULL)`;
const internal = `(${globalGrant} OR EXISTS(SELECT 1 FROM project_memberships m WHERE m.org_id=e.org_id AND m.project_id=e.project_id AND m.user_id=?2 AND m.is_active=1 AND m.project_role IN ('MANAGER','TEAM_MEMBER','STAFF')))`;
const projectAccess = `(${globalGrant} OR EXISTS(SELECT 1 FROM project_memberships m WHERE m.org_id=e.org_id AND m.project_id=e.project_id AND m.user_id=?2 AND m.is_active=1))`;
const commercial = `(${globalGrant} OR EXISTS(SELECT 1 FROM project_memberships m WHERE m.org_id=e.org_id AND m.project_id=e.project_id AND m.user_id=?2 AND m.is_active=1 AND (m.finance_access=1 OR m.project_role IN ('MANAGER','CONSULTANT','MAIN_CLIENT'))))`;
// Shared by listing and atomic claim: live identity/membership, visibility and current resource state.
const eligible = `FROM celebration_events e JOIN projects p ON p.id=e.project_id AND p.org_id=e.org_id
 WHERE e.org_id=?1 AND e.created_at>=?3 AND p.is_archived=0
 AND EXISTS(SELECT 1 FROM users u JOIN organization_memberships om ON om.user_id=u.id WHERE u.id=?2 AND u.status='ACTIVE' AND om.org_id=e.org_id AND om.is_active=1)
 AND ${projectAccess}
 AND e.rowid=(SELECT MAX(latest.rowid) FROM celebration_events latest WHERE latest.org_id=e.org_id AND latest.kind=e.kind AND latest.resource_id=e.resource_id)
 AND NOT EXISTS(SELECT 1 FROM celebration_consumptions c WHERE c.org_id=e.org_id AND c.user_id=?2 AND c.event_id=e.id)
 AND CASE e.kind
 WHEN 'project_created' THEN ${internal}
 WHEN 'project_activated' THEN p.status='ACTIVE'
 WHEN 'task_completed' THEN ${internal} AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=e.resource_id AND t.project_id=e.project_id AND t.status='COMPLETED')
 WHEN 'receipt_confirmed' THEN ${commercial} AND EXISTS(SELECT 1 FROM receipts r WHERE r.id=e.resource_id AND r.project_id=e.project_id AND r.status='CONFIRMED')
 WHEN 'invoice_settled' THEN ${commercial} AND EXISTS(SELECT 1 FROM invoices i WHERE i.id=e.resource_id AND i.project_id=e.project_id AND i.status='ISSUED' AND i.settlement_status='PAID' AND i.outstanding_minor=0)
 WHEN 'drawing_released' THEN EXISTS(SELECT 1 FROM drawings d JOIN drawing_versions v ON v.id=d.current_released_version_id WHERE v.id=e.resource_id AND d.project_id=e.project_id AND d.is_withdrawn=0 AND v.status='RELEASED')
 WHEN 'quote_accepted' THEN ${commercial} AND EXISTS(SELECT 1 FROM quotations q WHERE q.id=e.resource_id AND q.project_id=e.project_id AND q.status='ACCEPTED')
 WHEN 'estimate_accepted' THEN ${commercial} AND EXISTS(SELECT 1 FROM change_request_versions v JOIN change_requests c ON c.id=v.change_request_id WHERE v.id=e.resource_id AND c.project_id=e.project_id AND v.status='ACCEPTED')
 ELSE 0 END`;
export async function listCelebrations(db: D1Database, p: UserPrincipal, projectId?: string) {
    if ((await getAppearance(db, p)).celebrations === 'off')
        return [];
    const rows = await db.prepare(`SELECT e.id,e.kind,e.actor_id AS actorId,e.project_id AS projectId,p.name AS projectName,CASE WHEN ${internal} THEN 0 ELSE 1 END AS quiet ${eligible} ${projectId ? 'AND e.project_id=?4' : ''} ORDER BY e.created_at DESC,e.rowid DESC LIMIT 3`).bind(p.orgId, p.id, Date.now() - 86400000, ...(projectId ? [projectId] : [])).all<Celebration>();
    return (rows.results || []).map(r => ({ ...r, quiet: !!r.quiet }));
}
export async function claimCelebration(db: D1Database, p: UserPrincipal, id: string) {
    if (!/^[a-f0-9]{32}$/.test(id))
        throw new AuthorizationError('Invalid celebration.', 'INVALID_INPUT');
    // A single insert-select avoids duplicate playback across devices and rechecks live permission.
    const result = await db.prepare(`INSERT OR IGNORE INTO celebration_consumptions(org_id,user_id,event_id,consumed_at)
 SELECT e.org_id,?2,e.id,?5 ${eligible} AND e.id=?4
 AND NOT EXISTS(SELECT 1 FROM appearance_preferences a WHERE a.org_id=e.org_id AND a.user_id=?2 AND a.celebrations='off')`).bind(p.orgId, p.id, Date.now() - 86400000, id, Date.now()).run();
    return !!result.meta.changes;
}
