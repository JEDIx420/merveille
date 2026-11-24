/**
 * User roles and principal contracts for Merveille Designs.
 * Synthetic auth is strictly confined to local development/test environments.
 */

export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "TEAM_MEMBER"
  | "STAFF"
  | "CONSULTANT"
  | "MAIN_CLIENT"
  | "CLIENT_REP";

export interface ProjectMembership {
  projectId: string;
  projectRole?: string;
}

export interface UserPrincipal {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  projectMemberships: ProjectMembership[];
  isSynthetic?: boolean;
}

/**
 * Standard test fixtures for local testing across distinct roles.
 */
export const SYNTHETIC_FIXTURES: Record<string, UserPrincipal> = {
  owner: {
    id: "usr_owner_001",
    email: "owner@merveilledesigns.com",
    name: "Architect & Practice Owner",
    role: "OWNER",
    orgId: "org_merveille_main",
    projectMemberships: [],
    isSynthetic: true,
  },
  admin: {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Operations & Finance Admin",
    role: "ADMIN",
    orgId: "org_merveille_main",
    projectMemberships: [],
    isSynthetic: true,
  },
  staff: {
    id: "usr_staff_001",
    email: "staff@merveilledesigns.com",
    name: "Design Team Architect",
    role: "STAFF",
    orgId: "org_merveille_main",
    projectMemberships: [],
    isSynthetic: true,
  },
  consultant: {
    id: "usr_consultant_001",
    email: "structural@engineering.example",
    name: "Structural Consultant",
    role: "CONSULTANT",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_villa_alappuzha" }],
    isSynthetic: true,
  },
  client: {
    id: "usr_client_001",
    email: "client@clientdomain.example",
    name: "Main Client",
    role: "MAIN_CLIENT",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_villa_alappuzha" }],
    isSynthetic: true,
  },
  rep: {
    id: "usr_rep_001",
    email: "rep@clientdomain.example",
    name: "Client Representative",
    role: "CLIENT_REP",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_villa_alappuzha" }],
    isSynthetic: true,
  },
};

/**
 * Resolve synthetic principal for local testing only.
 * Throws or returns null if attempted in staging or production.
 */
export function resolveSyntheticPrincipal(
  requestHeaders: Headers,
  requestCookies: { get: (name: string) => { value: string } | undefined },
  env: CloudflareEnv
): UserPrincipal | null {
  // Fail-closed guard: NEVER allow synthetic auth outside local development
  if (env.APP_ENV !== "local" && env.ALLOW_SYNTHETIC_AUTH !== "true") {
    return null;
  }

  const roleOrId =
    requestHeaders.get("x-merveille-synthetic-principal") ||
    requestCookies.get("merveille_synthetic_principal")?.value;

  if (!roleOrId) {
    return null;
  }

  const normalized = roleOrId.toLowerCase().trim();
  if (SYNTHETIC_FIXTURES[normalized]) {
    return SYNTHETIC_FIXTURES[normalized];
  }

  // Allow custom JSON payload for advanced test assertions
  try {
    const parsed = JSON.parse(roleOrId);
    if (parsed && typeof parsed === "object" && parsed.id && parsed.role) {
      return {
        ...parsed,
        isSynthetic: true,
      };
    }
  } catch {
    // Ignore non-json custom key
  }

  return null;
}
