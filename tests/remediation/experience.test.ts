import { describe, it, expect, beforeEach } from 'vitest';
import { setupMigratedTestDb } from '../test-db';
import { getAppearance, setAppearance, listCelebrations, claimCelebration } from '@/server/experience/service';
import type { UserPrincipal } from '@/server/auth/principal';
let db: D1Database;
const org = 'org_merveille_main';
const p: UserPrincipal = { id: 'exp_admin', orgId: org, email: 'experience@example.invalid', name: 'Fictional admin', role: 'ADMIN', roles: ['ADMIN'], projectMemberships: [] };
const client: UserPrincipal = { ...p, id: 'exp_client', roles: [], role: 'CLIENT_REP' };
beforeEach(async () => {
    db = await setupMigratedTestDb();
    for (const id of [p.id, client.id]) {
        await db.prepare("INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'ACTIVE',1)").bind(id, id + '@example.invalid', id).run();
        await db.prepare("INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,?,?,1,1)").bind('om_' + id, org, id).run();
    }
    await db.prepare("INSERT INTO role_assignments(id,org_id,user_id,role,scope,granted_at) VALUES('exp_role',?,?,'ADMIN','GLOBAL',1)").bind(org, p.id).run();
    await db.prepare("INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES('exp_project',?,'EXP','Fictional experience project','DRAFT',1)").bind(org).run();
    await db.prepare("INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES('exp_pm',?,'exp_project',?,'CLIENT_REP',1,1)").bind(org, client.id).run();
});
describe('Personal themes and authorized celebration consumption', () => {
    it('defaults dark/full, validates settings and scopes preference updates', async () => { expect(await getAppearance(db, p)).toEqual({ theme: 'dark', celebrations: 'full' }); await setAppearance(db, p, { theme: 'light', celebrations: 'off' }); expect(await getAppearance(db, client)).toEqual({ theme: 'dark', celebrations: 'full' }); expect(await getAppearance(db, p)).toEqual({ theme: 'light', celebrations: 'off' }); await expect(setAppearance(db, p, { theme: 'invalid', celebrations: 'full' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); expect(await listCelebrations(db, p)).toEqual([]); });
    it('emits only on real transitions, survives replay, and claims once concurrently', async () => { const initial = await listCelebrations(db, p); expect(initial).toHaveLength(1); expect(initial[0].kind).toBe('project_created'); await db.prepare("UPDATE projects SET status='ACTIVE' WHERE id='exp_project'").run(); await db.prepare("UPDATE projects SET status='ACTIVE' WHERE id='exp_project'").run(); const events = await listCelebrations(db, p); expect(events.filter(e => e.kind === 'project_activated')).toHaveLength(1); const claims = await Promise.all([claimCelebration(db, p, initial[0].id), claimCelebration(db, p, initial[0].id)]); expect(claims.filter(Boolean)).toHaveLength(1); expect((await listCelebrations(db, p)).some(e => e.id === initial[0].id)).toBe(false); });
    it('does not publish events from rolled-back mutations', async () => { await expect(db.batch([db.prepare("UPDATE projects SET status='ACTIVE' WHERE id='exp_project'"), db.prepare("INSERT INTO projects(id,org_id,code,name,created_at) VALUES('exp_project',?,'BAD','Fail',1)").bind(org)])).rejects.toThrow(); expect((await listCelebrations(db, p)).map(e => e.kind)).toEqual(['project_created']); });
    it('rechecks live grants at claim time despite stale principal roles', async () => { const e = (await listCelebrations(db, p))[0]; await db.prepare("UPDATE role_assignments SET revoked_at=1 WHERE id='exp_role'").run(); expect(await claimCelebration(db, p, e.id)).toBe(false); expect(await listCelebrations(db, p)).toEqual([]); });
    it('suppresses external internal-events, permits quiet activation, and denies after revocation', async () => { expect(await listCelebrations(db, client)).toEqual([]); await db.prepare("UPDATE projects SET status='ACTIVE' WHERE id='exp_project'").run(); const events = await listCelebrations(db, client); expect(events).toHaveLength(1); expect(events[0].quiet).toBe(true); await db.prepare("UPDATE project_memberships SET is_active=0 WHERE id='exp_pm'").run(); expect(await claimCelebration(db, client, events[0].id)).toBe(false); });
    it('excludes expired events, unknown project scopes, archived resources and disabled users', async () => { expect(await listCelebrations(db, p, 'another_project')).toEqual([]); await db.prepare('UPDATE celebration_events SET created_at=1').run(); expect(await listCelebrations(db, p)).toEqual([]); await db.prepare("UPDATE projects SET status='ACTIVE' WHERE id='exp_project'").run(); await db.prepare("UPDATE users SET status='DISABLED' WHERE id=?").bind(p.id).run(); expect(await listCelebrations(db, p)).toEqual([]); });
    it('task completion is distinct from assignment, and reopened work cannot be celebrated', async () => { await db.prepare("INSERT INTO tasks(id,org_id,project_id,title,status,creator_user_id,created_at) VALUES('exp_task',?,'exp_project','Fictional task','TODO',?,1)").bind(org, p.id).run(); expect((await listCelebrations(db, p)).some(e => e.kind === 'task_completed')).toBe(false); await db.prepare("UPDATE tasks SET status='COMPLETED',completed_by_user_id=? WHERE id='exp_task'").bind(p.id).run(); const e = (await listCelebrations(db, p)).find(e => e.kind === 'task_completed')!; expect(e.actorId).toBe(p.id); expect((await listCelebrations(db, client)).some(e => e.kind === 'task_completed')).toBe(false); await db.prepare("UPDATE tasks SET status='TODO' WHERE id='exp_task'").run(); expect(await claimCelebration(db, p, e.id)).toBe(false); await db.prepare("UPDATE tasks SET status='COMPLETED' WHERE id='exp_task'").run(); expect(await claimCelebration(db, p, e.id)).toBe(false); expect((await listCelebrations(db, p)).filter(x => x.kind === 'task_completed')).toHaveLength(1); });
    it('financial milestones distinguish partial settlement, full payment, and commercial access', async () => {
        await db.prepare("INSERT INTO receipts(id,org_id,project_id,amount_minor,unallocated_minor,received_date,payment_method,status,reported_by_user_id,created_at) VALUES('exp_receipt',?,'exp_project',100,100,'2026-11-25','NEFT','REPORTED',?,1)").bind(org, p.id).run();
        expect((await listCelebrations(db, p)).some(e => e.kind === 'receipt_confirmed')).toBe(false);
        await db.prepare("UPDATE receipts SET status='CONFIRMED',confirmed_by_user_id=? WHERE id='exp_receipt'").bind(p.id).run();
        const receipt = (await listCelebrations(db, p)).find(e => e.kind === 'receipt_confirmed')!;
        expect(receipt).toBeTruthy();
        expect(await claimCelebration(db, client, receipt.id)).toBe(false);
        await db.prepare("UPDATE project_memberships SET finance_access=1 WHERE id='exp_pm'").run();
        expect((await listCelebrations(db, client)).find(e => e.kind === 'receipt_confirmed')?.quiet).toBe(true);
        await db.prepare("INSERT INTO invoices(id,org_id,project_id,status,total_minor,outstanding_minor,created_by_user_id,created_at) VALUES('exp_invoice',?,'exp_project','ISSUED',100,100,?,1)").bind(org, p.id).run();
        await db.prepare("UPDATE invoices SET outstanding_minor=50,allocated_minor=50,settlement_status='PARTIALLY_PAID' WHERE id='exp_invoice'").run();
        expect((await listCelebrations(db, p)).some(e => e.kind === 'invoice_settled')).toBe(false);
        await db.prepare("UPDATE invoices SET outstanding_minor=0,allocated_minor=100,settlement_status='PAID' WHERE id='exp_invoice'").run();
        expect((await listCelebrations(db, p)).some(e => e.kind === 'invoice_settled')).toBe(true);
    });
    it('turning celebrations off prevents claim even for an event fetched earlier', async () => { const e = (await listCelebrations(db, p))[0]; await setAppearance(db, p, { theme: 'system', celebrations: 'off' }); expect(await claimCelebration(db, p, e.id)).toBe(false); });
});
