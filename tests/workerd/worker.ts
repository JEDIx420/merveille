/** Isolated local verification entry, never deployed or linked from the product. */
import { identityDrill } from "./identity-drill";
import { FinanceService } from "../../src/server/domain/finance/service";
import { releaseDrawingVersion } from "../../src/server/domain/drawings/service";
import { ArchiveService } from "../../src/server/domain/archive/service";
import type { UserPrincipal } from "../../src/server/auth/principal";
interface Env {
  DB: D1Database;
  RESTORE_DB: D1Database;
  FAILURE_DB: D1Database;
  IDENTITY_DB: D1Database;
  FILES: R2Bucket;
  BACKUPS: R2Bucket;
  RESTORED: R2Bucket;
}
const org = "org_merveille_main",
  project = "workerd_fictional";
const principal = (id: string, role: any): UserPrincipal => ({
  id,
  email: `${id}@example.invalid`,
  name: `Fictional ${role}`,
  orgId: org,
  role,
  roles: ["ADMIN", "OWNER"].includes(role) ? [role] : [],
  projectMemberships: [
    {
      projectId: project,
      projectRole: role,
      roles: [role],
      financeAuthor: role === "TEAM_MEMBER",
      invoiceIssue: role === "TEAM_MEMBER",
    },
  ],
});
const admin = principal("workerd_admin", "ADMIN"),
  manager = principal("workerd_manager", "MANAGER"),
  staff = principal("workerd_staff", "TEAM_MEMBER"),
  consultant = principal("workerd_consultant", "CONSULTANT");
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
async function seed(db: D1Database) {
  for (const p of [admin, manager, staff, consultant])
    await db.batch([
      db
        .prepare(
          "INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'ACTIVE',1)",
        )
        .bind(p.id, p.email, p.name),
      db
        .prepare(
          "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,?,?,1,1)",
        )
        .bind(`om_${p.id}`, org, p.id),
      db
        .prepare(
          "INSERT INTO role_assignments(id,org_id,user_id,role,scope,granted_at) VALUES(?,?,?,?,'GLOBAL',1)",
        )
        .bind(`ra_${p.id}`, org, p.id, p.role),
    ]);
  await db
    .prepare(
      "INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES(?,?,'VERIFY','Fictional verification project','DRAFT',1)",
    )
    .bind(project, org)
    .run();
  for (const p of [manager, staff, consultant])
    await db
      .prepare(
        "INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,finance_author,invoice_issue,assigned_at) VALUES(?,?,?,?,?,1,?,?,1)",
      )
      .bind(
        `pm_${p.id}`,
        org,
        project,
        p.id,
        p.role,
        p.id === staff.id ? 1 : 0,
        p.id === staff.id ? 1 : 0,
      )
      .run();
}
function faulting(db: D1Database): D1Database {
  // Preserve real workerd prepared statements and transaction semantics, append a deliberate final failure.
  return new Proxy(db, {
    get(target, key) {
      if (key === "batch")
        return (statements: D1PreparedStatement[]) =>
          target.batch([
            ...statements,
            target
              .prepare("INSERT INTO financial_guard(id,valid) VALUES(?,0)")
              .bind(crypto.randomUUID()),
          ]);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/run")
      return new Response("Local verification harness", { status: 404 });
    const passed: string[] = [];
    try {
      await identityDrill(env.IDENTITY_DB, passed);
      await seed(env.DB);
      const invoice = await FinanceService.draftInvoice(env.DB, staff, {
        projectId: project,
        dueDate: "2026-12-15",
        lineItems: [
          { description: "Fictional design fee", unitRateMinor: 1000 },
        ],
      });
      await FinanceService.approveInvoice(env.DB, manager, {
        invoiceId: invoice.invoiceId,
        versionNumber: 1,
      });
      let failed = false;
      try {
        await FinanceService.issueInvoice(faulting(env.DB), staff, {
          invoiceId: invoice.invoiceId,
          versionNumber: 1,
        });
      } catch {
        failed = true;
      }
      check(failed, "Injected financial batch did not fail");
      const unchanged = await env.DB.prepare(
        "SELECT status,invoice_number FROM invoices WHERE id=?",
      )
        .bind(invoice.invoiceId)
        .first<any>();
      check(
        unchanged.status === "APPROVED" && unchanged.invoice_number === null,
        "Invoice failure mutated parent",
      );
      check(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) n FROM journal_entries",
          ).first<any>()
        )?.n === 0,
        "Invoice failure left journal",
      );
      check(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) n FROM finance_sequences WHERE kind='INV'",
          ).first<any>()
        )?.n === 0,
        "Invoice failure consumed sequence",
      );
      passed.push(
        "D1 financial batch rollback preserved invoice, journal and sequence",
      );
      const issued = await FinanceService.issueInvoice(env.DB, staff, {
        invoiceId: invoice.invoiceId,
        versionNumber: 1,
      });
      const repeated = await FinanceService.issueInvoice(env.DB, staff, {
        invoiceId: invoice.invoiceId,
        versionNumber: 1,
      });
      check(
        issued.invoiceNumber === repeated.invoiceNumber,
        "Invoice replay changed number",
      );
      check(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) n FROM journal_entries WHERE source_type='INVOICE_ISSUED'",
          ).first<any>()
        )?.n === 1,
        "Duplicate issue journal",
      );
      passed.push(
        "Invoice replay retains one number and balanced source journal",
      );
      // Confirm and allocate an actual external receipt; parallel allocations cannot spend twice.
      const receipt = await FinanceService.reportReceipt(env.DB, admin, {
        projectId: project,
        amountMinor: 1000,
        receivedDate: "2026-11-24",
        paymentMethod: "BANK_TRANSFER",
        idempotencyKey: "workerd-receipt",
      });
      await FinanceService.confirmReceipt(env.DB, admin, {
        receiptId: receipt.receiptId,
        idempotencyKey: "workerd-confirm",
      });
      const allocations = await Promise.allSettled([
        FinanceService.allocateReceipt(env.DB, admin, {
          receiptId: receipt.receiptId,
          invoiceId: invoice.invoiceId,
          amountMinor: 700,
          idempotencyKey: "workerd-alloc-a",
        }),
        FinanceService.allocateReceipt(env.DB, admin, {
          receiptId: receipt.receiptId,
          invoiceId: invoice.invoiceId,
          amountMinor: 700,
          idempotencyKey: "workerd-alloc-b",
        }),
      ]);
      check(
        allocations.filter((r) => r.status === "fulfilled").length === 1,
        "Concurrent allocations did not yield one winner",
      );
      check(
        (
          await env.DB.prepare(
            "SELECT outstanding_minor FROM invoices WHERE id=?",
          )
            .bind(invoice.invoiceId)
            .first<any>()
        )?.outstanding_minor === 300,
        "Concurrent allocation balance mismatch",
      );
      passed.push(
        "Concurrent D1 allocations cannot overspend a confirmed receipt",
      );
      const photo = new Uint8Array([0, 1, 2, 250, 255]);
      await env.FILES.put("verification/old.pdf", photo);
      await env.FILES.put("verification/new.pdf", photo);
      for (const id of ["old", "new"])
        await env.DB.prepare(
          "INSERT INTO files(id,org_id,project_id,uploaded_by_user_id,file_class,file_name,mime_type,size_bytes,storage_key,status,is_referenced,created_at) VALUES(?,?,?,?,'PDF',?,'application/pdf',5,?,'READY',1,1)",
        )
          .bind(
            `file_${id}`,
            org,
            project,
            staff.id,
            `${id}.pdf`,
            `verification/${id}.pdf`,
          )
          .run();
      await env.DB.prepare(
        "INSERT INTO drawings(id,org_id,project_id,drawing_number,title,discipline,current_released_version_id,created_at) VALUES('workerd_drawing',?,?,'VERIFY-01','Fictional drawing','ARCHITECTURAL','version_old',1)",
      )
        .bind(org, project)
        .run();
      await env.DB.prepare(
        "INSERT INTO drawing_versions(id,drawing_id,version_label,file_id,author_user_id,status,released_at,released_by_user_id,created_at) VALUES('version_old','workerd_drawing','V1','file_old',?,'RELEASED',1,?,1),('version_new','workerd_drawing','V2','file_new',?,'CONSULTANT_APPROVED',NULL,NULL,2)",
      )
        .bind(staff.id, manager.id, staff.id)
        .run();
      await env.DB.prepare(
        "INSERT INTO drawing_reviews(id,version_id,consultant_user_id,is_required,status,created_at) VALUES('workerd_review','version_new',?,1,'APPROVED',1)",
      )
        .bind(consultant.id)
        .run();
      failed = false;
      try {
        await releaseDrawingVersion(
          manager,
          { versionId: "version_new", expectedCurrentVersionId: "version_old" },
          faulting(env.DB),
        );
      } catch {
        failed = true;
      }
      check(failed, "Injected drawing release did not fail");
      check(
        (
          await env.DB.prepare(
            "SELECT current_released_version_id FROM drawings WHERE id='workerd_drawing'",
          ).first<any>()
        )?.current_released_version_id === "version_old",
        "Drawing rollback changed release pointer",
      );
      check(
        (
          await env.DB.prepare(
            "SELECT status FROM drawing_versions WHERE id='version_old'",
          ).first<any>()
        )?.status === "RELEASED",
        "Drawing rollback superseded previous release",
      );
      passed.push(
        "D1 failed drawing release preserved previous version and pointer",
      );
      await releaseDrawingVersion(
        manager,
        { versionId: "version_new", expectedCurrentVersionId: "version_old" },
        env.DB,
      );
      await releaseDrawingVersion(
        manager,
        { versionId: "version_new", expectedCurrentVersionId: "version_old" },
        env.DB,
      );
      check(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) n FROM audit_events WHERE action='DRAWING_RELEASED'",
          ).first<any>()
        )?.n === 1,
        "Drawing replay created duplicate audit",
      );
      passed.push("Drawing release and replay commit one release audit");
      const backup = await ArchiveService.exportProjectBackup(
        env.DB,
        env.FILES,
        admin,
        project,
        env.BACKUPS,
      );
      await env.FILES.delete(["verification/old.pdf", "verification/new.pdf"]);
      const failingStorage = new Proxy(env.RESTORED, {
        get(bucket, key) {
          if (key === "put") return async () => { throw new Error("INJECTED_RESTORE_STORAGE_FAILURE"); };
          const value = Reflect.get(bucket, key);
          return typeof value === "function" ? value.bind(bucket) : value;
        },
      });
      let storageFailed = false;
      try {
        await ArchiveService.restoreBackupToIsolatedEnv(env.FAILURE_DB, env.BACKUPS, failingStorage, backup.backupKey, backup.manifestSha256);
      } catch (error) {
        storageFailed = error instanceof Error && error.message === "INJECTED_RESTORE_STORAGE_FAILURE";
      }
      check(storageFailed, "Storage failure injection did not execute");
      check((await env.FAILURE_DB.prepare("SELECT COUNT(*) n FROM users WHERE status='ACTIVE'").first<any>())?.n === 0, "Failed restore left active seed users");
      check((await env.FAILURE_DB.prepare("SELECT COUNT(*) n FROM organization_memberships WHERE is_active=1").first<any>())?.n === 0, "Failed restore left active memberships");
      check((await env.FAILURE_DB.prepare("SELECT consumed_at FROM bootstrap_state WHERE id=1").first<any>())?.consumed_at > 0, "Failed restore reopened bootstrap");
      passed.push("D1 restore quarantines seed accounts and consumes bootstrap before failing R2 copy");
      const restored = await ArchiveService.restoreBackupToIsolatedEnv(
        env.RESTORE_DB,
        env.BACKUPS,
        env.RESTORED,
        backup.backupKey,
        backup.manifestSha256,
      );
      check(
        restored.fileChecksumsVerified === 2,
        "Recovered file hash count differs",
      );
      const recovered = await env.RESTORED.get("verification/new.pdf");
      check(
        recovered &&
          new Uint8Array(await recovered.arrayBuffer()).every(
            (n, i) => n === photo[i],
          ),
        "Recovered bytes differ",
      );
      check(
        (
          await env.RESTORE_DB.prepare(
            "SELECT outstanding_minor FROM invoices WHERE id=?",
          )
            .bind(invoice.invoiceId)
            .first<any>()
        )?.outstanding_minor === 300,
        "Restored financial balance differs",
      );
      check(
        (
          await env.RESTORE_DB.prepare(
            "SELECT COUNT(*) n FROM organization_memberships WHERE is_active=1",
          ).first<any>()
        )?.n === 0,
        "Restore reactivated access",
      );
      passed.push(
        "Independent R2 bytes, complete financial history and quarantined memberships restored in workerd",
      );
      return Response.json({ ok: true, runtime: "workerd", passed });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          passed,
          error: error instanceof Error ? error.message : "Verification failed",
        },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
