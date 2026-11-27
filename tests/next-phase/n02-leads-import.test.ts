import { describe, it, expect, beforeEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { setupMigratedTestDb, createTestR2Bucket } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  createLead,
  listLeads,
  updateLeadStage,
  addLeadFollowup,
  completeLeadFollowup,
  exportLeadsCsv,
} from "@/server/domain/enquiries/leads-service";
import {
  previewLeadImport,
  confirmLeadImportBatch,
  undoLeadImportBatch,
  importAsanaTasksBatch,
} from "@/server/domain/enquiries/import-service";
import {
  parseSpreadsheetBytes,
  excelSerialToIsoDate,
  neutralizeCsvCell,
  suggestLeadColumnMapping,
} from "@/shared/spreadsheet";
import { listPersonalTasks } from "@/server/domain/tasks/personal-service";

function buildSyntheticXlsx(): Uint8Array {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <workbookPr date1904="0"/>
  <sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>Name</t></si>
  <si><t>Phone</t></si>
  <si><t>Requirement</t></si>
  <si><t>Anoop Nair</t></si>
</sst>`;
  const sheet1 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2" t="inlineStr"><is><t>+910987654321</t></is></c>
      <c r="C2" t="inlineStr"><is><t>3BHK interiors in Kowdiar</t></is></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>Bad Formula Row</t></is></c>
      <c r="B3" t="inlineStr"><is><t>0471234567</t></is></c>
      <c r="C3"><f>A1&amp;B1</f></c>
    </row>
  </sheetData>
</worksheet>`;

  return zipSync({
    "xl/workbook.xml": strToU8(workbookXml),
    "xl/sharedStrings.xml": strToU8(sharedStrings),
    "xl/worksheets/sheet1.xml": strToU8(sheet1),
  });
}

