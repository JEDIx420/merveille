/** Server-resolved identity. Global capabilities and project grants remain independent. */
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
  roles?: UserRole[];
  financeAccess?: boolean;
  financeAuthor?: boolean;
  invoiceIssue?: boolean;
  contractualAuthority?: boolean;
}
export interface UserPrincipal {
  id: string;
  email: string;
  name: string;
  orgId: string;
  /** Legacy display field; authorization uses roles and project grants. */
  role: UserRole;
  roles?: UserRole[];
  projectMemberships: ProjectMembership[];
  intakeAccess?: boolean;
  authenticatedAt?: number;
  isSynthetic?: boolean;
}
export function hasCapability(
  p: UserPrincipal | null | undefined,
  role: UserRole,
  projectId?: string,
): boolean {
  if (!p) return false;
  const normalize = (v: string) => (v === "STAFF" ? "TEAM_MEMBER" : v);
  const expected = normalize(role);
  const globals = p.roles ?? [];
  if (expected === "ADMIN" || expected === "OWNER")
    return globals.some((v) => normalize(v) === expected);
  if (!projectId) return globals.some((v) => normalize(v) === expected);
  const grants = p.projectMemberships.filter((m) => m.projectId === projectId);
  return grants.some((m) =>
    (m.roles ?? (m.projectRole ? [m.projectRole] : [])).some(
      (v) => normalize(v) === expected,
    ),
  );
}
export function projectGrant(p: UserPrincipal, projectId: string) {
  return p.projectMemberships.find((m) => m.projectId === projectId);
}
