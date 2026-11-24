import { businessDateISO } from "@/shared/config";
import { canReadFile } from "@/server/files/visibility";
import { assertProjectOrganisation } from "@/server/auth/policy";
import { canViewFinancials } from "@/server/auth/policy";
/**
 * Domain service for Role Dashboards, Actionable "Waiting-on-you" Queue,
 * Evidence-based Owner Performance, and Calm Client Overview.
 * Enforces AC-051, AC-052, AC-053 and REQ-DAS-001 through REQ-DAS-005.
 */

import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal, hasCapability } from "../../auth/principal";
import {
  assertProjectAccess,
  canAccessProject,
  canViewIndividualPerformance,
  canViewPayrollAndProfit,
  canReadInternalNotes,
  AuthorizationError,
} from "../../auth/policy";

export type WaitingUrgency = "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface WaitingItem {
  id: string;
  entityType:
    | "TASK"
    | "TASK_ASSIGNMENT"
    | "DRAWING_REVIEW"
    | "DRAWING_RELEASE"
    | "INVOICE_APPROVAL"
    | "INVOICE_ISSUE"
    | "CHANGE_DECISION"
    | "CHANGE_ESTIMATE"
    | "CHANGE_AUTHORIZATION"
    | "MATERIAL_DECISION"
    | "QUOTE_DECISION"
    | "RECEIPT_CONFIRMATION"
    | "SNAG_TRIAGE"
    | "SNAG_VERIFICATION"
    | "SNAG_REMEDIATION"
    | "PAYMENT_DUE"
    | "ESCALATION";
  entityId: string;
  entityVersion?: number | string | null;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  title: string;
  description: string;
  requiredAction: string;
  urgency: WaitingUrgency;
  isOverdue: boolean;
  dueDate: string | null;
  link: string;
  createdAt: number;
}

export interface OwnerPerformanceMetrics {
  periodDays: number;
  definitions: {
    deadlineAdherence: string;
    reworkVsClientScope: string;
    siteProgress: string;
  };
  teamMetrics: Array<{
    userId: string;
    displayName: string;
    email: string;
    role: string;
    completedTasksCount: number;
    onTimeCount: number;
    onTimePercentage: string | null;
    overdueTasksCount: number;
    reopenedTasksCount: number; // Internal quality rework
    clientScopeRevisionsCount: number; // Client-driven changes, NOT employee error
    tasks: Array<{
      id: string;
      title: string;
      projectCode: string;
      originalDueDate: string | null;
      currentDueDate: string | null;
      completedAt: number | null;
      status: string;
      reopenCount: number;
      isClientScopeChange: boolean;
      deadlineChangeReason: string | null;
    }>;
  }>;
  projectStageProgress: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    stageName: string;
    status: string;
    plannedStartDate: string | null;
    plannedCompletionDate: string | null;
    actualCompletionDate: string | null;
  }>;
}

export interface ClientOverviewData {
  project: {
    id: string;
    code: string;
    name: string;
    stage?: string | null;
    siteAddress?: string | null;
    status: string;
    currentStageName?: string | null;
    nextMilestone?: { name: string; targetDate: string | null } | null;
  };
  publishedUpdates: Array<{
    id: string;
    title: string;
    summary: string | null;
    body: string;
    updateType: string;
    publishedAt: number | null;
  }>;
  releasedDrawings: Array<{
    id: string;
    drawingNumber: string;
    title: string;
    discipline: string;
    versionNumber: number | string;
    releasedAt: number | null;
    fileId?: string | null;
    fileName?: string | null;
  }>;
  billingSummary: {
    nextDueInvoice: {
      invoiceNumber: string;
      balanceMinor: number;
      dueDate: string | null;
      status: string;
    } | null;
    totalInvoicedMinor: number;
    totalPaidMinor: number;
    outstandingBalanceMinor: number;
  } | null;
  pendingDecisions: {
    quotations: Array<{ id: string; quoteNumber: string; status: string }>;
    changeRequests: Array<{
      id: string;
      referenceNumber: string;
      title: string;
      versionNumber: number;
      costMinor: number;
      timelineImpactDays: number;
    }>;
    materialSelections: Array<{
      id: string;
      title: string;
      dueDate: string | null;
      optionsCount: number;
    }>;
  };
}

