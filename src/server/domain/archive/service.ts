import type { UserPrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canViewFinancials,
} from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";
import { atomicGuard } from "@/server/db/atomic";
import {
  createRecoveryCheckpoint,
  restoreRecoveryCheckpoint,
} from "./recovery";
export interface ArchiveProjectParams {
  projectId: string;
  reason: string;
  expectedRevision?: number;
  idempotencyKey?: string;
}
export interface ReopenProjectParams extends ArchiveProjectParams {}
export interface SettleArchivedInvoiceParams {
  projectId: string;
  invoiceId: string;
  amountMinor: number;
  receiptId?: string;
  notes?: string;
  idempotencyKey?: string;
}
export class ArchiveService {
  static async assertProjectNotArchived(db: D1Database, projectId: string) {
    const p = await queryFirst<any>(
      db,
      "SELECT is_archived,status FROM projects WHERE id=?",
      [projectId],
    );
    if (p && (p.is_archived === 1 || p.status === "ARCHIVED"))
      throw new AuthorizationError(
        "Project is archived and read-only. Operational changes are not permitted.",
        "PROJECT_ARCHIVED_READ_ONLY",
      );
  }
  static async transition(
    db: D1Database,
    p: UserPrincipal,
    params: ArchiveProjectParams,
    reopen: boolean,
  ) {
    assertProjectAccess(p, params.projectId);
    if (!hasCapability(p, "MANAGER", params.projectId))
      throw new AuthorizationError(
        "Only the assigned manager can change archive status.",
      );
    if (!params.reason?.trim())
      throw new AuthorizationError("A reason is required.", "INVALID_INPUT");
    const project = await queryFirst<any>(
      db,
      "SELECT * FROM projects WHERE id=? AND org_id=?",
      [params.projectId, p.orgId],
    );
    if (!project)
      throw new AuthorizationError("Project not found.", "NOT_FOUND");
    if (reopen ? !project.is_archived : project.is_archived)
      throw new AuthorizationError(
        "Project archive status has changed. Refresh and try again.",
        "CONFLICT",
      );
    if (
      params.expectedRevision !== undefined &&
      params.expectedRevision !== project.revision
    )
      throw new AuthorizationError(
        "Project has changed. Refresh and try again.",
        "CONFLICT",
      );
    const tasks = await queryFirst<any>(
      db,
      "SELECT COUNT(*) AS n FROM tasks WHERE project_id=? AND status NOT IN('COMPLETED','CANCELLED')",
      [params.projectId],
    );
    const snags = await queryFirst<any>(
      db,
      "SELECT COUNT(*) AS n FROM snags WHERE project_id=? AND status NOT IN('VERIFIED_CLOSED','CLOSED','CANCELLED')",
      [params.projectId],
    );
    const invoices = await queryFirst<any>(
      db,
      "SELECT COUNT(*) AS n,COALESCE(SUM(outstanding_minor),0) AS amount FROM invoices WHERE project_id=? AND status='ISSUED' AND outstanding_minor>0",
      [params.projectId],
    );
    const target = reopen ? project.pre_archive_status || "PAUSED" : "ARCHIVED";
    const now = Date.now();
    await db.batch([
      atomicGuard(
        db,
        `EXISTS(SELECT 1 FROM projects WHERE id=? AND org_id=? AND revision=? AND is_archived=?)`,
        [params.projectId, p.orgId, project.revision, reopen ? 1 : 0],
      ),
      // Recheck live account and manager assignment inside the write transaction.
      atomicGuard(
        db,
        `EXISTS(SELECT 1 FROM users u JOIN organization_memberships om ON om.user_id=u.id JOIN project_memberships pm ON pm.user_id=u.id AND pm.org_id=om.org_id WHERE u.id=? AND u.status='ACTIVE' AND om.org_id=? AND om.is_active=1 AND pm.project_id=? AND pm.is_active=1 AND pm.project_role='MANAGER')`,
        [p.id, p.orgId, params.projectId],
      ),
      db
        .prepare(
          `UPDATE projects SET status=?,is_archived=?,archive_reason=?,archived_at=?,pre_archive_status=?,revision=revision+1 WHERE id=?`,
        )
        .bind(
          target,
          reopen ? 0 : 1,
          reopen ? null : params.reason.trim(),
          reopen ? null : now,
          reopen ? null : project.status,
          params.projectId,
        ),
      db
        .prepare(
          `INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,scope,old_state,new_state,reason,created_at) VALUES(?,?,?,'PROJECT',?,?,'PROJECT',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          p.orgId,
          p.id,
          params.projectId,
          reopen ? "PROJECT_REOPENED" : "PROJECT_ARCHIVED",
          project.status,
          JSON.stringify({
            status: target,
            unresolvedTasks: tasks?.n,
            unresolvedSnags: snags?.n,
            outstandingMinor: invoices?.amount,
          }),
          params.reason.trim(),
          now,
        ),
      db
        .prepare(
          `INSERT INTO outbox_events(id,org_id,event_type,entity_type,entity_id,payload_json,status,created_at) VALUES(?,?,?,'PROJECT',?,?,'PENDING',?)`,
        )
        .bind(
          crypto.randomUUID(),
          p.orgId,
          reopen ? "PROJECT_REOPENED" : "PROJECT_ARCHIVED",
          params.projectId,
          JSON.stringify({ status: target }),
          now,
        ),
      ...(!reopen
        ? [
            db
              .prepare(
                "UPDATE notifications SET status='SUPPRESSED',suppression_reason='PROJECT_ARCHIVED' WHERE project_id=? AND source_entity_type!='INVOICE' AND status IN('QUEUED','FAILED')",
              )
              .bind(params.projectId),
          ]
        : []),
    ]);
    return {
      projectId: params.projectId,
      status: target,
      archivedAt: reopen ? null : now,
      reopenedAt: reopen ? now : null,
      archiveReason: reopen ? null : params.reason.trim(),
      reopenReason: reopen ? params.reason.trim() : null,
      openTasksCount: tasks?.n || 0,
      openSnagsCount: snags?.n || 0,
      unpaidInvoicesCount: invoices?.n || 0,
      totalUnpaidMinor: invoices?.amount || 0,
    };
  }
  static archiveProject(
    db: D1Database,
    p: UserPrincipal,
    input: ArchiveProjectParams,
  ) {
    return this.transition(db, p, input, false);
  }
  static reopenProject(
    db: D1Database,
    p: UserPrincipal,
    input: ReopenProjectParams,
  ) {
    return this.transition(db, p, input, true);
  }
  static async settleArchivedInvoice(
    db: D1Database,
    p: UserPrincipal,
    input: SettleArchivedInvoiceParams,
  ) {
    if (!hasCapability(p, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can record financial settlements on archived projects.",
      );
    const project = await queryFirst<any>(
      db,
      "SELECT id FROM projects WHERE id=? AND org_id=? AND is_archived=1",
      [input.projectId, p.orgId],
    );
    if (!project)
      throw new AuthorizationError("Archived project not found.", "NOT_FOUND");
    if (!input.receiptId || !input.idempotencyKey)
      throw new AuthorizationError(
        "Select an existing confirmed receipt and supply an operation key.",
        "INVALID_INPUT",
      );
    const invoice = await queryFirst<any>(
      db,
      "SELECT outstanding_minor FROM invoices WHERE id=? AND project_id=? AND org_id=?",
      [input.invoiceId, input.projectId, p.orgId],
    );
    if (!invoice)
      throw new AuthorizationError("Invoice not found.", "NOT_FOUND");
    const { FinanceService } = await import("../finance/service");
    const allocation = await FinanceService.allocateReceipt(db, p, {
      receiptId: input.receiptId,
      invoiceId: input.invoiceId,
      amountMinor: input.amountMinor,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      invoiceId: input.invoiceId,
      settledAmountMinor: allocation.allocatedMinor,
      previousOutstandingMinor:
        allocation.invoiceOutstandingMinor + allocation.allocatedMinor,
      remainingOutstandingMinor: allocation.invoiceOutstandingMinor,
      settlementStatus: allocation.invoiceSettlementStatus,
    };
  }

  static async getArchivedProjectRecords(
    db: D1Database,
    p: UserPrincipal,
    projectId: string,
  ) {
    assertProjectAccess(p, projectId);
    const current = await queryFirst<any>(
      db,
      "SELECT u.id FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=? AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1",
      [p.id, p.orgId],
    );
    if (!current) throw new AuthorizationError("Access is no longer active.");
    const globalGrants = await query<{ role: any }>(
      db,
      "SELECT role FROM role_assignments WHERE org_id=? AND user_id=? AND revoked_at IS NULL AND scope='GLOBAL'",
      [p.orgId, p.id],
    );
    const projectGrants = await query<any>(
      db,
      "SELECT * FROM project_memberships WHERE org_id=? AND user_id=? AND project_id=? AND is_active=1",
      [p.orgId, p.id, projectId],
    );
    p = {
      ...p,
      roles: globalGrants.map((g) => g.role),
      projectMemberships: projectGrants.map((g) => ({
        projectId: g.project_id,
        projectRole: g.project_role,
        roles: [g.project_role],
        financeAccess: g.finance_access === 1,
        financeAuthor: g.finance_author === 1,
        invoiceIssue: g.invoice_issue === 1,
      })),
    };
    if (!hasCapability(p, "ADMIN") && !hasCapability(p, "OWNER")) {
      const member = await queryFirst<any>(
        db,
        "SELECT id FROM project_memberships WHERE project_id=? AND user_id=? AND org_id=? AND is_active=1",
        [projectId, p.id, p.orgId],
      );
      if (!member)
        throw new AuthorizationError(
          "Access denied: You do not have active membership in this archived project.",
          "CROSS_PROJECT_DENIED",
        );
    }
    const project = await queryFirst<any>(
      db,
      "SELECT * FROM projects WHERE id=? AND org_id=? AND is_archived=1",
      [projectId, p.orgId],
    );
    if (!project)
      throw new AuthorizationError("Archived project not found.", "NOT_FOUND");
    const releasedDrawings = await query<any>(
      db,
      `SELECT d.id AS drawing_id,d.drawing_number,d.title AS drawing_title,d.discipline,dv.id AS version_id,dv.version_label,dv.status AS version_status,dv.released_at,f.id AS file_id,f.file_name,f.size_bytes,(d.current_released_version_id=dv.id) AS is_current_release FROM drawings d JOIN drawing_versions dv ON dv.drawing_id=d.id LEFT JOIN files f ON f.id=dv.file_id WHERE d.project_id=? AND d.is_withdrawn=0 AND dv.status IN('RELEASED','SUPERSEDED') AND dv.released_at IS NOT NULL ORDER BY d.drawing_number,dv.created_at DESC`,
      [projectId],
    );
    const publishedUpdates = await query<any>(
      db,
      `SELECT pu.id AS update_id,uv.id AS version_id,uv.title,uv.body_text,uv.observed_date,uv.published_at FROM project_updates pu JOIN update_versions uv ON uv.id=pu.current_published_version_id WHERE pu.project_id=? AND pu.is_retracted=0 AND uv.status='PUBLISHED' ORDER BY uv.published_at DESC`,
      [projectId],
    );
    const unpaidInvoices = canViewFinancials(p, projectId, "CLIENT_COMMERCIAL")
      ? await query<any>(
          db,
          "SELECT id,invoice_number,total_minor,allocated_minor,outstanding_minor,due_date,status,settlement_status FROM invoices WHERE project_id=? AND status='ISSUED' AND outstanding_minor>0 ORDER BY due_date",
          [projectId],
        )
      : [];
    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        isArchived: true,
        archiveReason: project.archive_reason,
        archivedAt: project.archived_at,
      },
      releasedDrawings,
      publishedUpdates,
      unpaidInvoices,
    };
  }
  static exportProjectBackup(
    db: D1Database,
    source: R2Bucket,
    p: UserPrincipal,
    projectId: string,
    backup?: R2Bucket,
  ) {
    return createRecoveryCheckpoint(db, source, backup, p, projectId);
  }
  static restoreBackupToIsolatedEnv(
    targetDb: D1Database,
    backup: R2Bucket,
    target: R2Bucket,
    key: string,
    sha256: string,
  ) {
    return restoreRecoveryCheckpoint(targetDb, backup, target, key, sha256);
  }
}
