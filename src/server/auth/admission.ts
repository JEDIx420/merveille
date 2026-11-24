import { query, queryFirst } from "@/server/db";
/** Reconciles a dedicated exact-email Access policy. Never shares a general-purpose policy. */
export async function reconcileAccessAdmission(
  env: Pick<
    CloudflareEnv,
    | "DB"
    | "ACCESS_ACCOUNT_ID"
    | "ACCESS_APP_ID"
    | "ACCESS_POLICY_ID"
    | "ACCESS_API_TOKEN"
    | "ACCESS_GOOGLE_IDP_ID"
  >,
  orgId: string,
) {
  if (
    !env.ACCESS_ACCOUNT_ID ||
    !env.ACCESS_APP_ID ||
    !env.ACCESS_POLICY_ID ||
    !env.ACCESS_API_TOKEN ||
    !env.ACCESS_GOOGLE_IDP_ID
  )
    return { status: "PENDING_SETUP", processed: 0 };
  // Provider policy is dedicated to this app; a failed sync never restores application privileges.
  const emails = await query<{ email: string }>(
    env.DB,
    `SELECT DISTINCT lower(u.email) AS email FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE m.org_id=? AND m.is_active=1 AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='cloudflare_access') UNION SELECT lower(email) AS email FROM invitations WHERE org_id=? AND status='PENDING' AND expires_at>?`,
    [orgId, orgId, Date.now()],
  );
  if (!emails.length) return { status: "PENDING_SETUP", processed: 0 };
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.ACCESS_ACCOUNT_ID)}/access/apps/${encodeURIComponent(env.ACCESS_APP_ID)}/policies/${encodeURIComponent(env.ACCESS_POLICY_ID)}`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.ACCESS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Merveille invited Google accounts",
        decision: "allow",
        include: emails.map(({ email }) => ({ email: { email } })),
        require: [{ login_method: { id: env.ACCESS_GOOGLE_IDP_ID } }],
        exclude: [],
      }),
    });
    const result = (await response.json()) as { success?: boolean };
    if (!response.ok || !result.success)
      throw new Error("Admission provider rejected reconciliation.");
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE invitations SET admission_status='READY' WHERE org_id=? AND status='PENDING' AND expires_at>?",
      ).bind(orgId, Date.now()),
      env.DB.prepare(
        "UPDATE access_admission_jobs SET status='COMPLETE',attempt_count=attempt_count+1,last_error=NULL WHERE org_id=? AND status!='COMPLETE'",
      ).bind(orgId),
    ]);
    return { status: "READY", processed: emails.length };
  } catch {
    await env.DB.prepare(
      "UPDATE access_admission_jobs SET status='RETRY',attempt_count=attempt_count+1,last_error='Access reconciliation failed' WHERE org_id=? AND status!='COMPLETE'",
    )
      .bind(orgId)
      .run();
    return { status: "RETRY", processed: 0 };
  }
}
