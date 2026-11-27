/**
 * Cloudflare Free-Tier Quota & Admission Control Service (Stage N00).
 * Enforces conservative operational ceilings within Cloudflare's published Free limits.
 * Never silently upgrades or falls back to paid endpoints; fails closed on exhaustion.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";

/**
 * Published Cloudflare Free allowances (checked 2026-11-27).
 * Application ceilings may never exceed these hard bounds.
 */
export const FREE_TIER_HARD_LIMITS = {
  ACCESS_SEATS: 50,
  R2_TOTAL_BYTES: 10_000_000_000, // 10 GB-month
  R2_CLASS_A_MONTHLY: 1_000_000,
  R2_CLASS_B_MONTHLY: 10_000_000,
  AI_NEURONS_DAILY: 10_000,
  QUEUE_OPS_DAILY: 10_000,
  D1_WRITES_DAILY: 100_000,
  D1_READS_DAILY: 5_000_000,
  WORKERS_CPU_MS_PER_INVOCATION: 10,
} as const;

/**
 * Conservative operational defaults leaving headroom for auth, admin, retries, and recovery.
 */
export const DEFAULT_OPERATIONAL_CEILINGS = {
  maxAccessSeats: 45,
  maxR2Bytes: 8_000_000_000, // 8 GB decimal (4 GB primary + 4 GB backup)
  maxR2PrimaryBytes: 4_000_000_000,
  maxR2BackupBytes: 4_000_000_000,
  maxR2ClassAMonthly: 250_000,
  maxR2ClassBMonthly: 2_000_000,
  maxAiNeuronsDaily: 8_000,
  maxAiAttemptsDaily: 100,
  maxQueueOpsDaily: 5_000,
  maxD1WritesDaily: 20_000,
  maxD1ReadsDaily: 1_000_000,
};

export interface QuotaPolicy {
  orgId: string;
  maxAccessSeats: number;
  maxR2Bytes: number;
  maxR2PrimaryBytes: number;
  maxR2BackupBytes: number;
  maxR2ClassAMonthly: number;
  maxR2ClassBMonthly: number;
  maxAiNeuronsDaily: number;
  maxAiAttemptsDaily: number;
  maxQueueOpsDaily: number;
  maxD1WritesDaily: number;
  maxD1ReadsDaily: number;
}