describe("Stage N02: Simple Leads Tracker and Reviewed Spreadsheet Import (NAC-006, NAC-007)", () => {
  let db: D1Database;
  let r2: R2Bucket;
  const orgId = "org_merveille_main";

  const intakeStaff: UserPrincipal = {
    id: "usr_intake_n02",
    email: "intake.n02@merveilledesigns.com",
    name: "Intake Staff",
    role: "TEAM_MEMBER",
    roles: ["TEAM_MEMBER"],
    intakeAccess: true,
    orgId,
    projectMemberships: [],
  };

  const clientUser: UserPrincipal = {
    id: "usr_client_n02",
    email: "client.n02@example.com",
    name: "Client User",
    role: "MAIN_CLIENT",
    roles: ["MAIN_CLIENT"],
    intakeAccess: false,
    orgId,
    projectMemberships: [],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    r2 = createTestR2Bucket();
    const now = Date.now();
    for (const u of [intakeStaff, clientUser]) {
      await db
        .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
        .bind(u.id, u.email, u.name, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();
    }
  });

  it("NAC-006: Minimal lead creation without fake contact data, follow-ups, Won intent without auto-project, and client isolation", async () => {
    // Client cannot access or create leads
    await expect(listLeads(clientUser, db)).rejects.toThrow(/restricted to authorized internal/);
    await expect(
      createLead(clientUser, { name: "Test", requirement: "Test" }, db)
    ).rejects.toThrow(/restricted to authorized internal/);

    // Minimal lead with ONLY name + requirement (no email, no site_location)
    const created = await createLead(
      intakeStaff,
      {
        name: "Meera Menon",
        requirement: "Renovation for ancestral home in Thrissur",
        nextAction: "Call to schedule site visit",
        nextActionDate: "2026-12-02",
      },
      db
    );
    expect(created.id).toBeDefined();
    expect(created.stage).toBe("NEW");

    const leads = await listLeads(intakeStaff, db);
    expect(leads.length).toBe(1);
    expect(leads[0].contact_email).toBeNull();
    expect(leads[0].site_location).toBeNull();
    expect(leads[0].next_action_text).toBe("Call to schedule site visit");

    // Complete follow-up and schedule next action
    await completeLeadFollowup(
      intakeStaff,
      created.followupId!,
      {
        outcomeNote: "Client requested visit next week",
        nextActionText: "Confirm site visit time",
        nextDueDate: "2026-12-08",
      },
      db
    );

    // Mark Won -> records sales intent ONLY; linked_project_id remains null
    const won = await updateLeadStage(intakeStaff, created.id, "WON", undefined, db);
    expect(won.leadStage).toBe("WON");
    expect(won.linkedProjectId).toBeNull();
  });

  it("NAC-007: XLSX/CSV parsing, legacy .xls rejection, 1900/1904 dates, duplicate review, idempotent batch, export neutralization, and conditional undo", async () => {
    // 1. Legacy .xls detection
    const xlsBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    expect(() => parseSpreadsheetBytes("old.xls", xlsBytes)).toThrow(/Legacy binary .xls format/);

    // 2. Excel 1900 vs 1904 dates
    expect(excelSerialToIsoDate(46353, "1900")).toBe("2026-11-27");
    expect(excelSerialToIsoDate(44891, "1904")).toBe("2026-11-27");

    // 3. Parse synthetic XLSX
    const xlsxBytes = buildSyntheticXlsx();
    const parsed = parseSpreadsheetBytes("leads.xlsx", xlsxBytes);
    expect(parsed.fileKind).toBe("XLSX");
    expect(parsed.sheets[0].name).toBe("Leads");
    const mapping = suggestLeadColumnMapping(parsed.sheets[0].headers);
    expect(mapping.name).toBe("Name");
    expect(mapping.phone).toBe("Phone");
    expect(mapping.requirement).toBe("Requirement");

    const rowsInput = parsed.sheets[0].rows.map((r, idx) => ({
      rowNumber: r.rowNumber,
      sheetName: "Leads",
      sourceExternalId: `src_${idx + 1}`,
      name: r.cells.Name.raw,
      phone: r.cells.Phone.raw,
      requirement: r.cells.Requirement.raw,
      hasMissingFormulaValue: r.cells.Requirement.isFormula && !r.cells.Requirement.hasCachedValue,
    }));

    // Preview flags missing cached formula row as REJECT and preserves +910987654321
    const preview = await previewLeadImport(intakeStaff, db, { rows: rowsInput });
    expect(preview.items[0].decision).toBe("CREATE");
    expect(preview.items[1].decision).toBe("REJECT");
    expect(preview.items[1].reason).toMatch(/Formula cell has no cached value/);

    // Confirm batch (with R2 storage)
    const batchResult = await confirmLeadImportBatch(
      intakeStaff,
      db,
      {
        batchId: "batch_n02_1",
        fileName: "leads.xlsx",
        fileSha256: "abc123",
        fileBytes: xlsxBytes.byteLength,
        mapping,
        rows: rowsInput,
      },
      r2,
      xlsxBytes
    );
    expect(batchResult.created).toBe(1);
    expect(batchResult.rejected).toBe(1);

    // Retry same batch -> idempotent (0 new created)
    const retryResult = await confirmLeadImportBatch(
      intakeStaff,
      db,
      {
        batchId: "batch_n02_1",
        fileName: "leads.xlsx",
        fileSha256: "abc123",
        fileBytes: xlsxBytes.byteLength,
        mapping,
        rows: rowsInput,
      }
    );
    expect(retryResult.created).toBe(1); // Counts already-processed rows without duplicating DB rows
    const allLeads = await listLeads(intakeStaff, db);
    expect(allLeads.length).toBe(1);
    expect(allLeads[0].contact_phone).toBe("+910987654321");

    // Formula-injection neutralization on CSV export
    expect(neutralizeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    const csvExport = await exportLeadsCsv(intakeStaff, db);
    expect(csvExport).toContain("Anoop Nair");

    // Conditional undo: untouched lead is reverted; if edited/followed-up, it is preserved
    const undoRes = await undoLeadImportBatch(intakeStaff, db, "batch_n02_1");
    expect(undoRes.reverted).toBe(1);
    expect((await listLeads(intakeStaff, db)).length).toBe(0);

    // Test conditional undo preservation when lead has post-import edit
    await confirmLeadImportBatch(
      intakeStaff,
      db,
      {
        batchId: "batch_n02_2",
        fileName: "leads.xlsx",
        fileSha256: "abc123",
        fileBytes: xlsxBytes.byteLength,
        mapping,
        rows: [rowsInput[0]],
      }
    );
    const createdLead = (await listLeads(intakeStaff, db))[0];
    await addLeadFollowup(intakeStaff, createdLead.id, { actionText: "Follow up after import" }, db);
    const undoPreserved = await undoLeadImportBatch(intakeStaff, db, "batch_n02_2");
    expect(undoPreserved.reverted).toBe(0);
    expect(undoPreserved.preservedConflicts.length).toBe(1);
    expect((await listLeads(intakeStaff, db)).length).toBe(1);
  });

  it("NAC-007: Asana CSV task import preserves 1-level parent relationships in private personal_tasks", async () => {
    const res = await importAsanaTasksBatch(intakeStaff, db, {
      batchId: "asana_1",
      rows: [
        { rowNumber: 2, sourceTaskId: "as_1", title: "Site measurement", section: "Design", dueDate: "2026-12-10" },
        { rowNumber: 3, sourceTaskId: "as_2", title: "Measure kitchen wall", parentSourceTaskId: "as_1" },
      ],
    });
    expect(res.created).toBe(2);
    expect(res.reviewNeeded.length).toBe(0);

    const personal = await listPersonalTasks(intakeStaff, db);
    expect(personal.length).toBe(2);
    const child = personal.find((p) => p.source_external_id === "as_2");
    const parent = personal.find((p) => p.source_external_id === "as_1");
    expect(child?.parent_task_id).toBe(parent?.id);
  });
});