export class DashboardService {
  /**
   * Actionable "Waiting-on-you" Queue (AC-051, REQ-DAS-001, REQ-DAS-003).
   * Strictly filters actionable source records for the authenticated user's role.
   */
  static async getWaitingOnYou(
    db: D1Database,
    principal: UserPrincipal,
    options?: { projectId?: string },
  ): Promise<WaitingItem[]> {
    const items: WaitingItem[] = [];
    const now = new Date();
    const nowIso = businessDateISO(now); // YYYY-MM-DD
    const isOwner = hasCapability(principal, "OWNER");
    const isAdmin = hasCapability(principal, "ADMIN");
    const isManager = principal.projectMemberships.some((m) =>
      hasCapability(principal, "MANAGER", m.projectId),
    );
    const isStaff =
      principal.projectMemberships.some((m) =>
        hasCapability(principal, "STAFF", m.projectId),
      ) ||
      principal.projectMemberships.some((m) =>
        hasCapability(principal, "TEAM_MEMBER", m.projectId),
      ) ||
      isManager;
    const isConsultant = principal.projectMemberships.some((m) =>
      hasCapability(principal, "CONSULTANT", m.projectId),
    );
    const isMainClient = principal.projectMemberships.some((m) =>
      hasCapability(principal, "MAIN_CLIENT", m.projectId),
    );
    const isClientRep = principal.projectMemberships.some((m) =>
      hasCapability(principal, "CLIENT_REP", m.projectId),
    );

    // 1. Assigned open tasks for Staff / Assignee
    if (isStaff) {
      let taskQuery = `
        SELECT t.*, p.code as project_code, p.name as project_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.assignee_user_id = ? AND t.status IN ('TODO', 'IN_PROGRESS', 'BLOCKED') AND p.status != 'ARCHIVED'
      `;
      const params: any[] = [principal.id];
      if (options?.projectId) {
        taskQuery += ` AND t.project_id = ?`;
        params.push(options.projectId);
      }

      const tasks = await db
        .prepare(taskQuery)
        .bind(...params)
        .all<any>();
      for (const t of tasks.results || []) {
        const dueDate = t.effective_due_date || t.original_due_date;
        const isOverdue = !!(dueDate && dueDate < nowIso);
        let urgency: WaitingUrgency = "NORMAL";
        if (isOverdue || t.status === "BLOCKED") urgency = "URGENT";
        else if (dueDate && dueDate <= nowIso) urgency = "HIGH";

        items.push({
          id: `task:${t.id}`,
          entityType: "TASK",
          entityId: t.id,
          projectId: t.project_id,
          projectCode: t.project_code,
          projectName: t.project_name,
          title: t.title,
          description: t.description || `Task in ${t.status} status`,
          requiredAction:
            t.status === "BLOCKED"
              ? "Resolve blocker & continue task"
              : "Complete assigned task",
          urgency,
          isOverdue,
          dueDate,
          link: `/projects/${t.project_id}/tasks?taskId=${t.id}`,
          createdAt: t.created_at || Date.now(),
        });
      }

      // Snag remediation assigned to this staff member
      let snagRemQuery = `
        SELECT s.*, p.code as project_code, p.name as project_name
        FROM snags s
        JOIN projects p ON p.id = s.project_id
        WHERE s.assigned_to_user_id = ? AND s.status IN ('OPEN', 'IN_PROGRESS', 'REOPENED') AND p.status != 'ARCHIVED'
      `;
      const snagRemParams: any[] = [principal.id];
      if (options?.projectId) {
        snagRemQuery += ` AND s.project_id = ?`;
        snagRemParams.push(options.projectId);
      }
      const snagsToFix = await db
        .prepare(snagRemQuery)
        .bind(...snagRemParams)
        .all<any>();
      for (const s of snagsToFix.results || []) {
        const isOverdue = !!(s.target_date && s.target_date < nowIso);
        const urgency: WaitingUrgency =
          isOverdue || s.severity === "URGENT"
            ? "URGENT"
            : s.severity === "HIGH"
              ? "HIGH"
              : "NORMAL";
        items.push({
          id: `snag_rem:${s.id}`,
          entityType: "SNAG_REMEDIATION",
          entityId: s.id,
          projectId: s.project_id,
          projectCode: s.project_code,
          projectName: s.project_name,
          title: `${s.snag_number}: ${s.title}`,
          description: `Site issue requiring remediation (${s.severity})`,
          requiredAction: "Remediate and submit resolution evidence",
          urgency,
          isOverdue,
          dueDate: s.target_date,
          link: `/projects/${s.project_id}/snags?snagId=${s.id}`,
          createdAt: s.created_at || Date.now(),
        });
      }
    }

    // 2. Consultant drawing reviews (CONSULTANT ONLY)
    if (isConsultant) {
      let revQuery = `
        SELECT dr.*, dv.version_label as version_number,
               d.id as drawing_id, d.drawing_number, d.title as drawing_title, d.project_id,
               p.code as project_code, p.name as project_name
        FROM drawing_reviews dr
        JOIN drawing_versions dv ON dv.id = dr.version_id
        JOIN drawings d ON d.id = dv.drawing_id
        JOIN projects p ON p.id = d.project_id
        WHERE dr.consultant_user_id = ?
          AND dr.status = 'PENDING'
          AND dv.status IN ('IN_REVIEW', 'AWAITING_REVIEWS')
          AND p.status != 'ARCHIVED'
      `;
      const revParams: any[] = [principal.id];
      if (options?.projectId) {
        revQuery += ` AND d.project_id = ?`;
        revParams.push(options.projectId);
      }
      const reviews = await db
        .prepare(revQuery)
        .bind(...revParams)
        .all<any>();
      for (const r of reviews.results || []) {
        items.push({
          id: `review:${r.id}`,
          entityType: "DRAWING_REVIEW",
          entityId: r.id,
          entityVersion: r.version_number,
          projectId: r.project_id,
          projectCode: r.project_code,
          projectName: r.project_name,
          title: `${r.drawing_number} ${r.version_number}: ${r.drawing_title}`,
          description: `Discipline drawing review awaiting your technical decision`,
          requiredAction: `Review drawing ${r.version_number} & approve or return`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${r.project_id}/drawings?drawingId=${r.drawing_id}&version=${r.version_number}`,
          createdAt: r.created_at || Date.now(),
        });
      }
    }

    // 3. Manager releases and triage (MANAGER / ADMIN / OWNER)
    if (isManager) {
      // Drawings awaiting manager release (consultant reviews completed!)
      let relQuery = `
        SELECT dv.*, dv.version_label as version_number,
               d.id as drawing_id, d.drawing_number, d.title as drawing_title, d.project_id,
               p.code as project_code, p.name as project_name
        FROM drawing_versions dv
        JOIN drawings d ON d.id = dv.drawing_id
        JOIN projects p ON p.id = d.project_id
        WHERE dv.status IN ('CONSULTANT_APPROVED', 'AWAITING_RELEASE') AND p.status != 'ARCHIVED'
      `;
      const relParams: any[] = [];
      if (options?.projectId) {
        relQuery += ` AND d.project_id = ?`;
        relParams.push(options.projectId);
      }
      const releases = await db
        .prepare(relQuery)
        .bind(...relParams)
        .all<any>();
      for (const r of releases.results || []) {
        items.push({
          id: `release:${r.id}`,
          entityType: "DRAWING_RELEASE",
          entityId: r.id,
          entityVersion: r.version_number,
          projectId: r.project_id,
          projectCode: r.project_code,
          projectName: r.project_name,
          title: `${r.drawing_number} ${r.version_number}: ${r.drawing_title}`,
          description: `All consultant reviews approved. Ready for manager final release.`,
          requiredAction: `Release drawing ${r.version_number} to client & site`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${r.project_id}/drawings?drawingId=${r.drawing_id}&version=${r.version_number}`,
          createdAt: r.created_at || Date.now(),
        });
      }

      // Invoices awaiting manager review / approval
      let invQuery = `
        SELECT i.*, p.code as project_code, p.name as project_name
        FROM invoices i
        JOIN projects p ON p.id = i.project_id
        WHERE i.status IN ('DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL') AND p.status != 'ARCHIVED'
      `;
      const invParams: any[] = [];
      if (options?.projectId) {
        invQuery += ` AND i.project_id = ?`;
        invParams.push(options.projectId);
      }
      const draftInvoices = await db
        .prepare(invQuery)
        .bind(...invParams)
        .all<any>();
      for (const i of draftInvoices.results || []) {
        items.push({
          id: `invoice_appr:${i.id}`,
          entityType: "INVOICE_APPROVAL",
          entityId: i.id,
          projectId: i.project_id,
          projectCode: i.project_code,
          projectName: i.project_name,
          title: `Invoice ${i.invoice_number || i.id}`,
          description: `Invoice drafted or submitted for review. Approval required before issuing.`,
          requiredAction: `Review & approve invoice ${i.invoice_number || i.id}`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: i.due_date,
          link: `/projects/${i.project_id}/finance?invoiceId=${i.id}`,
          createdAt: i.created_at || Date.now(),
        });
      }

      // Change requests awaiting manager estimate
      let crEstQuery = `
        SELECT cr.*, COALESCE(cr.request_number, cr.id) as reference_number, p.code as project_code, p.name as project_name
        FROM change_requests cr
        JOIN projects p ON p.id = cr.project_id
        WHERE cr.status IN ('REQUESTED', 'ESTIMATING', 'AWAITING_ESTIMATE') AND p.status != 'ARCHIVED'
      `;
      const crEstParams: any[] = [];
      if (options?.projectId) {
        crEstQuery += ` AND cr.project_id = ?`;
        crEstParams.push(options.projectId);
      }
      const crEstimates = await db
        .prepare(crEstQuery)
        .bind(...crEstParams)
        .all<any>();
      for (const cr of crEstimates.results || []) {
        items.push({
          id: `cr_est:${cr.id}`,
          entityType: "CHANGE_ESTIMATE",
          entityId: cr.id,
          projectId: cr.project_id,
          projectCode: cr.project_code,
          projectName: cr.project_name,
          title: `${cr.reference_number}: ${cr.title}`,
          description: `Change request submitted. Manager must prepare cost & schedule estimate.`,
          requiredAction: `Prepare estimate for ${cr.reference_number}`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${cr.project_id}/changes?changeId=${cr.id}`,
          createdAt: cr.created_at || Date.now(),
        });
      }

      // Change requests accepted by client awaiting manager final authorization
      let crAuthQuery = `
        SELECT cr.*, COALESCE(cr.request_number, cr.id) as reference_number,
               crv.version_number, p.code as project_code, p.name as project_name
        FROM change_requests cr
        JOIN change_request_versions crv ON (crv.change_request_id = cr.id AND crv.version_number = cr.current_version_number)
        JOIN projects p ON p.id = cr.project_id
        WHERE cr.status IN ('PAYMENT_CONFIRMED', 'ACCEPTED_AWAITING_PAYMENT', 'CLIENT_ACCEPTED') AND p.status != 'ARCHIVED'
      `;
      const crAuthParams: any[] = [];
      if (options?.projectId) {
        crAuthQuery += ` AND cr.project_id = ?`;
        crAuthParams.push(options.projectId);
      }
      const crAuths = await db
        .prepare(crAuthQuery)
        .bind(...crAuthParams)
        .all<any>();
      for (const cr of crAuths.results || []) {
        items.push({
          id: `cr_auth:${cr.id}`,
          entityType: "CHANGE_AUTHORIZATION",
          entityId: cr.id,
          entityVersion: cr.version_number,
          projectId: cr.project_id,
          projectCode: cr.project_code,
          projectName: cr.project_name,
          title: `${cr.reference_number} v${cr.version_number}: ${cr.title}`,
          description: `Client accepted estimate. Ready for manager authorization.`,
          requiredAction: `Authorize change request ${cr.reference_number}`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${cr.project_id}/changes?changeId=${cr.id}`,
          createdAt: cr.created_at || Date.now(),
        });
      }

      // Snags awaiting triage or verification
      let snagTriageQuery = `
        SELECT s.*, p.code as project_code, p.name as project_name
        FROM snags s
        JOIN projects p ON p.id = s.project_id
        WHERE s.status = 'REPORTED' AND p.status != 'ARCHIVED'
      `;
      const snagTriageParams: any[] = [];
      if (options?.projectId) {
        snagTriageQuery += ` AND s.project_id = ?`;
        snagTriageParams.push(options.projectId);
      }
      const reportedSnags = await db
        .prepare(snagTriageQuery)
        .bind(...snagTriageParams)
        .all<any>();
      for (const s of reportedSnags.results || []) {
        items.push({
          id: `snag_triage:${s.id}`,
          entityType: "SNAG_TRIAGE",
          entityId: s.id,
          projectId: s.project_id,
          projectCode: s.project_code,
          projectName: s.project_name,
          title: `${s.snag_number}: ${s.title}`,
          description: `New issue reported on site. Requires triage, priority, and staff assignment.`,
          requiredAction: `Triage and assign ${s.snag_number}`,
          urgency: s.severity === "URGENT" ? "URGENT" : "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${s.project_id}/snags?snagId=${s.id}`,
          createdAt: s.created_at || Date.now(),
        });
      }

      let snagVerQuery = `
        SELECT s.*, p.code as project_code, p.name as project_name
        FROM snags s
        JOIN projects p ON p.id = s.project_id
        WHERE s.status = 'READY_FOR_VERIFICATION' AND p.status != 'ARCHIVED'
      `;
      const snagVerParams: any[] = [];
      if (options?.projectId) {
        snagVerQuery += ` AND s.project_id = ?`;
        snagVerParams.push(options.projectId);
      }
      const verSnags = await db
        .prepare(snagVerQuery)
        .bind(...snagVerParams)
        .all<any>();
      for (const s of verSnags.results || []) {
        items.push({
          id: `snag_ver:${s.id}`,
          entityType: "SNAG_VERIFICATION",
          entityId: s.id,
          projectId: s.project_id,
          projectCode: s.project_code,
          projectName: s.project_name,
          title: `${s.snag_number}: ${s.title}`,
          description: `Staff submitted resolution evidence. Manager verification inspection required.`,
          requiredAction: `Inspect and verify closure for ${s.snag_number}`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${s.project_id}/snags?snagId=${s.id}`,
          createdAt: s.created_at || Date.now(),
        });
      }
    }

    // Receipt confirmation and explicitly granted invoice issue actions.
    if (isAdmin || principal.projectMemberships.some((m) => m.invoiceIssue)) {
      // Reported receipts awaiting confirmation
      const repReceipts = await db
        .prepare(
          `SELECT * FROM receipts WHERE org_id=? AND ?=1 AND status = 'REPORTED'`,
        )
        .bind(principal.orgId, Number(isAdmin))
        .all<any>();
      for (const r of repReceipts.results || []) {
        items.push({
          id: `receipt_conf:${r.id}`,
          entityType: "RECEIPT_CONFIRMATION",
          entityId: r.id,
          projectId: r.project_id,
          title: `Reported Receipt ${r.receipt_number}`,
          description: `Client reported payment of ₹${((r.amount_minor || 0) / 100).toLocaleString("en-IN")}. Verify bank credit and confirm.`,
          requiredAction: `Confirm or reject receipt ${r.receipt_number}`,
          urgency: "HIGH",
          isOverdue: false,
          dueDate: null,
          link: `/projects/${r.project_id}/finance`,
          createdAt: r.created_at || Date.now(),
        });
      }

      // Approved invoices awaiting issue
      let appInvQuery = `
        SELECT i.*, p.code as project_code, p.name as project_name
        FROM invoices i
        JOIN projects p ON p.id = i.project_id
        WHERE i.status = 'APPROVED' AND p.status != 'ARCHIVED'
      `;
      const appInvoices = await db.prepare(appInvQuery).all<any>();
      for (const i of appInvoices.results || []) {
        items.push({
          id: `inv_issue:${i.id}`,
          entityType: "INVOICE_ISSUE",
          entityId: i.id,
          projectId: i.project_id,
          projectCode: i.project_code,
          projectName: i.project_name,
          title: `Invoice ${i.invoice_number}`,
          description: `Manager approved invoice. Ready for official distribution/issue.`,
          requiredAction: `Issue invoice ${i.invoice_number}`,
          urgency: "NORMAL",
          isOverdue: false,
          dueDate: i.due_date,
          link: `/projects/${i.project_id}/finance?invoiceId=${i.id}`,
          createdAt: i.created_at || Date.now(),
        });
      }
    }

    // 5. Main Client actions (MAIN_CLIENT ONLY - AC-001, AC-004, AC-051)
    // NOTE: Client Representatives are strictly excluded from binding decisions!
    if (isMainClient) {
      // Get projects where user is MAIN_CLIENT
      const clientMemberships = principal.projectMemberships.filter(
        (pm) =>
          pm.projectRole === "MAIN_CLIENT" ||
          principal.projectMemberships.some((m) =>
            hasCapability(principal, "MAIN_CLIENT", m.projectId),
          ),
      );
      const projectIds = clientMemberships.map((m) => m.projectId);

      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => "?").join(",");

        // Change requests awaiting client acceptance (exact version)
        let crCliQuery = `
          SELECT cr.*, COALESCE(cr.request_number, cr.id) as reference_number,
                 crv.version_number,
                 COALESCE(crv.total_minor, crv.price_minor, 0) as cost_minor,
                 COALESCE(crv.schedule_impact_days, 0) as timeline_impact_days,
                 p.code as project_code, p.name as project_name
          FROM change_requests cr
          JOIN change_request_versions crv ON (crv.change_request_id = cr.id AND crv.version_number = cr.current_version_number)
          JOIN projects p ON p.id = cr.project_id
          WHERE cr.status = 'AWAITING_CLIENT' AND cr.project_id IN (${placeholders}) AND p.status != 'ARCHIVED'
        `;
        const crCliList = await db
          .prepare(crCliQuery)
          .bind(...projectIds)
          .all<any>();
        for (const cr of crCliList.results || []) {
          items.push({
            id: `cr_dec:${cr.id}`,
            entityType: "CHANGE_DECISION",
            entityId: cr.id,
            entityVersion: cr.version_number,
            projectId: cr.project_id,
            projectCode: cr.project_code,
            projectName: cr.project_name,
            title: `${cr.reference_number} v${cr.version_number}: ${cr.title}`,
            description: `Proposed scope adjustment: ₹${((cr.cost_minor || 0) / 100).toLocaleString("en-IN")}, ${cr.timeline_impact_days || 0} days impact.`,
            requiredAction: `Accept or decline estimate v${cr.version_number}`,
            urgency: "HIGH",
            isOverdue: false,
            dueDate: null,
            link: `/projects/${cr.project_id}/changes?changeId=${cr.id}&version=${cr.version_number}`,
            createdAt: cr.created_at || Date.now(),
          });
        }

        // Material selections awaiting decision
        let matQuery = `
          SELECT msi.*, msi.needed_by_date as due_date, p.code as project_code, p.name as project_name
          FROM material_selection_items msi
          JOIN projects p ON p.id = msi.project_id
          WHERE msi.status IN ('PENDING', 'AWAITING_MAIN_CLIENT') AND msi.project_id IN (${placeholders}) AND p.status != 'ARCHIVED'
        `;
        const matItems = await db
          .prepare(matQuery)
          .bind(...projectIds)
          .all<any>();
        for (const m of matItems.results || []) {
          const isOverdue = !!(m.due_date && m.due_date < nowIso);
          items.push({
            id: `mat_dec:${m.id}`,
            entityType: "MATERIAL_DECISION",
            entityId: m.id,
            projectId: m.project_id,
            projectCode: m.project_code,
            projectName: m.project_name,
            title: m.title,
            description: `Material selection pending client choice for ${m.location || m.category || "specification"}.`,
            requiredAction: `Select material option for ${m.title}`,
            urgency: isOverdue ? "URGENT" : "HIGH",
            isOverdue,
            dueDate: m.due_date,
            link: `/projects/${m.project_id}/selections?itemId=${m.id}`,
            createdAt: m.created_at || Date.now(),
          });
        }

        // Quotations awaiting acceptance
        let quoteQuery = `
          SELECT q.*, p.code as project_code, p.name as project_name
          FROM quotations q
          JOIN projects p ON p.id = q.project_id
          WHERE q.status IN ('SENT', 'ISSUED') AND q.project_id IN (${placeholders}) AND p.status != 'ARCHIVED'
        `;
        const quotes = await db
          .prepare(quoteQuery)
          .bind(...projectIds)
          .all<any>();
        for (const q of quotes.results || []) {
          const qName = q.title || `Quotation v${q.version_number}`;
          items.push({
            id: `quote_dec:${q.id}`,
            entityType: "QUOTE_DECISION",
            entityId: q.id,
            projectId: q.project_id,
            projectCode: q.project_code,
            projectName: q.project_name,
            title: qName,
            description: `Project quotation issued for review and acceptance.`,
            requiredAction: `Review and accept ${qName}`,
            urgency: "HIGH",
            isOverdue: false,
            dueDate: null,
            link: `/projects/${q.project_id}/finance`,
            createdAt: q.created_at || Date.now(),
          });
        }

        // Issued invoices with balance due (payment expectations)
        let payDueQuery = `
          SELECT i.*, p.code as project_code, p.name as project_name,
                 i.outstanding_minor as remaining_balance_minor
          FROM invoices i
          JOIN projects p ON p.id = i.project_id
          WHERE i.status = 'ISSUED' AND i.outstanding_minor > 0
            AND i.project_id IN (${placeholders}) AND p.status != 'ARCHIVED'
        `;
        const dueInvoices = await db
          .prepare(payDueQuery)
          .bind(...projectIds)
          .all<any>();
        for (const i of dueInvoices.results || []) {
          const isOverdue = !!(i.due_date && i.due_date < nowIso);
          items.push({
            id: `pay_due:${i.id}`,
            entityType: "PAYMENT_DUE",
            entityId: i.id,
            projectId: i.project_id,
            projectCode: i.project_code,
            projectName: i.project_name,
            title: `Invoice ${i.invoice_number} Payment`,
            description: `Payment due: ₹${((i.remaining_balance_minor || 0) / 100).toLocaleString("en-IN")}`,
            requiredAction: `View invoice & bank payment instructions`,
            urgency: isOverdue ? "URGENT" : "NORMAL",
            isOverdue,
            dueDate: i.due_date,
            link: `/projects/${i.project_id}/finance`,
            createdAt: i.created_at || Date.now(),
          });
        }
      }
    }

    // Sort items by useful urgency:
    // 1. Overdue first (oldest due date first)
    // 2. Urgency: URGENT (1) -> HIGH (2) -> NORMAL (3) -> LOW (4)
    // 3. Nearest due date first
    // 4. Creation time descending
    const urgencyRank: Record<WaitingUrgency, number> = {
      URGENT: 1,
      HIGH: 2,
      NORMAL: 3,
      LOW: 4,
    };

    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      if (a.isOverdue && b.isOverdue && a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      const rankA = urgencyRank[a.urgency];
      const rankB = urgencyRank[b.urgency];
      if (rankA !== rankB) return rankA - rankB;

      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      return b.createdAt - a.createdAt;
    });

    const ownProjectRows = await db
      .prepare("SELECT id FROM projects WHERE org_id=?")
      .bind(principal.orgId)
      .all<any>();
    const ownProjectIds = new Set(ownProjectRows.results.map((p) => p.id));
    return items.filter((item) => {
      if (item.projectId && !ownProjectIds.has(item.projectId)) return false;
      if (item.entityType === "INVOICE_ISSUE")
        return principal.projectMemberships.some(
          (m) =>
            m.projectId === item.projectId &&
            m.invoiceIssue &&
            (hasCapability(principal, "TEAM_MEMBER", m.projectId) ||
              hasCapability(principal, "MANAGER", m.projectId)),
        );
      if (!item.projectId) return hasCapability(principal, "ADMIN");
      if (!canAccessProject(principal, item.projectId)) return false;
      if (item.entityType === "DRAWING_REVIEW")
        return hasCapability(principal, "CONSULTANT", item.projectId);
      if (["TASK", "SNAG_REMEDIATION"].includes(item.entityType))
        return canReadInternalNotes(principal, item.projectId);
      if (item.entityType === "PAYMENT_DUE")
        return canViewFinancials(
          principal,
          item.projectId,
          "CLIENT_COMMERCIAL",
        );
      if (
        [
          "DRAWING_RELEASE",
          "INVOICE_APPROVAL",
          "CHANGE_ESTIMATE",
          "CHANGE_AUTHORIZATION",
          "SNAG_TRIAGE",
          "SNAG_VERIFICATION",
          "TASK_ASSIGNMENT",
        ].includes(item.entityType)
      )
        return hasCapability(principal, "MANAGER", item.projectId);
      if (
        ["QUOTE_DECISION", "CHANGE_DECISION", "MATERIAL_DECISION"].includes(
          item.entityType,
        )
      )
        return principal.projectMemberships.some(
          (m) =>
            m.projectId === item.projectId &&
            m.contractualAuthority &&
            hasCapability(principal, "MAIN_CLIENT", item.projectId),
        );
      if (item.entityType === "RECEIPT_CONFIRMATION")
        return hasCapability(principal, "ADMIN");
      return true;
    });
  }

  /**
   * Evidence-based Team Performance and Rework (AC-052, REQ-DAS-002, REQ-DAS-004, REQ-TSK-006).
   * STRICTLY OWNER-ONLY. Non-owners are denied with FORBIDDEN.
   * Separates client scope revisions from employee defects.
   */
  static async getOwnerPerformanceMetrics(
    db: D1Database,
    principal: UserPrincipal,
    orgId: string,
    options?: { periodDays?: number; projectId?: string },
  ): Promise<OwnerPerformanceMetrics> {
    if (!canViewIndividualPerformance(principal)) {
      throw new AuthorizationError(
        "Forbidden: Individual performance metrics are strictly restricted to the practice Owner.",
        "FORBIDDEN",
      );
    }

    const periodDays = options?.periodDays || 90;

    // Disclosed transparent definitions
    const definitions = {
      deadlineAdherence:
        "Percentage of completed tasks finished on or before agreed baseline deadline (or validly approved client scope extension). Denominator: total completed tasks in period.",
      reworkVsClientScope:
        "Reopened tasks or snag reworks caused by internal quality defects are tracked as internal rework. Client-requested additions or scope revisions are tracked separately and excluded from error counts.",
      siteProgress:
        "Project stage milestone completions verified by the project manager, independent of raw task checklists.",
    };

    // Query team members
    const membersQuery = `
      SELECT u.id, u.display_name, u.email, ra.role
      FROM users u
      JOIN organization_memberships om ON om.user_id = u.id
      JOIN role_assignments ra ON ra.user_id = u.id
      WHERE om.org_id = ? AND ra.role IN ('STAFF', 'TEAM_MEMBER', 'MANAGER') AND ra.revoked_at IS NULL
      ORDER BY u.display_name ASC
    `;
    const members = await db.prepare(membersQuery).bind(orgId).all<any>();

    // Query tasks
    let taskSql = `
      SELECT t.*, p.code as project_code
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.org_id = ?
    `;
    const taskParams: any[] = [orgId];
    if (options?.projectId) {
      taskSql += ` AND t.project_id = ?`;
      taskParams.push(options.projectId);
    }

    const tasksRes = await db
      .prepare(taskSql)
      .bind(...taskParams)
      .all<any>();
    const allTasks = tasksRes.results || [];

    // Query deadline revision events to check for client scope reasons
    const eventsRes = await db
      .prepare(
        `SELECT task_id, event_type, reason FROM task_events WHERE event_type IN ('TASK_DEADLINE_CHANGED', 'DEADLINE_CHANGED')`,
      )
      .all<any>();
    const deadlineEvents = eventsRes.results || [];
    const clientScopeTaskIdSet = new Set<string>();

    for (const ev of deadlineEvents) {
      const reasonLower = (ev.reason || "").toLowerCase();
      if (
        reasonLower.includes("client") ||
        reasonLower.includes("scope") ||
        reasonLower.includes("change request") ||
        reasonLower.includes("variation")
      ) {
        clientScopeTaskIdSet.add(ev.task_id);
      }
    }

    const nowIso = businessDateISO();

    const teamMetrics = (members.results || []).map((m: any) => {
      const memberTasks = allTasks.filter(
        (t: any) => (t.assignee_user_id || t.assignee_id) === m.id,
      );

      let completedTasksCount = 0;
      let onTimeCount = 0;
      let overdueTasksCount = 0;
      let reopenedTasksCount = 0;
      let clientScopeRevisionsCount = 0;

      const formattedTasks = memberTasks.map((t: any) => {
        const isClientScope =
          !!t.change_request_id || clientScopeTaskIdSet.has(t.id);

        const currentDue = t.effective_due_date || t.current_due_date;

        if (t.status === "COMPLETED") {
          completedTasksCount++;
          // Evaluate on-time: compare completed date with due date
          // If deadline was changed due to client scope, compare against current_due_date
          const targetDue = isClientScope
            ? currentDue || t.original_due_date
            : t.original_due_date || currentDue;

          if (targetDue && t.completed_at) {
            const completedIso = new Date(t.completed_at)
              .toISOString()
              .split("T")[0];
            if (completedIso <= targetDue) {
              onTimeCount++;
            }
          } else if (!targetDue) {
            // Undated task counted as completed
            onTimeCount++;
          }
        } else if (t.status !== "CANCELLED") {
          if (currentDue && currentDue < nowIso) {
            overdueTasksCount++;
          }
        }

        if (t.reopen_count && t.reopen_count > 0) {
          reopenedTasksCount += t.reopen_count;
        }

        if (isClientScope) {
          clientScopeRevisionsCount++;
        }

        return {
          id: t.id,
          title: t.title,
          projectCode: t.project_code,
          originalDueDate: t.original_due_date,
          currentDueDate: currentDue,
          completedAt: t.completed_at,
          status: t.status,
          reopenCount: t.reopen_count || 0,
          isClientScopeChange: isClientScope,
          deadlineChangeReason: isClientScope
            ? "Client requested scope revision"
            : null,
        };
      });

      const onTimePercentage =
        completedTasksCount > 0
          ? `${Math.round((onTimeCount / completedTasksCount) * 100)}%`
          : null;

      return {
        userId: m.id,
        displayName: m.display_name,
        email: m.email,
        role: m.role,
        completedTasksCount,
        onTimeCount,
        onTimePercentage,
        overdueTasksCount,
        reopenedTasksCount,
        clientScopeRevisionsCount,
        tasks: formattedTasks,
      };
    });

    // Project stage progress
    let stagesSql = `
      SELECT ps.*, p.code as project_code, p.name as project_name
      FROM project_stages ps
      JOIN projects p ON p.id = ps.project_id
      WHERE p.org_id = ? AND p.status != 'ARCHIVED'
      ORDER BY ps.project_id, ps.stage_order ASC
    `;
    const stagesRes = await db.prepare(stagesSql).bind(orgId).all<any>();
    const projectStageProgress = (stagesRes.results || []).map((s: any) => ({
      projectId: s.project_id,
      projectCode: s.project_code,
      projectName: s.project_name,
      stageName: s.name,
      status: s.status,
      plannedStartDate: s.planned_start_date,
      plannedCompletionDate: s.planned_completion_date,
      actualCompletionDate: s.actual_completion_date,
    }));

    return {
      periodDays,
      definitions,
      teamMetrics,
      projectStageProgress,
    };
  }

  /**
   * Calm and Private Client Overview (AC-053, REQ-DAS-005, REQ-PRJ-007).
   * Shows published progress, released drawings, next payment, and decisions.
   * Strictly isolates and conceals all internal tasks, comments, expenses, and payroll.
   */
  static async getClientProjectOverview(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string,
  ): Promise<ClientOverviewData> {
    assertProjectAccess(principal, projectId);
    await assertProjectOrganisation(db, principal, projectId);

    // Project details
    const project = await db
      .prepare(
        `SELECT id, code, name, stage, status FROM projects WHERE id = ?`,
      )
      .bind(projectId)
      .first<any>();

    if (!project) {
      throw new Error("Project not found");
    }

    // Current active stage
    const activeStage = await db
      .prepare(
        `SELECT name FROM project_stages WHERE project_id = ? AND status = 'IN_PROGRESS' LIMIT 1`,
      )
      .bind(projectId)
      .first<any>();

    const nextMilestone = await db
      .prepare(
        "SELECT name,planned_completion_date AS targetDate FROM project_stages WHERE project_id=? AND status!='COMPLETED' ORDER BY stage_order LIMIT 1",
      )
      .bind(projectId)
      .first<any>();
    // 1. Published progress updates ONLY (AC-022, AC-053)
    const updatesRes = await db
      .prepare(
        `SELECT pu.id, uv.id AS version_id, uv.title, uv.body_text, uv.observed_date, uv.published_at
         FROM project_updates pu
         JOIN update_versions uv ON uv.id = pu.current_published_version_id
         WHERE pu.project_id = ? AND pu.is_retracted = 0 AND uv.status = 'PUBLISHED'
         ORDER BY uv.published_at DESC
         LIMIT 10`,
      )
      .bind(projectId)
      .all<any>();

    const publishedUpdates = await Promise.all(
      (updatesRes.results || []).map(async (u: any) => {
        const files = await db
          .prepare(
            "SELECT f.* FROM files f JOIN update_attachments a ON a.file_id=f.id WHERE a.version_id=?",
          )
          .bind(u.version_id)
          .all<any>();
        const attachments = [];
        for (const file of files.results ?? [])
          if (await canReadFile(db as any, principal, file))
            attachments.push({
              fileId: file.id,
              fileName: file.file_name,
              mimeType: file.mime_type,
              sizeBytes: file.size_bytes,
              caption: file.file_name,
            });
        return {
          id: u.id,
          title: u.title,
          summary: u.observed_date ? `Observed: ${u.observed_date}` : null,
          body: u.body_text,
          updateType: "SITE_PROGRESS",
          publishedAt: u.published_at,
          attachments,
        };
      }),
    );

    // 2. Current Released Drawings ONLY (AC-018, AC-053)
    const drawingsRes = await db
      .prepare(
        `SELECT d.id, d.drawing_number, d.title, d.discipline,
                dv.version_label as version_number,
                dv.released_at, dv.file_id,
                f.file_name
         FROM drawings d
         JOIN drawing_versions dv ON dv.id = d.current_released_version_id
         LEFT JOIN files f ON f.id = dv.file_id
         WHERE d.project_id = ? AND d.is_withdrawn = 0
         ORDER BY d.drawing_number ASC`,
      )
      .bind(projectId)
      .all<any>();

    const releasedDrawings = (drawingsRes.results || []).map((d: any) => ({
      id: d.id,
      drawingNumber: d.drawing_number,
      title: d.title,
      discipline: d.discipline,
      versionNumber: d.version_number,
      releasedAt: d.released_at,
      fileId: d.file_id,
      fileName: d.file_name,
    }));

    // 3. Billing & Payment Summary
    // Client representative without financial read grant receives null billing
    let billingSummary = null;
    const isClientRep = principal.projectMemberships.some((m) =>
      hasCapability(principal, "CLIENT_REP", m.projectId),
    );
    // Check if client representative has explicit financial read grant (or is MAIN_CLIENT / internal)
    const canReadFinance = canViewFinancials(
      principal,
      projectId,
      "CLIENT_COMMERCIAL",
    );

    if (canReadFinance) {
      const invoicesRes = await db
        .prepare(
          `SELECT invoice_number,
                  COALESCE(total_minor, 0) as total_minor,
                  COALESCE(allocated_minor, 0) as allocated_minor,
                  COALESCE(outstanding_minor, 0) as outstanding_minor,
                  due_date, status
           FROM invoices
           WHERE project_id = ? AND status = 'ISSUED'
           ORDER BY due_date ASC`,
        )
        .bind(projectId)
        .all<any>();

      const invoices = invoicesRes.results || [];
      let totalInvoicedMinor = 0;
      let totalPaidMinor = 0;
      let outstandingBalanceMinor = 0;
      let nextDueInvoice: any = null;

      for (const inv of invoices) {
        totalInvoicedMinor += inv.total_minor || 0;
        totalPaidMinor += inv.allocated_minor || 0;
        outstandingBalanceMinor += inv.outstanding_minor || 0;

        if (!nextDueInvoice && inv.outstanding_minor > 0) {
          nextDueInvoice = {
            invoiceNumber: inv.invoice_number,
            balanceMinor: inv.outstanding_minor,
            dueDate: inv.due_date,
            status: inv.status,
          };
        }
      }

      billingSummary = {
        nextDueInvoice,
        totalInvoicedMinor,
        totalPaidMinor,
        outstandingBalanceMinor,
      };
    }

    // 4. Pending Client Decisions
    const quotesRes = await db
      .prepare(
        `SELECT id, version_number, title, status FROM quotations WHERE project_id = ? AND status IN ('SENT', 'ISSUED')`,
      )
      .bind(projectId)
      .all<any>();

    const crRes = await db
      .prepare(
        `SELECT cr.id, COALESCE(cr.request_number, cr.id) as reference_number, cr.title,
                crv.version_number,
                COALESCE(crv.total_minor, crv.price_minor, 0) as cost_minor,
                COALESCE(crv.schedule_impact_days, 0) as timeline_impact_days
         FROM change_requests cr
         JOIN change_request_versions crv ON (crv.change_request_id = cr.id AND crv.version_number = cr.current_version_number)
         WHERE cr.project_id = ? AND cr.status = 'AWAITING_CLIENT'`,
      )
      .bind(projectId)
      .all<any>();

    const matRes = await db
      .prepare(
        `SELECT id, title, needed_by_date as due_date,
                (SELECT COUNT(*) FROM material_selection_options WHERE selection_item_id = msi.id) as options_count
         FROM material_selection_items msi
         WHERE msi.project_id = ? AND msi.status IN ('PENDING', 'AWAITING_MAIN_CLIENT')`,
      )
      .bind(projectId)
      .all<any>();

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        stage: project.stage,
        status: project.status,
        currentStageName: activeStage?.name || null,
        nextMilestone: nextMilestone ?? null,
      },
      publishedUpdates,
      releasedDrawings,
      billingSummary,
      pendingDecisions: {
        quotations:
          canReadFinance &&
          principal.projectMemberships.some(
            (m) => m.projectId === projectId && m.contractualAuthority,
          )
            ? quotesRes.results || []
            : [],
        changeRequests: (principal.projectMemberships.some(
          (m) => m.projectId === projectId && m.contractualAuthority,
        )
          ? crRes.results || []
          : []
        ).map((cr: any) => ({
          id: cr.id,
          referenceNumber: cr.reference_number,
          title: cr.title,
          versionNumber: cr.version_number,
          costMinor: cr.cost_minor,
          timelineImpactDays: cr.timeline_impact_days,
        })),
        materialSelections: (principal.projectMemberships.some(
          (m) => m.projectId === projectId && m.contractualAuthority,
        )
          ? matRes.results || []
          : []
        ).map((m: any) => ({
          id: m.id,
          title: m.title,
          dueDate: m.due_date,
          optionsCount: m.options_count || 0,
        })),
      },
    };
  }

  /**
   * Role Dashboard Overview (REQ-DAS-001, REQ-DAS-002).
   * Invoiced and received sales are separate; salary/profit cards require admin capability.
   */
  static async getRoleOverview(
    db: D1Database,
    principal: UserPrincipal,
    orgId: string,
  ) {
    const isOwner = hasCapability(principal, "OWNER");
    const isAdmin = hasCapability(principal, "ADMIN");
    const canSeeSalaries = canViewPayrollAndProfit(principal);

    // Waiting on you queue
    const waitingItems = await this.getWaitingOnYou(db, principal);

    // Active projects summary
    let projectsSql = `SELECT id, code, name, status FROM projects WHERE org_id = ? AND status != 'ARCHIVED'`;
    const projParams: any[] = [orgId];

    if (!isOwner && !isAdmin) {
      const pids = principal.projectMemberships.map((m) => m.projectId);
      if (pids.length === 0) {
        projectsSql += ` AND 1 = 0`;
      } else {
        projectsSql += ` AND id IN (${pids.map(() => "?").join(",")})`;
        projParams.push(...pids);
      }
    }
    const projectsRes = await db
      .prepare(projectsSql)
      .bind(...projParams)
      .all<any>();

    // Firm finance numbers (separate invoiced vs received - REQ-DAS-002)
    let firmFinance: any = null;
    if (isAdmin || isOwner) {
      const invTotal = await db
        .prepare(
          `SELECT SUM(COALESCE(total_minor, 0)) as total_invoiced,
                  SUM(COALESCE(allocated_minor, 0)) as total_received
           FROM invoices
           WHERE org_id=? AND status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')`,
        )
        .bind(principal.orgId)
        .first<any>();

      const receiptsTotal = await db
        .prepare(
          "SELECT COALESCE(SUM(amount_minor),0) AS received FROM receipts WHERE org_id=? AND status='CONFIRMED'",
        )
        .bind(principal.orgId)
        .first<any>();
      firmFinance = {
        totalInvoicedMinor: invTotal?.total_invoiced || 0,
        totalReceivedMinor: receiptsTotal?.received || 0,
      };

      // Only ADMIN can see payroll & profit totals (REQ-DAS-002, AC-005)
      if (canSeeSalaries) {
        const payrollTotal = await db
          .prepare(
            `SELECT SUM(gross_salary_minor) as total_payroll FROM payroll_records WHERE org_id = ?`,
          )
          .bind(principal.orgId)
          .first<any>();
        const expenseTotal = await db
          .prepare(
            `SELECT SUM(amount_minor) as total_expenses FROM expenses WHERE org_id=? AND status = 'POSTED'`,
          )
          .bind(principal.orgId)
          .first<any>();

        firmFinance.payrollAndProfit = {
          totalPayrollMinor: payrollTotal?.total_payroll || 0,
          totalExpensesMinor: expenseTotal?.total_expenses || 0,
          netProfitMinor:
            (receiptsTotal?.received || 0) -
            (payrollTotal?.total_payroll || 0) -
            (expenseTotal?.total_expenses || 0),
        };
      }
    }

    return {
      principal: {
        id: principal.id,
        name: principal.name,
        role: principal.role,
      },
      waitingItems,
      activeProjects: projectsRes.results || [],
      firmFinance,
    };
  }
}
