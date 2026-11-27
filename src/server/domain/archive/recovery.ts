import { createHash } from "node:crypto";
import type { UserPrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";
import { QuotaService } from "@/server/quota/service";
const CHUNK = 8 * 1024 * 1024,
  MAX_MANIFEST = 20 * 1024 * 1024;
const quote = (v: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))
    throw new Error("Unsafe schema identifier.");
  return `"${v}"`;
};
interface ObjectEntry {
  fileId: string;
  storageKey: string;
  size: number;
  sha256: string;
  chunks: { key: string; size: number; sha256: string }[];
}
export interface RecoveryManifest {
  version: 2;
  checkpointId: string;
  orgId: string;
  projectId: string;
  createdAt: number;
  schema: { name: string; sql: string; foreignKeys: any[] }[];
  tables: Record<string, Record<string, any>[]>;
  objects: ObjectEntry[];
  status: "COMPLETE";
  accessState: "QUARANTINED_ON_RESTORE";
}
const hex = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
/** An organisation checkpoint includes cross-project accounting and identity dependencies.
 * A transactionally consistent D1 batch snapshots rows; immutable R2 keys preserve that checkpoint.
 * Bounded 8 MiB object segments avoid buffering video/CAD files in Worker memory.
 */
export async function createRecoveryCheckpoint(
  db: D1Database,
  source: R2Bucket,
  backup: R2Bucket | undefined,
  p: UserPrincipal,
  projectId: string,
) {
  if (!hasCapability(p, "ADMIN"))
    throw new AuthorizationError(
      "Only administrators can create recovery checkpoints.",
    );
  const admin = await queryFirst<any>(
    db,
    `SELECT u.id FROM users u JOIN organization_memberships m ON m.user_id=u.id JOIN role_assignments r ON r.user_id=u.id AND r.org_id=m.org_id WHERE u.id=? AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1 AND r.role='ADMIN' AND r.revoked_at IS NULL`,
    [p.id, p.orgId],
  );
  if (!admin)
    throw new AuthorizationError("Administrator access is no longer active.");
  if (!backup || backup === source)
    throw new AuthorizationError(
      "Separate protected backup storage is not configured.",
      "BACKUP_UNAVAILABLE",
    );
  const project = await queryFirst<any>(
    db,
    "SELECT id FROM projects WHERE id=? AND org_id=?",
    [projectId, p.orgId],
  );
  if (!project) throw new AuthorizationError("Project not found.", "NOT_FOUND");
  const checkpointId = crypto.randomUUID();
  const prefix = `backups/checkpoints/${checkpointId}`;
  const now = Date.now();
  const filesSizeRow = await queryFirst<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(size_bytes), 0) as total FROM files WHERE org_id=? AND status='READY'`,
    [p.orgId],
  );
  const estimatedBackupBytes = Math.max(1024, (filesSizeRow?.total ?? 0) + 65536);
  await QuotaService.reserveStorageBytes(
    db,
    p.orgId,
    `bkp_${checkpointId}`,
    estimatedBackupBytes,
    "BACKUP",
  );
  await db
    .prepare(
      "INSERT INTO backup_runs(id,org_id,project_id,status,created_by,created_at) VALUES(?,?,?,'COPYING',?,?)",
    )
    .bind(checkpointId, p.orgId, projectId, p.id, now)
    .run();
  try {
    const schema = await query<{ name: string; sql: string }>(
      db,
      "SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name",
    );
    const excluded = new Set([
      "backup_runs",
      "celebration_events",
      "celebration_consumptions",
      "financial_guard",
      "atomic_guards",
      "command_guards",
      "command_assertions",
      "security_rate_limits",
      "identities",
      "external_identities",
      "identity_bindings",
      "bootstrap_state",
      "bootstrap_setup",
      "access_admission_jobs",
      "access_admission_sync_locks",
      "bootstrap_invitations",
      "bootstrap",
    ]);
    const tablesToRead = schema.filter(
      (t) => !excluded.has(t.name) && !t.name.startsWith("_"),
    );
    const foreignKeys = await db.batch(
      tablesToRead.map((t) =>
        db.prepare(`PRAGMA foreign_key_list(${quote(t.name)})`),
      ),
    );
    const snapshot = await db.batch(
      tablesToRead.map((t) => db.prepare(`SELECT * FROM ${quote(t.name)}`)),
    );
    const all: Record<string, any[]> = {};
    tablesToRead.forEach((t, i) => (all[t.name] = snapshot[i].results || []));
    const tables: Record<string, any[]> = {};
    const userIds = new Set(
      (all.organization_memberships || [])
        .filter((r) => r.org_id === p.orgId)
        .map((r) => r.user_id),
    );
    tablesToRead.forEach((t) => {
      const rows = all[t.name];
      if (t.name === "organizations")
        tables[t.name] = rows.filter((r) => r.id === p.orgId);
      else if (t.name === "users")
        tables[t.name] = rows.filter((r) => userIds.has(r.id));
      else if (rows.some((r) => "org_id" in r))
        tables[t.name] = rows.filter((r) => r.org_id === p.orgId);
      else tables[t.name] = [];
    });
    // Resolve children without org_id through their declared parent relationships.
    for (let pass = 0; pass < tablesToRead.length; pass++) {
      let changed = false;
      tablesToRead.forEach((t, i) => {
        if (
          ["users", "organizations"].includes(t.name) ||
          all[t.name].some((r) => "org_id" in r)
        )
          return;
        const fks = foreignKeys[i].results as any[];
        const scopedFks = fks.filter(
          (f) =>
            f.table !== "users" && f.table !== "organizations" && all[f.table],
        );
        if (!scopedFks.length) return;
        const rows = all[t.name].filter((row) =>
          scopedFks.some((f) =>
            (tables[f.table] || []).some(
              (parent) => parent[f.to] === row[f.from],
            ),
          ),
        );
        if (rows.length !== tables[t.name].length) {
          tables[t.name] = rows;
          changed = true;
        }
      });
      if (!changed) break;
    }
    const requiredUsers = new Set(userIds);
    tablesToRead.forEach((t, i) => {
      for (const fk of foreignKeys[i].results as any[])
        if (fk.table === "users")
          for (const row of tables[t.name])
            if (row[fk.from]) requiredUsers.add(row[fk.from]);
    });
    tables.users = (all.users || []).filter((u) => requiredUsers.has(u.id));
    if (all.identity_recovery_events)
      tables.identity_recovery_events = all.identity_recovery_events.filter(
        (r) => requiredUsers.has(r.user_id),
      );
    // A checkpoint must be restorable, not just a collection of matching rows.
    // Reject cross-scope/missing dependencies instead of marking a broken snapshot complete.
    tablesToRead.forEach((table, index) => {
      for (const fk of foreignKeys[index].results as any[]) {
        if (!tables[fk.table]) continue;
        for (const row of tables[table.name])
          if (
            row[fk.from] !== null &&
            row[fk.from] !== undefined &&
            !tables[fk.table].some((parent) => parent[fk.to] === row[fk.from])
          )
            throw new Error("SOURCE_RELATIONSHIP_INCOMPLETE");
      }
    });
    const manifest: RecoveryManifest = {
      version: 2,
      checkpointId,
      orgId: p.orgId,
      projectId,
      createdAt: now,
      schema: tablesToRead.map((t, i) => ({
        ...t,
        foreignKeys: foreignKeys[i].results as any[],
      })),
      tables,
      objects: [],
      status: "COMPLETE",
      accessState: "QUARANTINED_ON_RESTORE",
    };
    if (JSON.stringify(manifest).length > MAX_MANIFEST)
      throw new Error("CHECKPOINT_TOO_LARGE_USE_OPERATOR_EXPORT");
    for (const f of tables.files || []) {
      if (f.status !== "READY") continue;
      const head = await source.head(f.storage_key);
      if (!head) throw new Error("SOURCE_OBJECT_MISSING");
      if (head.size !== f.size_bytes)
        throw new Error("SOURCE_OBJECT_SIZE_MISMATCH");
      const object: ObjectEntry = {
        fileId: f.id,
        storageKey: f.storage_key,
        size: head.size,
        sha256: "",
        chunks: [],
      };
      const hasher = createHash("sha256");
      for (
        let offset = 0, index = 0;
        offset < head.size;
        offset += CHUNK, index++
      ) {
        const length = Math.min(CHUNK, head.size - offset);
        const part = await source.get(f.storage_key, {
          range: { offset, length },
          ...(head.etag ? { onlyIf: { etagMatches: head.etag } } : {}),
        });
        if (!part) throw new Error("SOURCE_OBJECT_MISSING");
        const bytes = new Uint8Array(await part.arrayBuffer());
        if (bytes.byteLength !== length)
          throw new Error("SOURCE_OBJECT_TRUNCATED");
        hasher.update(bytes);
        const key = `${prefix}/objects/${encodeURIComponent(f.id)}/${index}`;
        await backup.put(key, bytes, {
          customMetadata: { sha256: hex(bytes) },
        });
        object.chunks.push({ key, size: length, sha256: hex(bytes) });
      }
      object.sha256 = hasher.digest("hex");
      manifest.objects.push(object);
    }
    const json = JSON.stringify(manifest);
    if (new TextEncoder().encode(json).byteLength > MAX_MANIFEST)
      throw new Error("CHECKPOINT_TOO_LARGE_USE_OPERATOR_EXPORT");
    const manifestSha256 = hex(new TextEncoder().encode(json));
    const backupKey = `${prefix}/manifest.json`;
    await backup.put(backupKey, json, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { sha256: manifestSha256 },
    });
    const totalBackupBytes =
      new TextEncoder().encode(json).byteLength +
      manifest.objects.reduce((s, o) => s + o.size, 0);
    await QuotaService.commitStorageReservation(
      db,
      p.orgId,
      `bkp_${checkpointId}`,
      Math.max(1, totalBackupBytes),
      "BACKUP",
    );
    await QuotaService.recordR2Ops(
      db,
      p.orgId,
      "R2_CLASS_A",
      1 + manifest.objects.reduce((s, o) => s + Math.max(1, o.chunks.length), 0),
    );
    await db
      .prepare(
        "UPDATE backup_runs SET status='COMPLETE',manifest_key=?,manifest_sha256=?,completed_at=? WHERE id=?",
      )
      .bind(backupKey, manifestSha256, Date.now(), checkpointId)
      .run();
    const recordCounts = Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [name, rows.length]),
    );
    return {
      checkpointId,
      backupKey,
      manifestSha256,
      scope: "ORGANIZATION",
      recordCounts,
      filesVerifiedCount: manifest.objects.length,
    };
  } catch (error) {
    await QuotaService.releaseStorageReservation(
      db,
      p.orgId,
      `bkp_${checkpointId}`,
      "BACKUP",
    ).catch(() => {});
    await db
      .prepare(
        "UPDATE backup_runs SET status='INCOMPLETE',failure_code=? WHERE id=?",
      )
      .bind("CHECKPOINT_FAILED", checkpointId)
      .run();
    throw error;
  }
}
/** Operator-only restore. No HTTP route exposes this function. All restored access is quarantined. */
export async function restoreRecoveryCheckpoint(
  targetDb: D1Database,
  backup: R2Bucket,
  target: R2Bucket,
  backupKey: string,
  expectedSha256: string,
) {
  if (backup === target) throw new Error("RESTORE_REQUIRES_ISOLATED_BUCKET");
  const object = await backup.get(backupKey);
  if (!object || object.size > MAX_MANIFEST)
    throw new Error("INVALID_MANIFEST");
  const json = await object.text();
  if (hex(new TextEncoder().encode(json)) !== expectedSha256)
    throw new Error("MANIFEST_HASH_MISMATCH");
  const manifest = JSON.parse(json) as RecoveryManifest;
  if (
    manifest.version !== 2 ||
    manifest.status !== "COMPLETE" ||
    manifest.accessState !== "QUARANTINED_ON_RESTORE"
  )
    throw new Error("INVALID_MANIFEST");
  const existing = await queryFirst<any>(
    targetDb,
    "SELECT COUNT(*) AS n FROM projects",
  );
  if (existing?.n) throw new Error("RESTORE_TARGET_NOT_EMPTY");
  // Verify every independent backup segment before altering the empty target database.
  for (const obj of manifest.objects) {
    const hash = createHash("sha256");
    let size = 0;
    for (const part of obj.chunks) {
      const stored = await backup.get(part.key);
      if (!stored || stored.size !== part.size || part.size > CHUNK)
        throw new Error("BACKUP_OBJECT_MISSING");
      const bytes = new Uint8Array(await stored.arrayBuffer());
      if (hex(bytes) !== part.sha256)
        throw new Error("BACKUP_OBJECT_HASH_MISMATCH");
      hash.update(bytes);
      size += bytes.length;
    }
    if (size !== obj.size || hash.digest("hex") !== obj.sha256)
      throw new Error("BACKUP_FILE_HASH_MISMATCH");
  }
  const pending = new Set(Object.keys(manifest.tables));
  const order: string[] = [];
  while (pending.size) {
    let changed = false;
    for (const name of pending) {
      const parents = (
        manifest.schema.find((s) => s.name === name)?.foreignKeys || []
      )
        .map((f) => f.table)
        .filter((t) => t !== name && pending.has(t));
      if (!parents.length) {
        order.push(name);
        pending.delete(name);
        changed = true;
      }
    }
    if (!changed) throw new Error("RESTORE_SCHEMA_CYCLE_REQUIRES_OPERATOR");
  }
  const triggers = await query<{ name: string; sql: string }>(
    targetDb,
    "SELECT name,sql FROM sqlite_schema WHERE type='trigger'",
  );
  const now = Date.now();
  const statements: D1PreparedStatement[] = triggers.map((t) =>
    targetDb.prepare(`DROP TRIGGER ${quote(t.name)}`),
  );
  for (const name of order)
    for (const original of manifest.tables[name]) {
      const row = { ...original };
      if (name === "users") row.status = "DISABLED";
      if (name === "organization_memberships" || name === "project_memberships")
        row.is_active = 0;
      if (name === "role_assignments") row.revoked_at = now;
      if (name === "invitations") {
        row.status = "REVOKED";
        row.token = `revoked_${crypto.randomUUID()}`;
        if ("token_digest" in row) row.token_digest = null;
      }
      if (name === "notifications") row.status = "SUPPRESSED";
      if (name === "outbox_events") row.status = "SUPPRESSED";
      if (name === "notification_preferences") row.whatsapp_enabled = 0;
      const columns = Object.keys(row);
      const sql = `INSERT ${["organizations", "users", "organization_memberships", "role_assignments"].includes(name) ? "OR IGNORE " : ""}INTO ${quote(name)}(${columns.map(quote).join(",")}) VALUES(${columns.map(() => "?").join(",")})`;
      statements.push(
        targetDb.prepare(sql).bind(...columns.map((c) => row[c])),
      );
    }
  // Quarantine destination seeds in the same transaction, before any fallible object copy.
  statements.push(
    targetDb
      .prepare(
        "UPDATE users SET status='DISABLED' WHERE id IN(SELECT user_id FROM organization_memberships WHERE org_id=?)",
      )
      .bind(manifest.orgId),
    targetDb
      .prepare("UPDATE organization_memberships SET is_active=0 WHERE org_id=?")
      .bind(manifest.orgId),
    targetDb
      .prepare("UPDATE project_memberships SET is_active=0 WHERE org_id=?")
      .bind(manifest.orgId),
    targetDb
      .prepare(
        "UPDATE role_assignments SET revoked_at=? WHERE org_id=? AND revoked_at IS NULL",
      )
      .bind(now, manifest.orgId),
  );
  const bootstrapTable = await queryFirst<any>(
    targetDb,
    "SELECT name FROM sqlite_schema WHERE type='table' AND name='bootstrap_state'",
  );
  if (bootstrapTable)
    statements.push(
      targetDb.prepare(
        "INSERT OR REPLACE INTO bootstrap_state(id,invitation_id,consumed_at) VALUES(1,?,?)",
      )
        .bind(`restored-quarantined:${manifest.checkpointId}`, now),
    );

  // Actual D1 batch is transactional; a missing dependency rolls back the entire record checkpoint.
  statements.push(...triggers.map((t) => targetDb.prepare(t.sql)));
  if (statements.length) await targetDb.batch(statements);
  for (const obj of manifest.objects) {
    if (obj.chunks.length === 1) {
      const part = await backup.get(obj.chunks[0].key);
      await target.put(obj.storageKey, await part!.arrayBuffer());
    } else if (obj.chunks.length === 0)
      await target.put(obj.storageKey, new Uint8Array());
    else {
      const upload = await target.createMultipartUpload(obj.storageKey);
      try {
        const parts = [];
        for (let i = 0; i < obj.chunks.length; i++) {
          const part = await backup.get(obj.chunks[i].key);
          parts.push(await upload.uploadPart(i + 1, await part!.arrayBuffer()));
        }
        await upload.complete(parts);
      } catch (e) {
        await upload.abort();
        throw e;
      }
    }
    const restored = await target.get(obj.storageKey);
    if (!restored) throw new Error("RESTORE_OBJECT_MISSING");
    const hash = createHash("sha256");
    const reader = restored.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      hash.update(chunk.value);
    }
    if (hash.digest("hex") !== obj.sha256)
      throw new Error("RESTORE_OBJECT_HASH_MISMATCH");
  }
  const financial = await queryFirst<any>(
    targetDb,
    "SELECT COALESCE(SUM(outstanding_minor),0) AS outstanding FROM invoices WHERE org_id=?",
    [manifest.orgId],
  );
  return {
    reconciled: true,
    accessState: "QUARANTINED",
    requiresCurrentAccessReconciliation: true,
    restoredCounts: {
      ...Object.fromEntries(
        Object.entries(manifest.tables).map(([n, r]) => [n, r.length]),
      ),
      totalOutstandingMinor: financial?.outstanding || 0,
    },
    fileChecksumsVerified: manifest.objects.length,
  };
}
