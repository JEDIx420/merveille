import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { setupMigratedTestDb } from "../test-db";
import { executeMigration } from "../../src/server/db";
import { FinanceService } from "../../src/server/domain/finance/service";
import {
  getProject,
  listProjects,
} from "../../src/server/domain/projects/service";
import { inviteUser } from "../../src/server/domain/identity/service";
import { ArchiveService } from "../../src/server/domain/archive/service";
import { AccountingService } from "../../src/server/domain/accounting/service";
import { UserPrincipal } from "../../src/server/auth/principal";
const org = "org_merveille_main",
  project = "finance_integrity";
const principal = (id: string, role: any, grant: any = {}): UserPrincipal => ({
  id,
  email: id + "@example.test",
  name: id,
  orgId: org,
  role,
  roles: [role],
  projectMemberships: [{ projectId: project, projectRole: role, ...grant }],
});
const admin = principal("finance_admin", "ADMIN"),
  staff = principal("finance_staff", "TEAM_MEMBER", {
    financeAccess: true,
    financeAuthor: true,
    invoiceIssue: true,
  }),
  manager = principal("finance_manager", "MANAGER"),
  client = principal("finance_client", "MAIN_CLIENT", {
    contractualAuthority: true,
  });
let db: D1Database;
async function issue(amount = 1000) {
  const draft = await FinanceService.draftInvoice(db, staff, {
    projectId: project,
    dueDate: "2026-12-15",
    lineItems: [{ description: "Design fee", unitRateMinor: amount }],
  });
  await FinanceService.approveInvoice(db, manager, {
    invoiceId: draft.invoiceId,
    versionNumber: 1,
  });
  return FinanceService.issueInvoice(db, staff, {
    invoiceId: draft.invoiceId,
    versionNumber: 1,
  });
}
async function receipt(amount = 1000) {
  const r = await FinanceService.reportReceipt(db, client, {
    projectId: project,
    amountMinor: amount,
    receivedDate: "2026-11-24",
    paymentMethod: "BANK_TRANSFER",
  });
  await FinanceService.confirmReceipt(db, admin, { receiptId: r.receiptId });
  return r.receiptId;
}
beforeEach(async () => {
  db = await setupMigratedTestDb();
  await executeMigration(
    db,
    fs.readFileSync("migrations/0013_financial_integrity.sql", "utf8"),
  );
  for (const p of [admin, staff, manager, client]) {
    await db
      .prepare(
        "INSERT INTO users(id,email,display_name,status,created_at) VALUES (?,?,?,'ACTIVE',1)",
      )
      .bind(p.id, p.email, p.name)
      .run();
    await db
      .prepare(
        "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES (?,?,?,1,1)",
      )
      .bind("mem_" + p.id, org, p.id)
      .run();
  }
  await db
    .prepare(
      "INSERT INTO role_assignments(id,org_id,user_id,role,scope,granted_at) VALUES ('finance-admin-grant',?,?,'ADMIN','GLOBAL',1)",
    )
    .bind(org, admin.id)
    .run();
  await db
    .prepare(
      "INSERT INTO projects(id,org_id,code,name,status,main_client_user_id,created_at) VALUES (?,?,?,'Fictional project','DRAFT',?,1)",
    )
    .bind(project, org, project, client.id)
    .run();
});
describe("Financial integrity remediation", () => {
  it("administrator grant validation rejects external author/issue and invalid contractual authority combinations", async () => {
    for (const role of ["CONSULTANT", "MAIN_CLIENT", "CLIENT_REP"]) {
      await expect(
        inviteUser(
          admin,
          {
            email: "fictional-invite@example.test",
            displayName: "Fictional invite",
            roles: [],
            projects: [
              {
                projectId: project,
                roles: [role as any],
                financeAuthor: true,
                invoiceIssue: true,
              },
            ],
          },
          db,
        ),
      ).rejects.toThrow(/team member or manager/);
    }
    await expect(
      inviteUser(
        admin,
        {
          email: "fictional-invite@example.test",
          displayName: "Fictional invite",
          roles: [],
          projects: [
            {
              projectId: project,
              roles: ["CLIENT_REP"],
              contractualAuthority: true,
            },
          ],
        },
        db,
      ),
    ).rejects.toThrow(/main-client/);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM invitations").first<any>()).n,
    ).toBe(0);
  });
  it("read-only external roles cannot author or issue invoices even with forged author flags", async () => {
    for (const role of ["CONSULTANT", "MAIN_CLIENT", "CLIENT_REP"]) {
      const person = principal("finance_client", role, {
        financeAccess: true,
        financeAuthor: true,
        invoiceIssue: true,
      });
      await expect(
        FinanceService.draftInvoice(db, person, {
          projectId: project,
          dueDate: "2026-12-15",
          lineItems: [{ description: "Forbidden draft", unitRateMinor: 1000 }],
        }),
      ).rejects.toThrow(/finance grant/);
      const draft = await FinanceService.draftInvoice(db, staff, {
        projectId: project,
        dueDate: "2026-12-15",
        lineItems: [{ description: "Allowed draft", unitRateMinor: 1000 }],
      });
      await FinanceService.approveInvoice(db, manager, {
        invoiceId: draft.invoiceId,
        versionNumber: 1,
      });
      await expect(
        FinanceService.issueInvoice(db, person, {
          invoiceId: draft.invoiceId,
          versionNumber: 1,
        }),
      ).rejects.toThrow(/finance grant/);
    }
  });
  it("organisation-wide accounting never sums another organisation and rejects cross-org project writes", async () => {
    await db
      .prepare(
        "INSERT INTO organizations(id,name,created_at) VALUES ('finance_other_org','Other fictional firm',1)",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES ('foreign-project','finance_other_org','FOREIGN','Foreign project','ACTIVE',1)",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO invoices(id,org_id,project_id,status,total_minor,outstanding_minor,due_date,created_by_user_id,created_at) VALUES ('foreign-invoice','finance_other_org','foreign-project','ISSUED',999999,999999,'2026-11-24',?,1)",
      )
      .bind(staff.id)
      .run();
    const report = await AccountingService.getFinancialReport(db, admin, {
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });
    expect(report.invoicedAmountMinor).toBe(0);
    await expect(
      AccountingService.submitExpense(db, admin, {
        projectId: "foreign-project",
        category: "Travel",
        description: "Invalid scope",
        amountMinor: 500,
        incurredDate: "2026-11-24",
      }),
    ).rejects.toThrow(/Project not found/);
    await expect(
      AccountingService.recordPayroll(db, admin, {
        projectId: "foreign-project",
        userId: staff.id,
        periodMonth: "2026-11",
        grossSalaryMinor: 500,
      }),
    ).rejects.toThrow(/Project not found/);
  });
  it("a new outside payment can settle an existing archived invoice without reopening or creating work", async () => {
    const invoice = await issue(1000),
      other = await issue(1000);
    await db
      .prepare("UPDATE projects SET is_archived=1,status='ARCHIVED' WHERE id=?")
      .bind(project)
      .run();
    const params = {
      projectId: project,
      settlementInvoiceId: invoice.invoiceId,
      amountMinor: 1000,
      receivedDate: "2026-11-24",
      paymentMethod: "BANK_TRANSFER",
      referenceNote: "Fictional final transfer",
      idempotencyKey: "new-archived-payment",
    };
    await expect(
      FinanceService.reportReceipt(db, client, params),
    ).rejects.toThrow(/administrator settlement/);
    await expect(
      FinanceService.reportReceipt(db, admin, {
        ...params,
        settlementInvoiceId: undefined,
      }),
    ).rejects.toThrow(/administrator settlement/);
    await expect(
      FinanceService.reportReceipt(db, admin, { ...params, amountMinor: 1001 }),
    ).rejects.toThrow(/outstanding balance/);
    const reported = await FinanceService.reportReceipt(db, admin, params);
    expect(await FinanceService.reportReceipt(db, admin, params)).toEqual(
      reported,
    );
    await expect(
      FinanceService.reportReceipt(db, admin, { ...params, amountMinor: 999 }),
    ).rejects.toThrow(/different input/);
    const saved = await db
      .prepare("SELECT status,settlement_invoice_id FROM receipts WHERE id=?")
      .bind(reported.receiptId)
      .first<any>();
    expect(saved).toEqual({
      status: "REPORTED",
      settlement_invoice_id: invoice.invoiceId,
    });
    await FinanceService.confirmReceipt(db, admin, {
      receiptId: reported.receiptId,
    });
    await expect(
      FinanceService.allocateReceipt(db, admin, {
        receiptId: reported.receiptId,
        invoiceId: other.invoiceId,
        amountMinor: 1000,
        idempotencyKey: "redirect-settlement",
      }),
    ).rejects.toThrow(/matching confirmed/);
    await FinanceService.allocateReceipt(db, admin, {
      receiptId: reported.receiptId,
      invoiceId: invoice.invoiceId,
      amountMinor: 1000,
      idempotencyKey: "pay-archived-invoice",
    });
    expect(await FinanceService.reportReceipt(db, admin, params)).toEqual(
      reported,
    );
    expect(
      (
        await db
          .prepare("SELECT outstanding_minor FROM invoices WHERE id=?")
          .bind(invoice.invoiceId)
          .first<any>()
      ).outstanding_minor,
    ).toBe(0);
    expect(
      (
        await db
          .prepare("SELECT status FROM projects WHERE id=?")
          .bind(project)
          .first<any>()
      ).status,
    ).toBe("ARCHIVED");
    await expect(
      FinanceService.draftInvoice(db, staff, {
        projectId: project,
        dueDate: "2026-12-15",
        lineItems: [{ description: "Forbidden new work", unitRateMinor: 1000 }],
      }),
    ).rejects.toThrow(/archived/);
    await expect(
      FinanceService.createOrReviseSchedule(db, manager, {
        projectId: project,
        items: [
          {
            description: "Forbidden schedule",
            amountMinor: 1000,
            triggerType: "DATE_ONLY",
            targetDate: "2026-12-15",
          },
        ],
      }),
    ).rejects.toThrow(/archived/);
  });
  it("archive settlement uses existing confirmed funds, commits once, and replays its original result", async () => {
    const invoice = await issue(1000),
      r = await receipt(1000);
    await db
      .prepare("UPDATE projects SET is_archived=1,status='ARCHIVED' WHERE id=?")
      .bind(project)
      .run();
    const input = {
      projectId: project,
      invoiceId: invoice.invoiceId,
      receiptId: r,
      amountMinor: 400,
      idempotencyKey: "archived-settlement",
    };
    const result = await ArchiveService.settleArchivedInvoice(db, admin, input);
    await FinanceService.allocateReceipt(db, admin, {
      receiptId: r,
      invoiceId: invoice.invoiceId,
      amountMinor: 100,
      idempotencyKey: "another-settlement",
    });
    expect(
      await ArchiveService.settleArchivedInvoice(db, admin, input),
    ).toEqual(result);
    expect(
      (
        await db
          .prepare("SELECT outstanding_minor FROM invoices WHERE id=?")
          .bind(invoice.invoiceId)
          .first<any>()
      ).outstanding_minor,
    ).toBe(500);
    await expect(
      FinanceService.draftInvoice(db, staff, {
        projectId: project,
        dueDate: "2026-12-15",
        lineItems: [{ description: "New work", unitRateMinor: 100 }],
      }),
    ).rejects.toThrow(/archived/);
  });
  it("a legacy confirmed receipt without its financial posting cannot activate work", async () => {
    await db
      .prepare(
        "INSERT INTO quotations(id,org_id,project_id,version_number,title,total_amount_minor,required_advance_minor,status,created_by_user_id,created_at) VALUES ('legacy-quote',?,?,1,'Accepted legacy quote',1000,500,'ACCEPTED',?,1)",
      )
      .bind(org, project, staff.id)
      .run();
    const r = await FinanceService.reportReceipt(db, client, {
      projectId: project,
      amountMinor: 500,
      receivedDate: "2026-11-24",
      paymentMethod: "BANK_TRANSFER",
    });
    await db
      .prepare(
        "UPDATE receipts SET status='CONFIRMED',confirmed_by_user_id=?,confirmed_at=1 WHERE id=?",
      )
      .bind(admin.id, r.receiptId)
      .run();
    await expect(
      FinanceService.activateProject(db, manager, project),
    ).rejects.toThrow(/required advance payment/);
    expect(
      (
        await db
          .prepare(
            "SELECT kind FROM financial_reconciliation_errors WHERE record_id=?",
          )
          .bind(r.receiptId)
          .first<any>()
      ).kind,
    ).toBe("RECEIPT_POSTING_MISSING");
  });
  it("zero-advance accepted quotations cannot activate a project", async () => {
    await db
      .prepare(
        "INSERT INTO quotations(id,org_id,project_id,version_number,title,total_amount_minor,required_advance_minor,status,created_by_user_id,created_at) VALUES ('zero-advance',?,?,1,'Invalid legacy quote',1000,0,'ACCEPTED',?,1)",
      )
      .bind(org, project, staff.id)
      .run();
    await expect(
      FinanceService.activateProject(db, manager, project),
    ).rejects.toThrow(/positive safe integer/);
    expect(
      (
        await db
          .prepare("SELECT status FROM projects WHERE id=?")
          .bind(project)
          .first<any>()
      ).status,
    ).toBe("DRAFT");
  });

  it("external project responses omit internal lifecycle reasons and member contact data", async () => {
    await db
      .prepare(
        "UPDATE projects SET pause_reason='Private contractor dispute' WHERE id=?",
      )
      .bind(project)
      .run();
    await db
      .prepare(
        "INSERT INTO project_events(id,project_id,actor_id,event_type,reason,created_at) VALUES ('private-event',?,?,'PAUSED','Confidential internal reason',1)",
      )
      .bind(project, manager.id)
      .run();
    const detail = await getProject(client, project, db);
    expect(detail.events).toEqual([]);
    expect(detail.members).toEqual([]);
    expect(JSON.stringify(detail)).not.toContain("Private contractor dispute");
    expect(JSON.stringify(detail)).not.toContain(
      "Confidential internal reason",
    );
    const list = await listProjects(client, db);
    expect(JSON.stringify(list)).not.toContain("Private contractor dispute");
  });

  it("rejects wrong actors, obsolete approval and mutation of an issued snapshot", async () => {
    const draft = await FinanceService.draftInvoice(db, staff, {
      projectId: project,
      dueDate: "2026-12-15",
      lineItems: [{ description: "Fee", unitRateMinor: 1000 }],
    });
    await expect(
      FinanceService.approveInvoice(db, admin, {
        invoiceId: draft.invoiceId,
        versionNumber: 1,
      }),
    ).rejects.toThrow(/Only managers/);
    await FinanceService.approveInvoice(db, manager, {
      invoiceId: draft.invoiceId,
      versionNumber: 1,
    });
    await FinanceService.editDraftInvoice(db, staff, {
      invoiceId: draft.invoiceId,
      lineItems: [{ description: "Revised", unitRateMinor: 1200 }],
    });
    await expect(
      FinanceService.issueInvoice(db, staff, {
        invoiceId: draft.invoiceId,
        versionNumber: 1,
      }),
    ).rejects.toThrow(/current approved/);
    await FinanceService.approveInvoice(db, manager, {
      invoiceId: draft.invoiceId,
      versionNumber: 2,
    });
    await FinanceService.issueInvoice(db, staff, {
      invoiceId: draft.invoiceId,
      versionNumber: 2,
    });
    await expect(
      FinanceService.approveInvoice(db, manager, {
        invoiceId: draft.invoiceId,
        versionNumber: 2,
      }),
    ).rejects.toThrow();
    await expect(
      FinanceService.editDraftInvoice(db, staff, {
        invoiceId: draft.invoiceId,
        lineItems: [{ description: "Changed", unitRateMinor: 1 }],
      }),
    ).rejects.toThrow(/cannot be edited/);
  });
  it("replays issuance and confirmation without new numbers or journal effects", async () => {
    const invoice = await issue();
    const again = await FinanceService.issueInvoice(db, staff, {
      invoiceId: invoice.invoiceId,
      versionNumber: 1,
    });
    expect(again.invoiceNumber).toBe(invoice.invoiceNumber);
    const r = await receipt();
    const replay = await FinanceService.confirmReceipt(db, admin, {
      receiptId: r,
    });
    expect(replay.receiptNumber).toMatch(/MD-RCP-/);
    const count = await db
      .prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_id=?")
      .bind(invoice.invoiceId)
      .first<any>();
    expect(count.n).toBe(1);
  });
  it("rejects invalid, excessive and different-currency allocations and replays matching input", async () => {
    const i = await issue(),
      r = await receipt(1500);
    for (const amount of [-1, 0, 1.1, Number.MAX_SAFE_INTEGER + 1, 1001])
      await expect(
        FinanceService.allocateReceipt(db, admin, {
          receiptId: r,
          invoiceId: i.invoiceId,
          amountMinor: amount,
          idempotencyKey: "invalid_" + amount,
        }),
      ).rejects.toThrow();
    await db
      .prepare("UPDATE receipts SET currency='USD' WHERE id=?")
      .bind(r)
      .run();
    await expect(
      FinanceService.allocateReceipt(db, admin, {
        receiptId: r,
        invoiceId: i.invoiceId,
        amountMinor: 100,
        idempotencyKey: "currency",
      }),
    ).rejects.toThrow();
    await db
      .prepare("UPDATE receipts SET currency='INR' WHERE id=?")
      .bind(r)
      .run();
    const input = {
      receiptId: r,
      invoiceId: i.invoiceId,
      amountMinor: 600,
      idempotencyKey: "allocation-1",
    };
    const first = await FinanceService.allocateReceipt(db, admin, input);
    expect(await FinanceService.allocateReceipt(db, admin, input)).toEqual(
      first,
    );
    await expect(
      FinanceService.allocateReceipt(db, admin, { ...input, amountMinor: 601 }),
    ).rejects.toThrow(/different input/);
    expect(
      (
        await db
          .prepare("SELECT unallocated_minor FROM receipts WHERE id=?")
          .bind(r)
          .first<any>()
      ).unallocated_minor,
    ).toBe(900);
  });
  it("rolls back the entire issue batch when ledger insertion fails", async () => {
    const draft = await FinanceService.draftInvoice(db, staff, {
      projectId: project,
      dueDate: "2026-12-15",
      lineItems: [{ description: "Fee", unitRateMinor: 1000 }],
    });
    await FinanceService.approveInvoice(db, manager, {
      invoiceId: draft.invoiceId,
      versionNumber: 1,
    });
    await db.exec(
      "CREATE TRIGGER fail_journal BEFORE INSERT ON journal_entries BEGIN SELECT RAISE(ABORT,'injected'); END;",
    );
    await expect(
      FinanceService.issueInvoice(db, staff, {
        invoiceId: draft.invoiceId,
        versionNumber: 1,
      }),
    ).rejects.toThrow();
    const saved = await db
      .prepare("SELECT status,invoice_number FROM invoices WHERE id=?")
      .bind(draft.invoiceId)
      .first<any>();
    expect(saved).toEqual({ status: "APPROVED", invoice_number: null });
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM finance_sequences")
          .first<any>()
      ).n,
    ).toBe(0);
  });
  it("uses an in-transaction balance predicate so a competing allocation cannot overspend", async () => {
    const invoice = await issue(),
      r = await receipt();
    const original = db.batch.bind(db);
    let injected = false;
    db.batch = async (statements: any[]) => {
      if (!injected) {
        injected = true;
        await db
          .prepare(
            "UPDATE receipts SET unallocated_minor=100,allocated_minor=900 WHERE id=?",
          )
          .bind(r)
          .run();
      }
      return original(statements);
    };
    await expect(
      FinanceService.allocateReceipt(db, admin, {
        receiptId: r,
        invoiceId: invoice.invoiceId,
        amountMinor: 700,
        idempotencyKey: "race",
      }),
    ).rejects.toThrow();
    expect(
      (
        await db
          .prepare("SELECT outstanding_minor FROM invoices WHERE id=?")
          .bind(invoice.invoiceId)
          .first<any>()
      ).outstanding_minor,
    ).toBe(1000);
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM receipt_allocations")
          .first<any>()
      ).n,
    ).toBe(0);
  });
  it("does not activate from forged legacy timestamps without accepted quote and money", async () => {
    await db
      .prepare(
        "UPDATE projects SET quote_accepted_at=1,advance_confirmed_at=1 WHERE id=?",
      )
      .bind(project)
      .run();
    await expect(
      FinanceService.activateProject(db, manager, project),
    ).rejects.toThrow(/missing accepted quotation/);
  });
  it("posts expense state and balanced ledger atomically", async () => {
    const e = await AccountingService.submitExpense(db, staff, {
      projectId: project,
      category: "Travel",
      description: "Site visit",
      amountMinor: 500,
      incurredDate: "2026-11-24",
    });
    await AccountingService.approveExpense(db, manager, e.expenseId);
    await AccountingService.postExpense(db, admin, e.expenseId);
    await AccountingService.postExpense(db, admin, e.expenseId);
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) n FROM journal_entries WHERE source_type='EXPENSE_POSTED'",
          )
          .first<any>()
      ).n,
    ).toBe(1);
  });
});
