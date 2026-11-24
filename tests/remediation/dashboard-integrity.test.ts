import { it, expect } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { DashboardService } from "@/server/domain/dashboard/service";
import { FinanceService } from "@/server/domain/finance/service";
it("dashboard totals include confirmed unallocated advances and exclude another organisation", async () => {
  const db = await setupMigratedTestDb();
  const p: any = {
    id: "usr_admin_001",
    name: "Admin",
    email: "admin@example.invalid",
    role: "ADMIN",
    roles: ["ADMIN"],
    orgId: "org_merveille_main",
    projectMemberships: [],
  };
  await db.exec(
    "INSERT INTO organizations(id,name,status,created_at) VALUES('other','Other fictional firm','ACTIVE',1); INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES('own','org_merveille_main','OWN','Own fictional','ACTIVE',1),('foreign','other','FOREIGN','Foreign fictional','ACTIVE',1); INSERT INTO invoices(id,org_id,project_id,status,currency,total_minor,allocated_minor,outstanding_minor,created_by_user_id,created_at) VALUES('foreign-invoice','other','foreign','ISSUED','INR',99999,0,99999,'usr_admin_001',1); INSERT INTO receipts(id,org_id,project_id,currency,amount_minor,allocated_minor,unallocated_minor,received_date,payment_method,status,reported_by_user_id,created_at) VALUES('foreign-receipt','other','foreign','INR',99999,0,99999,'2026-11-24','BANK_TRANSFER','REPORTED','usr_admin_001',1)",
  );
  const receipt = await FinanceService.reportReceipt(db, p, {
    projectId: "own",
    amountMinor: 500,
    receivedDate: "2026-11-24",
    paymentMethod: "BANK_TRANSFER",
    idempotencyKey: "advance",
  });
  await FinanceService.confirmReceipt(db, p, { receiptId: receipt.receiptId });
  const result = await DashboardService.getRoleOverview(db, p, p.orgId);
  expect(result.firmFinance.totalReceivedMinor).toBe(500);
  expect(result.firmFinance.totalInvoicedMinor).toBe(0);
  const clientHome = await DashboardService.getClientProjectOverview(
    db,
    p,
    "own",
  );
  expect(clientHome.billingSummary?.totalPaidMinor).toBe(500);
  expect(
    result.waitingItems.some((i) => i.entityId === "foreign-receipt"),
  ).toBe(false);
});
