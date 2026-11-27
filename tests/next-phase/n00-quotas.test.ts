import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import { QuotaService, FREE_TIER_HARD_LIMITS } from "@/server/quota/service";
import { inviteUser } from "@/server/domain/identity/service";

describe("Stage N00: Free-Tier Quota & Admission Envelope (NAC-001, NAC-002)", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";

  const adminUser: UserPrincipal = {
    id: "usr_admin_n00",
    email: "admin.n00@merveilledesigns.com",
    name: "Admin N00",
    role: "ADMIN",
    roles: ["ADMIN"],
    orgId,
    projectMemberships: [],
    authenticatedAt: Date.now(),
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_n00",
    email: "staff.n00@merveilledesigns.com",
    name: "Staff N00",
    role: "STAFF",
    roles: ["TEAM_MEMBER"],
    orgId,
    projectMemberships: [],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    const now = Date.now();
    for (const u of [adminUser, staffUser]) {
      await db
        .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
        .bind(u.id, u.email, u.name, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at) VALUES (?, ?, ?, ?, 'GLOBAL', ?)`)
        .bind(`ra_${u.id}`, orgId, u.id, u.role, now)
        .run();
    }
  });

  it("NAC-001/002: Admin can inspect and tune conservative ceilings clamped to Free hard limits; non-admin denied", async () => {
    await expect(
      QuotaService.getQuotaSnapshot(db, staffUser, orgId)
    ).rejects.toThrow("Only administrators or owners can inspect quota occupancy.");

    await expect(
      QuotaService.updateQuotaPolicy(db, staffUser, orgId, { maxAiNeuronsDaily: 5000 })
    ).rejects.toThrow("Only administrators can adjust Free-tier operational ceilings.");

    // Attempt to exceed Cloudflare Free hard limits is clamped
    const updated = await QuotaService.updateQuotaPolicy(db, adminUser, orgId, {
      maxAccessSeats: 100,
      maxAiNeuronsDaily: 25000,
      maxR2Bytes: 20_000_000_000,
      maxR2PrimaryBytes: 4_000_000_000,
      maxR2BackupBytes: 4_000_000_000,
    });

    expect(updated.maxAccessSeats).toBe(FREE_TIER_HARD_LIMITS.ACCESS_SEATS);
    expect(updated.maxAiNeuronsDaily).toBe(FREE_TIER_HARD_LIMITS.AI_NEURONS_DAILY);
    expect(updated.maxR2Bytes).toBe(FREE_TIER_HARD_LIMITS.R2_TOTAL_BYTES);

    const snapshot = await QuotaService.getQuotaSnapshot(db, adminUser, orgId);
    expect(snapshot.storage.r2OverageNotice).toContain("provider-enforced zero-spend caps are not available for R2");
  });

  it("NAC-002: Access seat ceiling blocks new invitations when occupied + pending reach ceiling", async () => {
    // Set ceiling to 1 above current occupied count
    const before = await QuotaService.assertAccessSeatAvailable(db, orgId);
    const currentUsed = before.occupied + before.pending;
    await QuotaService.updateQuotaPolicy(db, adminUser, orgId, { maxAccessSeats: currentUsed + 1 });

    // Next seat via invite succeeds
    const inv1 = await inviteUser(
      adminUser,
      { email: "next.seat@example.com", displayName: "Next User" },
      db
    );
    expect(inv1.invitationId).toBeDefined();

    // Seat after ceiling fails closed
    await expect(
      inviteUser(
        adminUser,
        { email: "over.seat@example.com", displayName: "Over Seat User" },
        db
      )
    ).rejects.toThrow(/Access seat ceiling reached/);
  });

  it("NAC-002: Storage byte reservations enforce primary ceiling, expire stale locks, and fail closed", async () => {
    await QuotaService.updateQuotaPolicy(db, adminUser, orgId, {
      maxR2Bytes: 10_000_000,
      maxR2PrimaryBytes: 5_000_000,
      maxR2BackupBytes: 5_000_000,
    });

    const r1 = await QuotaService.reserveStorageBytes(db, orgId, "att_1", 3_000_000, "PRIMARY");
    expect(r1.reservedBytes).toBe(3_000_000);

    // Idempotent retry on same attemptId
    const r1Retry = await QuotaService.reserveStorageBytes(db, orgId, "att_1", 3_000_000, "PRIMARY");
    expect(r1Retry.reservationId).toBe(r1.reservationId);

    // Exceeding primary ceiling fails closed
    await expect(
      QuotaService.reserveStorageBytes(db, orgId, "att_2", 3_000_000, "PRIMARY")
    ).rejects.toThrow(/Primary storage ceiling reached/);

    // Release frees capacity
    await QuotaService.releaseStorageReservation(db, orgId, "att_1", "PRIMARY");
    const r2 = await QuotaService.reserveStorageBytes(db, orgId, "att_2", 3_000_000, "PRIMARY");
    expect(r2.reservedBytes).toBe(3_000_000);
  });

  it("NAC-002: Workers AI daily neuron & attempt reservations are idempotent and fail closed without paid fallback", async () => {
    await QuotaService.updateQuotaPolicy(db, adminUser, orgId, {
      maxAiNeuronsDaily: 200,
      maxAiAttemptsDaily: 3,
    });

    const res1 = await QuotaService.reserveAiNeurons(db, orgId, "voice_1", 100);
    expect(res1.remainingNeurons).toBe(100);

    // Idempotent retry returns same reservation without double charging
    const res1Retry = await QuotaService.reserveAiNeurons(db, orgId, "voice_1", 100);
    expect(res1Retry.reservationId).toBe(res1.reservationId);
    expect(res1Retry.remainingNeurons).toBe(100);

    // Settle voice_1 with actual 75 neurons
    await QuotaService.settleAiNeurons(db, orgId, "voice_1", 75);

    // 2nd attempt (100 neurons) fits in remaining 125
    await QuotaService.reserveAiNeurons(db, orgId, "voice_2", 100);

    // 3rd attempt (100 neurons) exceeds remaining 25 -> fails closed
    await expect(
      QuotaService.reserveAiNeurons(db, orgId, "voice_3", 100)
    ).rejects.toThrow(/Daily Workers AI neuron budget reached/);
  });

  it("NAC-002: Queue ops ceiling and job execution monitoring track status", async () => {
    await QuotaService.updateQuotaPolicy(db, adminUser, orgId, { maxQueueOpsDaily: 5 });
    expect(await QuotaService.reserveQueueOps(db, orgId, 3)).toBe(true);
    expect(await QuotaService.reserveQueueOps(db, orgId, 3)).toBe(false);

    await QuotaService.recordJobRun(db, orgId, "notification_scanner", "OK", 4, 2.4);
    const snapshot = await QuotaService.getQuotaSnapshot(db, adminUser, orgId);
    expect(snapshot.jobs.length).toBe(1);
    expect(snapshot.jobs[0].last_status).toBe("OK");
    expect(snapshot.jobs[0].items_processed).toBe(4);
  });

  it("NAC-001: Concurrent reserveStorageBytes enforces ceiling atomically and AI attemptId replay is rejected", async () => {
    await QuotaService.updateQuotaPolicy(db, adminUser, orgId, {
      maxR2Bytes: 2_000_000,
      maxR2PrimaryBytes: 1_000_000,
      maxR2BackupBytes: 1_000_000,
    });

    // Parallel storage admission: 600k + 600k > 1M ceiling -> at most 1 succeeds
    const results = await Promise.allSettled([
      QuotaService.reserveStorageBytes(db, orgId, "attempt_conc_1", 600_000, "PRIMARY"),
      QuotaService.reserveStorageBytes(db, orgId, "attempt_conc_2", 600_000, "PRIMARY"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // AI reservation replay after COMMITTED must fail with ATTEMPT_ALREADY_USED
    await QuotaService.reserveAiNeurons(db, orgId, "ai_replay_1", 50);
    await QuotaService.settleAiNeurons(db, orgId, "ai_replay_1", 30);
    await expect(
      QuotaService.reserveAiNeurons(db, orgId, "ai_replay_1", 50)
    ).rejects.toThrow(/already been processed/);
  });
});
