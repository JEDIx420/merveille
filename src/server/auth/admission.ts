import { query } from "@/server/db";
type AdmissionEnv = Pick<CloudflareEnv,
  "DB" | "ACCESS_ACCOUNT_ID" | "ACCESS_APP_ID" | "ACCESS_POLICY_ID" |
  "ACCESS_API_TOKEN" | "ACCESS_IDP_ID" | "ACCESS_GOOGLE_IDP_ID"
>;

/** Updates only the configured dedicated policy. Application revocation never waits on this. */
export async function reconcileAccessAdmission(env: AdmissionEnv, orgId: string) {
  const idp = env.ACCESS_IDP_ID || env.ACCESS_GOOGLE_IDP_ID;
  if (!env.ACCESS_ACCOUNT_ID || !env.ACCESS_APP_ID || !env.ACCESS_POLICY_ID ||
      !env.ACCESS_API_TOKEN || !idp || !/^[a-f0-9-]{36}$/.test(idp))
    return { status: "PENDING_SETUP", processed: 0 };
  const owner = crypto.randomUUID();
  try {
    // The provider timeout is shorter than the lease. Concurrent callers leave durable jobs pending.
    const locked = await env.DB.prepare(`
      INSERT INTO access_admission_sync_locks(org_id,owner,expires_at) VALUES(?,?,?)
      ON CONFLICT(org_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at
      WHERE access_admission_sync_locks.expires_at<? RETURNING owner
    `).bind(orgId, owner, Date.now() + 120000, Date.now()).first<{owner: string}>();
    if (locked?.owner !== owner) return { status: "RETRY", processed: 0 };
    try {
      return await updatePolicy(env, orgId, idp);
    } finally {
      await env.DB.prepare("DELETE FROM access_admission_sync_locks WHERE org_id=? AND owner=?")
        .bind(orgId, owner).run();
    }
  } catch {
    // A completed invitation must not appear unsaved when infrastructure is temporarily unavailable.
    return { status: "RETRY", processed: 0 };
  }
}

async function updatePolicy(env: AdmissionEnv, orgId: string, idp: string) {
  const snapshotAt = Date.now();
  const emails = await query<{email: string}>(env.DB, `
    SELECT DISTINCT lower(u.email) AS email FROM users u
    JOIN organization_memberships m ON m.user_id=u.id
    WHERE m.org_id=? AND m.is_active=1 AND u.status='ACTIVE'
      AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='cloudflare_access')
    UNION SELECT lower(email) AS email FROM invitations
    WHERE org_id=? AND status='PENDING' AND expires_at>?
  `, [orgId, orgId, snapshotAt]);
  if (!emails.length) return { status: "PENDING_SETUP", processed: 0 };
  const pendingJobs = await query<{id:string; email:string; desired_state:string}>(env.DB,
    "SELECT id,email,desired_state FROM access_admission_jobs WHERE org_id=? AND status!='COMPLETE' AND created_at<=?", [orgId,snapshotAt]);
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.ACCESS_ACCOUNT_ID!)}/access/policies/${encodeURIComponent(env.ACCESS_POLICY_ID!)}`;
  try {
    const headers = { Authorization: `Bearer ${env.ACCESS_API_TOKEN}`, "Content-Type": "application/json" };
    const currentResponse = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const current = await currentResponse.json() as {success?: boolean; result?: Record<string, any>};
    if (!currentResponse.ok || !current.success || current.result?.id !== env.ACCESS_POLICY_ID || current.result?.app_count !== 1 || current.result?.decision !== "allow")
      throw new Error("A dedicated application policy is required.");
    // Preserve independently configured MFA/session/approval controls rather than resetting them.
    const settings = Object.fromEntries([
      "approval_groups", "approval_required", "connection_rules", "isolation_required",
      "mfa_config", "policy_resolution_account_id", "purpose_justification_prompt",
      "purpose_justification_required", "session_duration",
    ].filter(key => current.result![key] !== undefined).map(key => [key, current.result![key]]));
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...settings,
        name: "Merveille invited accounts", decision: "allow",
        include: emails.map(({email}) => ({email: {email}})),
        require: [
          ...(current.result?.require || []).filter((rule: Record<string, unknown>) => !rule.login_method),
          {login_method: {id: idp}},
        ],
        exclude: current.result?.exclude || [],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as {success?: boolean};
    if (!response.ok || !result.success) throw new Error("Admission reconciliation rejected.");
    // Only the synchronized snapshot becomes ready. New invites remain pending for the next pass.
    // Chunk parameters below D1's per-statement binding limit; there is no application user cap.
    const updates: D1PreparedStatement[] = [];
    for (let offset = 0; offset < emails.length; offset += 80) {
      const chunk = emails.slice(offset, offset + 80).map(item => item.email);
      const placeholders = chunk.map(() => "?").join(",");
      updates.push(env.DB.prepare(`UPDATE invitations SET admission_status='READY'
        WHERE org_id=? AND status='PENDING' AND expires_at>? AND created_at<=?
        AND lower(email) IN (${placeholders})`).bind(orgId, Date.now(), snapshotAt, ...chunk));
    }
    const allowed = new Set(emails.map(item=>item.email));
    const completedJobs = pendingJobs.filter(job =>
      job.desired_state === "ALLOW" ? allowed.has(job.email.toLowerCase()) :
      job.desired_state === "REVOKE" && !allowed.has(job.email.toLowerCase())
    ).map(job=>job.id);
    for (let offset=0; offset<completedJobs.length; offset+=80) {
      const chunk=completedJobs.slice(offset,offset+80);
      updates.push(env.DB.prepare(`UPDATE access_admission_jobs SET status='COMPLETE',attempt_count=attempt_count+1,last_error=NULL WHERE org_id=? AND id IN (${chunk.map(()=>"?").join(",")})`).bind(orgId,...chunk));
    }
    await env.DB.batch(updates);
    return { status: "READY", processed: emails.length };
  } catch {
    await env.DB.prepare(`UPDATE access_admission_jobs SET status='RETRY',
      attempt_count=attempt_count+1,last_error='Access reconciliation failed'
      WHERE org_id=? AND status!='COMPLETE'`).bind(orgId).run();
    return { status: "RETRY", processed: 0 };
  }
}