export function getUtcDayString(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function getUtcMonthString(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

export class QuotaService {
  /**
   * Fetch or initialize the organization's Free-tier quota policy.
   */
  static async getQuotaPolicy(db: D1Database, orgId: string): Promise<QuotaPolicy> {
    const row = await queryFirst<any>(
      db,
      `SELECT * FROM quota_policies WHERE org_id = ?`,
      [orgId]
    );
    if (!row) {
      return { orgId, ...DEFAULT_OPERATIONAL_CEILINGS };
    }
    return {
      orgId,
      maxAccessSeats: Math.min(row.max_access_seats, FREE_TIER_HARD_LIMITS.ACCESS_SEATS),
      maxR2Bytes: Math.min(row.max_r2_bytes, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2PrimaryBytes: Math.min(row.max_r2_primary_bytes, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2BackupBytes: Math.min(row.max_r2_backup_bytes, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2ClassAMonthly: Math.min(row.max_r2_class_a_monthly, FREE_TIER_HARD_LIMITS.R2_CLASS_A_MONTHLY),
      maxR2ClassBMonthly: Math.min(row.max_r2_class_b_monthly, FREE_TIER_HARD_LIMITS.R2_CLASS_B_MONTHLY),
      maxAiNeuronsDaily: Math.min(row.max_ai_neurons_daily, FREE_TIER_HARD_LIMITS.AI_NEURONS_DAILY),
      maxAiAttemptsDaily: row.max_ai_attempts_daily,
      maxQueueOpsDaily: Math.min(row.max_queue_ops_daily, FREE_TIER_HARD_LIMITS.QUEUE_OPS_DAILY),
      maxD1WritesDaily: Math.min(row.max_d1_writes_daily, FREE_TIER_HARD_LIMITS.D1_WRITES_DAILY),
      maxD1ReadsDaily: Math.min(row.max_d1_reads_daily, FREE_TIER_HARD_LIMITS.D1_READS_DAILY),
    };
  }

  /**
   * Admin-only update of operational ceilings, strictly clamped to Free-tier hard limits.
   */
  static async updateQuotaPolicy(
    db: D1Database,
    actor: UserPrincipal,
    orgId: string,
    patch: Partial<Omit<QuotaPolicy, "orgId">>
  ): Promise<QuotaPolicy> {
    if (!hasCapability(actor, "ADMIN")) {
      throw new AuthorizationError("Only administrators can adjust Free-tier operational ceilings.", "FORBIDDEN");
    }

    const current = await this.getQuotaPolicy(db, orgId);
    const next: QuotaPolicy = {
      orgId,
      maxAccessSeats: clampPositive(patch.maxAccessSeats ?? current.maxAccessSeats, 1, FREE_TIER_HARD_LIMITS.ACCESS_SEATS),
      maxR2Bytes: clampPositive(patch.maxR2Bytes ?? current.maxR2Bytes, 1_000_000, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2PrimaryBytes: clampPositive(patch.maxR2PrimaryBytes ?? current.maxR2PrimaryBytes, 1_000_000, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2BackupBytes: clampPositive(patch.maxR2BackupBytes ?? current.maxR2BackupBytes, 1_000_000, FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES),
      maxR2ClassAMonthly: clampPositive(patch.maxR2ClassAMonthly ?? current.maxR2ClassAMonthly, 1000, FREE_TIER_HARD_LIMITS.R2_CLASS_A_MONTHLY),
      maxR2ClassBMonthly: clampPositive(patch.maxR2ClassBMonthly ?? current.maxR2ClassBMonthly, 1000, FREE_TIER_HARD_LIMITS.R2_CLASS_B_MONTHLY),
      maxAiNeuronsDaily: clampPositive(patch.maxAiNeuronsDaily ?? current.maxAiNeuronsDaily, 0, FREE_TIER_HARD_LIMITS.AI_NEURONS_DAILY),
      maxAiAttemptsDaily: clampPositive(patch.maxAiAttemptsDaily ?? current.maxAiAttemptsDaily, 0, 500),
      maxQueueOpsDaily: clampPositive(patch.maxQueueOpsDaily ?? current.maxQueueOpsDaily, 0, FREE_TIER_HARD_LIMITS.QUEUE_OPS_DAILY),
      maxD1WritesDaily: clampPositive(patch.maxD1WritesDaily ?? current.maxD1WritesDaily, 1000, FREE_TIER_HARD_LIMITS.D1_WRITES_DAILY),
      maxD1ReadsDaily: clampPositive(patch.maxD1ReadsDaily ?? current.maxD1ReadsDaily, 1000, FREE_TIER_HARD_LIMITS.D1_READS_DAILY),
    };

    if (next.maxR2PrimaryBytes + next.maxR2BackupBytes > next.maxR2Bytes) {
      throw new AuthorizationError(
        "Primary + backup storage ceilings cannot exceed total R2 ceiling.",
        "INVALID_INPUT"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO quota_policies (
          org_id, max_access_seats, max_r2_bytes, max_r2_primary_bytes, max_r2_backup_bytes,
          max_r2_class_a_monthly, max_r2_class_b_monthly, max_ai_neurons_daily, max_ai_attempts_daily,
          max_queue_ops_daily, max_d1_writes_daily, max_d1_reads_daily, updated_by_user_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          max_access_seats = excluded.max_access_seats,
          max_r2_bytes = excluded.max_r2_bytes,
          max_r2_primary_bytes = excluded.max_r2_primary_bytes,
          max_r2_backup_bytes = excluded.max_r2_backup_bytes,
          max_r2_class_a_monthly = excluded.max_r2_class_a_monthly,
          max_r2_class_b_monthly = excluded.max_r2_class_b_monthly,
          max_ai_neurons_daily = excluded.max_ai_neurons_daily,
          max_ai_attempts_daily = excluded.max_ai_attempts_daily,
          max_queue_ops_daily = excluded.max_queue_ops_daily,
          max_d1_writes_daily = excluded.max_d1_writes_daily,
          max_d1_reads_daily = excluded.max_d1_reads_daily,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at`
      )
      .bind(
        orgId,
        next.maxAccessSeats,
        next.maxR2Bytes,
        next.maxR2PrimaryBytes,
        next.maxR2BackupBytes,
        next.maxR2ClassAMonthly,
        next.maxR2ClassBMonthly,
        next.maxAiNeuronsDaily,
        next.maxAiAttemptsDaily,
        next.maxQueueOpsDaily,
        next.maxD1WritesDaily,
        next.maxD1ReadsDaily,
        actor.id,
        now
      )
      .run();

    return next;
  }

  /**
   * Count occupied Access seats: active org users + unexpired pending invitations.
   * Rejects invitation if seat ceiling would be exceeded (NAC-002).
   */
  static async assertAccessSeatAvailable(
    db: D1Database,
    orgId: string,
    emailToInvite?: string
  ): Promise<{ occupied: number; pending: number; maxSeats: number }> {
    const policy = await this.getQuotaPolicy(db, orgId);
    const now = Date.now();

    const activeUsersRow = await queryFirst<{ cnt: number }>(
      db,
      `SELECT COUNT(DISTINCT u.id) as cnt
       FROM users u
       JOIN organization_memberships m ON m.user_id = u.id
       WHERE m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE'`,
      [orgId]
    );

    const pendingInvitesRow = await queryFirst<{ cnt: number }>(
      db,
      `SELECT COUNT(DISTINCT lower(email)) as cnt
       FROM invitations
       WHERE org_id = ? AND status = 'PENDING' AND expires_at > ?
         AND lower(email) NOT IN (
           SELECT lower(u.email) FROM users u
           JOIN organization_memberships m ON m.user_id = u.id
           WHERE m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE'
         )`,
      [orgId, now, orgId]
    );

    const occupied = activeUsersRow?.cnt ?? 0;
    const pending = pendingInvitesRow?.cnt ?? 0;
    const totalUsed = occupied + pending;

    // If re-inviting an already active or pending email, it does not consume a new seat
    if (emailToInvite) {
      const normalized = emailToInvite.trim().toLowerCase();
      const alreadyCounted = await queryFirst<{ cnt: number }>(
        db,
        `SELECT 1 as cnt FROM users u
         JOIN organization_memberships m ON m.user_id = u.id
         WHERE m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE' AND lower(u.email) = ?
         UNION
         SELECT 1 as cnt FROM invitations
         WHERE org_id = ? AND status = 'PENDING' AND expires_at > ? AND lower(email) = ?`,
        [orgId, normalized, orgId, now, normalized]
      );
      if (alreadyCounted) {
        return { occupied, pending, maxSeats: policy.maxAccessSeats };
      }
    }

    if (totalUsed >= policy.maxAccessSeats) {
      throw new AuthorizationError(
        `Access seat ceiling reached (${totalUsed}/${policy.maxAccessSeats} seats occupied or reserved within Cloudflare Free's 50-seat limit). Offboard an unused user or revoke a pending invite before inviting another person.`,
        "ACCESS_SEAT_QUOTA_EXHAUSTED"
      );
    }

    return { occupied, pending, maxSeats: policy.maxAccessSeats };
  }

  /**
   * Clean up expired storage/AI reservations so stale unfinished uploads don't permanently lock quota.
   */
  static async expireStaleReservations(db: D1Database, orgId: string, now = Date.now()) {
    await db
      .prepare(
        `UPDATE quota_reservations
         SET status = 'EXPIRED', settled_at = ?
         WHERE org_id = ? AND status = 'RESERVED' AND expires_at < ?`
      )
      .bind(now, orgId, now)
      .run();
  }

  /**
   * Atomically reserve R2 storage bytes before accepting an upload, import, or backup.
   * Fails closed if primary/backup or total R2 ceiling would be exceeded.
   */
  static async reserveStorageBytes(
    db: D1Database,
    orgId: string,
    attemptId: string,
    bytes: number,
    bucketKind: "PRIMARY" | "BACKUP" = "PRIMARY"
  ): Promise<{ reservationId: string; reservedBytes: number }> {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) {
      throw new AuthorizationError("Storage reservation size must be a positive integer.", "INVALID_INPUT");
    }

    const now = Date.now();
    await this.expireStaleReservations(db, orgId, now);

    // Idempotent return if this attemptId already has an active or committed reservation
    const existing = await queryFirst<any>(
      db,
      `SELECT id, reserved_amount, status FROM quota_reservations
       WHERE org_id = ? AND resource_type = ? AND attempt_id = ?`,
      [orgId, bucketKind === "BACKUP" ? "R2_BACKUP_BYTES" : "R2_PRIMARY_BYTES", attemptId]
    );
    if (existing && (existing.status === "RESERVED" || existing.status === "COMMITTED")) {
      return { reservationId: existing.id, reservedBytes: existing.reserved_amount };
    }

    const policy = await this.getQuotaPolicy(db, orgId);
    const primaryUsedRow = await queryFirst<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM files WHERE org_id = ? AND status != 'DELETED'`,
      [orgId]
    );
    const activeReservationsRow = await queryFirst<{ primary_res: number; backup_res: number }>(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN resource_type = 'R2_PRIMARY_BYTES' THEN reserved_amount ELSE 0 END), 0) as primary_res,
         COALESCE(SUM(CASE WHEN resource_type = 'R2_BACKUP_BYTES' THEN reserved_amount ELSE 0 END), 0) as backup_res
       FROM quota_reservations
       WHERE org_id = ? AND status = 'RESERVED' AND expires_at >= ?`,
      [orgId, now]
    );

    const primaryUsed = (primaryUsedRow?.total ?? 0) + (activeReservationsRow?.primary_res ?? 0);
    const backupRes = activeReservationsRow?.backup_res ?? 0;

    if (bucketKind === "PRIMARY" && primaryUsed + bytes > policy.maxR2PrimaryBytes) {
      throw new AuthorizationError(
        `Primary storage ceiling reached (${Math.round(primaryUsed / 1_000_000)} MB used/reserved of ${Math.round(policy.maxR2PrimaryBytes / 1_000_000)} MB ceiling). Pause uploads or free space without deleting required history.`,
        "STORAGE_QUOTA_EXHAUSTED"
      );
    }
    if (bucketKind === "BACKUP" && backupRes + bytes > policy.maxR2BackupBytes) {
      throw new AuthorizationError(
        `Backup storage ceiling reached (${Math.round(backupRes / 1_000_000)} MB reserved of ${Math.round(policy.maxR2BackupBytes / 1_000_000)} MB ceiling).`,
        "STORAGE_QUOTA_EXHAUSTED"
      );
    }
    if (primaryUsed + backupRes + bytes > policy.maxR2Bytes) {
      throw new AuthorizationError(
        `Total R2 Free-tier ceiling (${Math.round(policy.maxR2Bytes / 1_000_000)} MB) would be exceeded.`,
        "STORAGE_QUOTA_EXHAUSTED"
      );
    }

    const resId = `qres_${crypto.randomUUID()}`;
    const resourceType = bucketKind === "BACKUP" ? "R2_BACKUP_BYTES" : "R2_PRIMARY_BYTES";
    const expiresAt = now + 2 * 60 * 60 * 1000; // 2-hour upload window

    await db
      .prepare(
        `INSERT INTO quota_reservations (id, org_id, resource_type, attempt_id, reserved_amount, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'RESERVED', ?, ?)
         ON CONFLICT(org_id, resource_type, attempt_id) DO UPDATE SET
           reserved_amount = excluded.reserved_amount,
           status = 'RESERVED',
           expires_at = excluded.expires_at`
      )
      .bind(resId, orgId, resourceType, attemptId, bytes, expiresAt, now)
      .run();

    return { reservationId: resId, reservedBytes: bytes };
  }

  static async commitStorageReservation(
    db: D1Database,
    orgId: string,
    attemptId: string,
    actualBytes: number,
    bucketKind: "PRIMARY" | "BACKUP" = "PRIMARY"
  ) {
    const resourceType = bucketKind === "BACKUP" ? "R2_BACKUP_BYTES" : "R2_PRIMARY_BYTES";
    await db
      .prepare(
        `UPDATE quota_reservations
         SET status = 'COMMITTED', actual_amount = ?, settled_at = ?
         WHERE org_id = ? AND resource_type = ? AND attempt_id = ?`
      )
      .bind(actualBytes, Date.now(), orgId, resourceType, attemptId)
      .run();
  }

  static async releaseStorageReservation(
    db: D1Database,
    orgId: string,
    attemptId: string,
    bucketKind: "PRIMARY" | "BACKUP" = "PRIMARY"
  ) {
    const resourceType = bucketKind === "BACKUP" ? "R2_BACKUP_BYTES" : "R2_PRIMARY_BYTES";
    await db
      .prepare(
        `UPDATE quota_reservations
         SET status = 'RELEASED', settled_at = ?
         WHERE org_id = ? AND resource_type = ? AND attempt_id = ? AND status = 'RESERVED'`
      )
      .bind(Date.now(), orgId, resourceType, attemptId)
      .run();
  }

  /**
   * Atomically reserve daily Workers AI neurons and attempt count before running voice inference (NAC-009).
   * Idempotent on attemptId so browser retries do not double-reserve or bypass budget.
   */
  static async reserveAiNeurons(
    db: D1Database,
    orgId: string,
    attemptId: string,
    estimatedMaxNeurons: number
  ): Promise<{ reservationId: string; reservedNeurons: number; remainingNeurons: number }> {
    if (!attemptId || !Number.isSafeInteger(estimatedMaxNeurons) || estimatedMaxNeurons <= 0) {
      throw new AuthorizationError("Valid attempt ID and positive neuron estimate are required.", "INVALID_INPUT");
    }

    const now = Date.now();
    const dayUtc = getUtcDayString(now);

    // Idempotency check
    const existing = await queryFirst<any>(
      db,
      `SELECT id, reserved_amount, status FROM quota_reservations
       WHERE org_id = ? AND resource_type = 'AI_NEURONS' AND attempt_id = ?`,
      [orgId, attemptId]
    );
    if (existing) {
      if (existing.status === "RESERVED" || existing.status === "COMMITTED") {
        const policy = await this.getQuotaPolicy(db, orgId);
        const daily = await queryFirst<any>(
          db,
          `SELECT used_count, reserved_count FROM quota_usage_daily
           WHERE org_id = ? AND day_utc = ? AND metric = 'AI_NEURONS'`,
          [orgId, dayUtc]
        );
        const usedTotal = (daily?.used_count ?? 0) + (daily?.reserved_count ?? 0);
        return {
          reservationId: existing.id,
          reservedNeurons: existing.reserved_amount,
          remainingNeurons: Math.max(0, policy.maxAiNeuronsDaily - usedTotal),
        };
      }
    }

    const policy = await this.getQuotaPolicy(db, orgId);

    // Ensure daily rows exist
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO quota_usage_daily (org_id, day_utc, metric, used_count, reserved_count, updated_at)
           VALUES (?, ?, 'AI_NEURONS', 0, 0, ?)`
        )
        .bind(orgId, dayUtc, now),
      db
        .prepare(
          `INSERT OR IGNORE INTO quota_usage_daily (org_id, day_utc, metric, used_count, reserved_count, updated_at)
           VALUES (?, ?, 'AI_ATTEMPTS', 0, 0, ?)`
        )
        .bind(orgId, dayUtc, now),
    ]);

    // Atomic conditional update for AI_ATTEMPTS
    const attemptUpdate = await db
      .prepare(
        `UPDATE quota_usage_daily
         SET used_count = used_count + 1, updated_at = ?
         WHERE org_id = ? AND day_utc = ? AND metric = 'AI_ATTEMPTS'
           AND (used_count + reserved_count + 1) <= ?`
      )
      .bind(now, orgId, dayUtc, policy.maxAiAttemptsDaily)
      .run();

    if ((attemptUpdate.meta?.changes ?? 0) === 0) {
      throw new AuthorizationError(
        `Daily voice dictation attempt ceiling reached (${policy.maxAiAttemptsDaily} attempts/day). Typing remains available; quota resets at 00:00 UTC.`,
        "AI_QUOTA_EXHAUSTED"
      );
    }

    // Atomic conditional update for AI_NEURONS
    const neuronUpdate = await db
      .prepare(
        `UPDATE quota_usage_daily
         SET reserved_count = reserved_count + ?, updated_at = ?
         WHERE org_id = ? AND day_utc = ? AND metric = 'AI_NEURONS'
           AND (used_count + reserved_count + ?) <= ?`
      )
      .bind(estimatedMaxNeurons, now, orgId, dayUtc, estimatedMaxNeurons, policy.maxAiNeuronsDaily)
      .run();

    if ((neuronUpdate.meta?.changes ?? 0) === 0) {
      // Roll back the attempt increment since neurons failed
      await db
        .prepare(
          `UPDATE quota_usage_daily SET used_count = MAX(0, used_count - 1) WHERE org_id = ? AND day_utc = ? AND metric = 'AI_ATTEMPTS'`
        )
        .bind(orgId, dayUtc)
        .run();
      throw new AuthorizationError(
        `Daily Workers AI neuron budget reached (${policy.maxAiNeuronsDaily} neurons/day within Free's 10,000 limit). Typing remains available; quota resets at 00:00 UTC.`,
        "AI_QUOTA_EXHAUSTED"
      );
    }

    const resId = `qres_${crypto.randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO quota_reservations (id, org_id, resource_type, attempt_id, reserved_amount, status, expires_at, created_at)
         VALUES (?, ?, 'AI_NEURONS', ?, ?, 'RESERVED', ?, ?)`
      )
      .bind(resId, orgId, attemptId, estimatedMaxNeurons, now + 15 * 60 * 1000, now)
      .run();

    const dailyAfter = await queryFirst<any>(
      db,
      `SELECT used_count, reserved_count FROM quota_usage_daily
       WHERE org_id = ? AND day_utc = ? AND metric = 'AI_NEURONS'`,
      [orgId, dayUtc]
    );
    const usedTotal = (dailyAfter?.used_count ?? 0) + (dailyAfter?.reserved_count ?? 0);

    return {
      reservationId: resId,
      reservedNeurons: estimatedMaxNeurons,
      remainingNeurons: Math.max(0, policy.maxAiNeuronsDaily - usedTotal),
    };
  }

  /**
   * Settle an AI neuron reservation with actual measured neurons (or conservative fallback on failure).
   * Never replenishes an uncertain/failed call as 0 if inference may have occurred.
   */
  static async settleAiNeurons(
    db: D1Database,
    orgId: string,
    attemptId: string,
    actualNeurons: number
  ) {
    const now = Date.now();
    const dayUtc = getUtcDayString(now);
    const res = await queryFirst<any>(
      db,
      `SELECT id, reserved_amount, status FROM quota_reservations
       WHERE org_id = ? AND resource_type = 'AI_NEURONS' AND attempt_id = ?`,
      [orgId, attemptId]
    );
    if (!res || res.status !== "RESERVED") return;

    const settled = Math.max(0, Math.min(res.reserved_amount, Math.ceil(actualNeurons)));
    await db.batch([
      db
        .prepare(
          `UPDATE quota_reservations SET status = 'COMMITTED', actual_amount = ?, settled_at = ? WHERE id = ?`
        )
        .bind(settled, now, res.id),
      db
        .prepare(
          `UPDATE quota_usage_daily
           SET reserved_count = MAX(0, reserved_count - ?),
               used_count = used_count + ?,
               updated_at = ?
           WHERE org_id = ? AND day_utc = ? AND metric = 'AI_NEURONS'`
        )
        .bind(res.reserved_amount, settled, now, orgId, dayUtc),
    ]);
  }

  /**
   * Record and check Queue operations against daily Free-tier ceiling (5,000 ops/day).
   */
  static async reserveQueueOps(
    db: D1Database,
    orgId: string,
    opsNeeded: number
  ): Promise<boolean> {
    if (opsNeeded <= 0) return true;
    const now = Date.now();
    const dayUtc = getUtcDayString(now);
    const policy = await this.getQuotaPolicy(db, orgId);

    await db
      .prepare(
        `INSERT OR IGNORE INTO quota_usage_daily (org_id, day_utc, metric, used_count, reserved_count, updated_at)
         VALUES (?, ?, 'QUEUE_OPS', 0, 0, ?)`
      )
      .bind(orgId, dayUtc, now)
      .run();

    const upd = await db
      .prepare(
        `UPDATE quota_usage_daily
         SET used_count = used_count + ?, updated_at = ?
         WHERE org_id = ? AND day_utc = ? AND metric = 'QUEUE_OPS'
           AND (used_count + ?) <= ?`
      )
      .bind(opsNeeded, now, orgId, dayUtc, opsNeeded, policy.maxQueueOpsDaily)
      .run();

    return (upd.meta?.changes ?? 0) > 0;
  }

  /**
   * Record R2 Class A or Class B operations against monthly Free ceilings.
   */
  static async recordR2Ops(
    db: D1Database,
    orgId: string,
    kind: "R2_CLASS_A" | "R2_CLASS_B",
    count = 1
  ) {
    const now = Date.now();
    const monthUtc = getUtcMonthString(now);
    await db
      .prepare(
        `INSERT INTO quota_usage_monthly (org_id, month_utc, metric, used_count, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(org_id, month_utc, metric) DO UPDATE SET
           used_count = used_count + excluded.used_count,
           updated_at = excluded.updated_at`
      )
      .bind(orgId, monthUtc, kind, count, now)
      .run();
  }

  /**
   * Record scheduled job execution status for administrator stale-success monitoring.
   */
  static async recordJobRun(
    db: D1Database,
    orgId: string,
    jobName: string,
    status: "OK" | "FAILED" | "DEFERRED_QUOTA",
    itemsProcessed: number,
    estimatedCpuMs?: number,
    error?: string
  ) {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO job_execution_status (
          job_name, org_id, last_started_at, last_succeeded_at, last_status, last_error, items_processed, estimated_cpu_ms, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_name) DO UPDATE SET
          org_id = excluded.org_id,
          last_started_at = excluded.last_started_at,
          last_succeeded_at = CASE WHEN excluded.last_status = 'OK' THEN excluded.last_succeeded_at ELSE job_execution_status.last_succeeded_at END,
          last_status = excluded.last_status,
          last_error = excluded.last_error,
          items_processed = excluded.items_processed,
          estimated_cpu_ms = excluded.estimated_cpu_ms,
          updated_at = excluded.updated_at`
      )
      .bind(
        jobName,
        orgId,
        now,
        status === "OK" ? now : null,
        status,
        error ?? null,
        itemsProcessed,
        estimatedCpuMs ?? null,
        now
      )
      .run();
  }

  /**
   * Build full administrator quota & Free-tier capacity snapshot.
   */
  static async getQuotaSnapshot(db: D1Database, actor: UserPrincipal, orgId: string) {
    if (!hasCapability(actor, "ADMIN") && !hasCapability(actor, "OWNER")) {
      throw new AuthorizationError("Only administrators or owners can inspect quota occupancy.", "FORBIDDEN");
    }

    const now = Date.now();
    const dayUtc = getUtcDayString(now);
    const monthUtc = getUtcMonthString(now);
    const policy = await this.getQuotaPolicy(db, orgId);

    const seats = await (async () => {
      const activeUsersRow = await queryFirst<{ cnt: number }>(
        db,
        `SELECT COUNT(DISTINCT u.id) as cnt FROM users u
         JOIN organization_memberships m ON m.user_id = u.id
         WHERE m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE'`,
        [orgId]
      );
      const pendingInvitesRow = await queryFirst<{ cnt: number }>(
        db,
        `SELECT COUNT(DISTINCT lower(email)) as cnt FROM invitations
         WHERE org_id = ? AND status = 'PENDING' AND expires_at > ?`,
        [orgId, now]
      );
      return {
        activeUsers: activeUsersRow?.cnt ?? 0,
        pendingInvites: pendingInvitesRow?.cnt ?? 0,
        ceiling: policy.maxAccessSeats,
        freeLimit: FREE_TIER_HARD_LIMITS.ACCESS_SEATS,
      };
    })();

    const primaryFilesRow = await queryFirst<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(size_bytes), 0) as total FROM files WHERE org_id = ? AND status != 'DELETED'`,
      [orgId]
    );
    const activeResRow = await queryFirst<{ primary_res: number; backup_res: number }>(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN resource_type = 'R2_PRIMARY_BYTES' THEN reserved_amount ELSE 0 END), 0) as primary_res,
         COALESCE(SUM(CASE WHEN resource_type = 'R2_BACKUP_BYTES' THEN reserved_amount ELSE 0 END), 0) as backup_res
       FROM quota_reservations WHERE org_id = ? AND status = 'RESERVED' AND expires_at >= ?`,
      [orgId, now]
    );

    const dailyRows = await query<{ metric: string; used_count: number; reserved_count: number }>(
      db,
      `SELECT metric, used_count, reserved_count FROM quota_usage_daily WHERE org_id = ? AND day_utc = ?`,
      [orgId, dayUtc]
    );
    const dailyMap = Object.fromEntries(
      dailyRows.map((r) => [r.metric, { used: r.used_count, reserved: r.reserved_count }])
    );

    const monthlyRows = await query<{ metric: string; used_count: number }>(
      db,
      `SELECT metric, used_count FROM quota_usage_monthly WHERE org_id = ? AND month_utc = ?`,
      [orgId, monthUtc]
    );
    const monthlyMap = Object.fromEntries(monthlyRows.map((r) => [r.metric, r.used_count]));

    const jobs = await query<any>(
      db,
      `SELECT * FROM job_execution_status WHERE org_id = ? OR org_id IS NULL ORDER BY updated_at DESC`,
      [orgId]
    );

    return {
      dayUtc,
      monthUtc,
      policy,
      hardLimits: FREE_TIER_HARD_LIMITS,
      seats,
      storage: {
        primaryBytesUsed: primaryFilesRow?.total ?? 0,
        primaryBytesReserved: activeResRow?.primary_res ?? 0,
        backupBytesReserved: activeResRow?.backup_res ?? 0,
        ceilingBytes: policy.maxR2Bytes,
        r2OverageNotice:
          "Cloudflare R2 is a metered subscription beyond 10 GB-month; application ceilings fail closed before exceeding 8 GB, but provider-enforced zero-spend caps are not available for R2.",
      },
      daily: {
        aiNeurons: dailyMap["AI_NEURONS"] ?? { used: 0, reserved: 0 },
        aiAttempts: dailyMap["AI_ATTEMPTS"] ?? { used: 0, reserved: 0 },
        queueOps: dailyMap["QUEUE_OPS"] ?? { used: 0, reserved: 0 },
      },
      monthly: {
        r2ClassA: monthlyMap["R2_CLASS_A"] ?? 0,
        r2ClassB: monthlyMap["R2_CLASS_B"] ?? 0,
      },
      jobs,
    };
  }
}

function clampPositive(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
