import { it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../test-db";
import {
  createDrawing,
  createDrawingVersion,
  submitDrawingForReview,
  submitConsultantReview,
  releaseDrawingVersion,
} from "@/server/domain/drawings/service";
import { getFileForDownload, listProjectFiles } from "@/server/files/service";
let db: D1Database, bucket: R2Bucket;
const p = (role: string, id = role) =>
  ({
    id,
    email: `${id}@example.test`,
    name: id,
    role,
    roles: [],
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "p", roles: [role] }],
  }) as any;
const staff = p("TEAM_MEMBER"),
  manager = p("MANAGER"),
  consultant = p("CONSULTANT"),
  client = p("MAIN_CLIENT");
beforeEach(async () => {
  db = await setupMigratedTestDb();
  bucket = createTestR2Bucket();
  await db.exec(
    "INSERT INTO projects(id,org_id,code,name,created_at) VALUES('p','org_merveille_main','P','Fictional project',1),('q','org_merveille_main','Q','Other project',1)",
  );
  for (const u of [staff, manager, consultant, client]) {
    await db
      .prepare(
        "INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'ACTIVE',1)",
      )
      .bind(u.id, u.email, u.name)
      .run();
    await db
      .prepare(
        "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,'org_merveille_main',?,1,1)",
      )
      .bind(u.id, u.id)
      .run();
    await db
      .prepare(
        "INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,'org_merveille_main','p',?,?,1,1)",
      )
      .bind(u.id, u.id, u.role)
      .run();
  }
});
async function version(label: string, project = "p") {
  const file = `f-${label}`;
  await db
    .prepare(
      "INSERT INTO files(id,org_id,project_id,uploaded_by_user_id,file_class,file_name,mime_type,size_bytes,storage_key,status,is_internal_only,reference_type,created_at) VALUES(?,'org_merveille_main',?,?,'PDF',?,'application/pdf',3,?,'READY',0,'DRAWING',1)",
    )
    .bind(file, project, staff.id, file, file)
    .run();
  await bucket.put(file, "PDF");
  let d = await db
    .prepare("SELECT id FROM drawings WHERE drawing_number='A-101'")
    .first<any>();
  if (!d)
    d = await createDrawing(
      staff,
      {
        projectId: "p",
        drawingNumber: "A-101",
        title: "Fictional plan",
        discipline: "ARCHITECTURAL",
      },
      db,
    );
  const v = await createDrawingVersion(
    staff,
    {
      drawingId: d.id,
      fileId: file,
      versionLabel: label,
      requiredConsultantIds: [consultant.id],
    },
    db,
  );
  return { v, file, d };
}
async function approve(v: any) {
  await submitDrawingForReview(staff, v.id, db);
  await submitConsultantReview(
    consultant,
    {
      versionId: v.id,
      decision: "APPROVED",
      reason: "Checked exact fictional version",
    },
    db,
  );
}
it("unreleased files are denied by ID/list; assigned consultant can review; release allows client", async () => {
  const { v, file } = await version("V1");
  await expect(getFileForDownload(client, file, db, bucket)).rejects.toThrow();
  expect(await listProjectFiles(client, "p", db)).toEqual([]);
  await submitDrawingForReview(staff, v.id, db);
  expect((await getFileForDownload(consultant, file, db, bucket)).status).toBe(
    200,
  );
  await submitConsultantReview(
    consultant,
    { versionId: v.id, decision: "APPROVED", reason: "Exact version reviewed" },
    db,
  );
  await releaseDrawingVersion(
    manager,
    { versionId: v.id, expectedCurrentVersionId: null },
    db,
  );
  expect((await getFileForDownload(client, file, db, bucket)).status).toBe(200);
  await expect(
    releaseDrawingVersion(
      { ...manager, roles: ["ADMIN"], projectMemberships: [] },
      { versionId: v.id },
      db,
    ),
  ).rejects.toThrow();
});
it("rejects another project attachment before creating a version", async () => {
  await expect(version("foreign", "q")).rejects.toThrow(
    "completed file from this project",
  );
  expect(
    (await db.prepare("SELECT count(*) n FROM drawing_versions").first<any>())
      .n,
  ).toBe(0);
});
it("failed release rolls back previous release and all writes; concurrent releases leave one winner", async () => {
  const first = await version("V1");
  await approve(first.v);
  await releaseDrawingVersion(
    manager,
    { versionId: first.v.id, expectedCurrentVersionId: null },
    db,
  );
  const second = await version("V2");
  await approve(second.v);
  await db.exec(
    "CREATE TRIGGER inject_release_failure BEFORE INSERT ON outbox_events WHEN NEW.event_type='DRAWING_RELEASED' BEGIN SELECT RAISE(ABORT,'injected'); END",
  );
  await expect(
    releaseDrawingVersion(
      manager,
      { versionId: second.v.id, expectedCurrentVersionId: first.v.id },
      db,
    ),
  ).rejects.toThrow();
  expect(
    (
      await db
        .prepare("SELECT current_released_version_id FROM drawings WHERE id=?")
        .bind(first.d.id)
        .first<any>()
    ).current_released_version_id,
  ).toBe(first.v.id);
  await db.exec("DROP TRIGGER inject_release_failure");
  const third = await version("V3");
  await approve(third.v);
  const outcomes = await Promise.allSettled([
    releaseDrawingVersion(
      manager,
      { versionId: second.v.id, expectedCurrentVersionId: first.v.id },
      db,
    ),
    releaseDrawingVersion(
      manager,
      { versionId: third.v.id, expectedCurrentVersionId: first.v.id },
      db,
    ),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM drawing_versions WHERE status='RELEASED'",
        )
        .first<any>()
    ).n,
  ).toBe(1);
});

it('safe preview is explicit, range suffixes are correct, and invalid ranges fail',async()=>{const {v,file}=await version('range');await approve(v);await releaseDrawingVersion(manager,{versionId:v.id,expectedCurrentVersionId:null},db);const download=await getFileForDownload(client,file,db,bucket);expect(download.headers.get('content-disposition')).toContain('attachment');const preview=await getFileForDownload(client,file,db,bucket,'bytes=-2',true);expect(preview.status).toBe(206);expect(preview.headers.get('content-range')).toBe('bytes 1-2/3');expect(preview.headers.get('content-disposition')).toContain('inline');expect(preview.headers.get('content-security-policy')).toContain('sandbox');expect(await new Response(preview.body).text()).toBe('DF');await expect(getFileForDownload(client,file,db,bucket,'bytes=4-5',true)).rejects.toThrow();});
it('raw receipt evidence does not inherit manager or owner operational visibility',async()=>{const {file}=await version('bank');await db.prepare("UPDATE files SET reference_type='GENERAL',is_referenced=0 WHERE id=?").bind(file).run();await db.prepare("INSERT INTO receipts(id,org_id,project_id,currency,amount_minor,allocated_minor,unallocated_minor,received_date,payment_method,status,reported_by_user_id,evidence_file_id,created_at) VALUES('bank-receipt','org_merveille_main','p','INR',100,0,100,'2026-11-24','BANK_TRANSFER','REPORTED',?,?,1)").bind(staff.id,file).run();await expect(getFileForDownload(manager,file,db,bucket)).rejects.toThrow();const owner={...manager,roles:['OWNER'],projectMemberships:[]};await expect(getFileForDownload(owner,file,db,bucket)).rejects.toThrow();expect((await getFileForDownload(staff,file,db,bucket)).status).toBe(200);});
