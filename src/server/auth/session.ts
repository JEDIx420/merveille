/**
 * Session and Principal resolution from Cloudflare Access JWT or local synthetic credentials.
 */

import { NextRequest } from "next/server";
import { UserPrincipal, resolveSyntheticPrincipal } from "./principal";
import { validateAccessJwt } from "./jwt";
import { query, queryFirst } from "../db";

export interface ResolvedAuth {
  principal: UserPrincipal | null;
  status: "AUTHENTICATED" | "UNAUTHENTICATED" | "DISABLED" | "UNREGISTERED";
  error?: string;
  email?: string;
}

/**
 * Resolve authenticated principal from NextRequest.
 */
export async function getSessionPrincipal(
  request: NextRequest | Request,
  env: CloudflareEnv
): Promise<ResolvedAuth> {
  const headers = request.headers;
  // NextRequest provides cookies helper; standard Request can read Cookie header
  const cookies =
    "cookies" in request && typeof (request as any).cookies?.get === "function"
      ? (request as NextRequest).cookies
      : {
          get: (name: string) => {
            const raw = headers.get("cookie") || "";
            const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
            return match ? { value: decodeURIComponent(match[1]) } : undefined;
          },
        };

  // 1. Check Cloudflare Access JWT Assertion first
  const jwt = headers.get("cf-access-jwt-assertion");
  if (jwt) {
    const jwtResult = await validateAccessJwt(jwt, env);
    if (!jwtResult.valid || !jwtResult.payload) {
      return {
        principal: null,
        status: "UNAUTHENTICATED",
        error: jwtResult.error || "Invalid Access Assertion",
      };
    }

    // Lookup user in D1 by email
    const email = jwtResult.payload.email.toLowerCase().trim();
    return await loadPrincipalByEmail(email, env.DB, false);
  }

  // 2. Fallback to synthetic auth ONLY in local development
  if (env.APP_ENV === "local" || env.ALLOW_SYNTHETIC_AUTH === "true") {
    const synthetic = resolveSyntheticPrincipal(headers, cookies, env);
    if (synthetic) {
      // Check if D1 has a record for this synthetic user
      const existing = await queryFirst<{ id: string; status: string }>(
        env.DB,
        "SELECT id, status FROM users WHERE id = ? OR email = ?",
        [synthetic.id, synthetic.email]
      );

      if (existing && existing.status === "DISABLED") {
        return {
          principal: null,
          status: "DISABLED",
          error: "Account has been deactivated by administrator.",
          email: synthetic.email,
        };
      }

      return {
        principal: synthetic,
        status: "AUTHENTICATED",
        email: synthetic.email,
      };
    }
  }

  return {
    principal: null,
    status: "UNAUTHENTICATED",
  };
}

/**
 * Load principal and active permissions from D1.
 */
export async function loadPrincipalByEmail(
  email: string,
  db: D1Database,
  isSynthetic = false
): Promise<ResolvedAuth> {
  const user = await queryFirst<{
    id: string;
    email: string;
    display_name: string;
    status: string;
  }>(db, "SELECT id, email, display_name, status FROM users WHERE lower(email) = ?", [
    email.toLowerCase().trim(),
  ]);

  if (!user) {
    return {
      principal: null,
      status: "UNREGISTERED",
      email,
    };
  }

  if (user.status === "DISABLED") {
    return {
      principal: null,
      status: "DISABLED",
      error: "Account has been deactivated by administrator.",
      email,
    };
  }

  // Fetch organization membership
  const orgMem = await queryFirst<{ org_id: string }>(
    db,
    "SELECT org_id FROM organization_memberships WHERE user_id = ? AND is_active = 1",
    [user.id]
  );

  const orgId = orgMem?.org_id || "org_merveille_main";

  // Fetch active global roles
  const roles = await query<{ role: string }>(
    db,
    "SELECT role FROM role_assignments WHERE user_id = ? AND revoked_at IS NULL",
    [user.id]
  );

  // Highest priority role or default STAFF
  const roleList = roles.map((r) => r.role);
  let primaryRole: any = "STAFF";
  if (roleList.includes("OWNER")) primaryRole = "OWNER";
  else if (roleList.includes("ADMIN")) primaryRole = "ADMIN";
  else if (roleList.includes("MANAGER")) primaryRole = "MANAGER";
  else if (roleList.includes("CONSULTANT")) primaryRole = "CONSULTANT";
  else if (roleList.includes("MAIN_CLIENT")) primaryRole = "MAIN_CLIENT";
  else if (roleList.includes("CLIENT_REP")) primaryRole = "CLIENT_REP";

  // Fetch project memberships
  const projectMems = await query<{ project_id: string; project_role: string }>(
    db,
    "SELECT project_id, project_role FROM project_memberships WHERE user_id = ? AND is_active = 1",
    [user.id]
  );

  const principal: UserPrincipal = {
    id: user.id,
    email: user.email,
    name: user.display_name,
    role: primaryRole,
    orgId,
    projectMemberships: projectMems.map((pm) => ({
      projectId: pm.project_id,
      projectRole: pm.project_role,
    })),
    isSynthetic,
  };

  return {
    principal,
    status: "AUTHENTICATED",
    email: user.email,
  };
}
