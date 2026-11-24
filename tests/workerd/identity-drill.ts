/** Verified identity claims enter only this isolated service harness. No Google/Access integration is proven. */
import {
  acceptInvitation,
  inviteUser,
  disableUser,
  digestToken,
  manageInvitation,
} from "../../src/server/domain/identity/service";
import type { AccessJwtPayload } from "../../src/server/auth/jwt";
import type { UserPrincipal } from "../../src/server/auth/principal";
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
export async function identityDrill(db: D1Database, passed: string[]) {
  const org = "org_merveille_main",
    now = Date.now();
  const initialEmail = "bootstrap.person@example.invalid",
    secondEmail = "second.person@example.invalid";
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const claims = (email: string, subject: string): AccessJwtPayload => ({
    email,
    sub: subject,
    iss: "https://isolated-test.cloudflareaccess.com",
    aud: ["isolated-test"],
    iat: Math.floor(now / 1000),
    nbf: Math.floor(now / 1000) - 1,
    exp: Math.floor(now / 1000) + 3600,
    type: "app",
  });
  await db
    .prepare(
      "INSERT INTO bootstrap_setup(id,email,token_digest,invitation_id,operator_id,expires_at,admission_status,created_at) VALUES(1,?,?,?,?,?,'READY',?)",
    )
    .bind(
      initialEmail,
      await digestToken(raw),
      "workerd_bootstrap_invite",
      "workerd_bootstrap_operator",
      now + 3600000,
      now,
    )
    .run();
  const race = await Promise.allSettled([
    acceptInvitation(raw, claims(initialEmail, "initial-subject"), db),
    acceptInvitation(raw, claims(initialEmail, "initial-subject"), db),
  ]);
  check(
    race.filter((r) => r.status === "fulfilled").length === 1,
    "Bootstrap acceptance race did not yield one winner",
  );
  const accepted = await db
    .prepare(
      "SELECT u.id FROM users u JOIN role_assignments r ON r.user_id=u.id JOIN identities i ON i.user_id=u.id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.org_id=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1 AND i.provider='cloudflare_access'",
    )
    .bind(org)
    .all<{ id: string }>();
  check(
    accepted.results.length === 1,
    "Bootstrap granted more than one accepted administrator",
  );
  const initial: UserPrincipal = {
    id: accepted.results[0].id,
    email: initialEmail,
    name: "Fictional initial admin",
    orgId: org,
    role: "ADMIN",
    roles: ["ADMIN"],
    projectMemberships: [],
    authenticatedAt: now,
  };
  check(
    (
      await db
        .prepare("SELECT consumed_at FROM bootstrap_state WHERE id=1")
        .first<any>()
    )?.consumed_at > 0,
    "Bootstrap was not consumed",
  );
  passed.push(
    "Concurrent exact-identity bootstrap acceptance yields one initial accepted ADMIN",
  );
  // Removing temporary input must never reset the persisted consumed singleton.
  await db.prepare("DELETE FROM bootstrap_setup WHERE id=1").run();
  let blocked = false;
  try {
    await db
      .prepare(
        "INSERT INTO bootstrap_setup(id,email,token_digest,invitation_id,operator_id,expires_at,admission_status,created_at) VALUES(1,?,?,?,?,?,'READY',?)",
      )
      .bind(
        secondEmail,
        await digestToken(raw),
        "workerd_second_bootstrap",
        "workerd_second_operator",
        now + 3600000,
        now,
      )
      .run();
  } catch {
    blocked = true;
  }
  check(blocked, "Consumed bootstrap could be recreated");
  passed.push("Second bootstrap fails after temporary setup input is removed");
  blocked = false;
  try {
    await inviteUser(
      initial,
      {
        email: secondEmail,
        displayName: "Fictional second admin",
        roles: ["ADMIN"],
        projects: [],
      },
      db,
    );
  } catch {
    blocked = true;
  }
  check(
    blocked,
    "Administrator elevation did not require explicit confirmation",
  );
  blocked = false;
  try {
    await inviteUser(
      { ...initial, authenticatedAt: now - 16 * 60 * 1000 },
      {
        email: secondEmail,
        displayName: "Fictional second admin",
        roles: ["ADMIN"],
        projects: [],
        confirmElevation: true,
      },
      db,
    );
  } catch {
    blocked = true;
  }
  check(
    blocked,
    "Administrator elevation did not require recent verified authentication",
  );
  const invitation = await inviteUser(
    initial,
    {
      email: secondEmail,
      displayName: "Fictional second admin",
      roles: ["ADMIN"],
      projects: [],
      confirmElevation: true,
    },
    db,
  );
  await manageInvitation(initial, invitation.invitationId, "READY", db);
  const link = new URL(
    invitation.invitationUrl,
    "https://isolated.example.invalid",
  );
  const secondToken = new URLSearchParams(link.hash.slice(1)).get("token");
  check(secondToken, "Invitation token missing");
  const secondAccepted = await acceptInvitation(
    secondToken!,
    claims(secondEmail, "second-subject"),
    db,
  );
  const second: UserPrincipal = {
    id: secondAccepted.userId,
    email: secondEmail,
    name: "Fictional second admin",
    orgId: org,
    role: "ADMIN",
    roles: ["ADMIN"],
    projectMemberships: [],
    authenticatedAt: now,
  };
  const removals = await Promise.allSettled([
    disableUser(initial, second.id, "Isolated concurrent revocation test", db),
    disableUser(second, initial.id, "Isolated concurrent revocation test", db),
  ]);
  check(
    removals.filter((r) => r.status === "fulfilled").length === 1,
    "Concurrent admin removals did not yield one winner",
  );
  const remaining = await db
    .prepare(
      "SELECT COUNT(DISTINCT u.id) n FROM users u JOIN role_assignments r ON r.user_id=u.id JOIN identities i ON i.user_id=u.id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.org_id=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1 AND i.provider='cloudflare_access'",
    )
    .bind(org)
    .first<{ n: number }>();
  check(
    remaining?.n === 1,
    "Concurrent removals disabled every accepted administrator",
  );
  passed.push(
    "Explicit second-admin invitation and concurrent removals preserve one accepted administrator",
  );
}
