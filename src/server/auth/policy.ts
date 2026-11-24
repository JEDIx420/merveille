import { UserPrincipal, hasCapability, projectGrant } from "./principal";
export { hasCapability } from "./principal";
export type FinancialFieldSensitivity =
  | "CLIENT_COMMERCIAL"
  | "INTERNAL_EXPENSES"
  | "PAYROLL_AND_PROFIT";
export class AuthorizationError extends Error {
  constructor(
    message = "You do not have permission for this action.",
    public code = "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}
export function canAccessProject(
  p: UserPrincipal | null | undefined,
  id: string,
): boolean {
  return (
    !!p &&
    (hasCapability(p, "ADMIN") ||
      hasCapability(p, "OWNER") ||
      p.projectMemberships.some((m) => m.projectId === id))
  );
}
export function assertProjectAccess(
  p: UserPrincipal | null | undefined,
  id: string,
): void {
  if (!canAccessProject(p, id))
    throw new AuthorizationError(
      "You are not assigned to this project.",
      "CROSS_PROJECT_DENIED",
    );
}
export function canViewFinancials(
  p: UserPrincipal | null | undefined,
  id: string,
  sensitivity: FinancialFieldSensitivity,
): boolean {
  if (!p || !canAccessProject(p, id)) return false;
  if (sensitivity === "PAYROLL_AND_PROFIT") return hasCapability(p, "ADMIN");
  if (sensitivity === "INTERNAL_EXPENSES")
    return hasCapability(p, "ADMIN") || hasCapability(p, "MANAGER", id);
  return (
    hasCapability(p, "ADMIN") ||
    hasCapability(p, "OWNER") ||
    ["MANAGER", "CONSULTANT", "MAIN_CLIENT"].some((r) =>
      hasCapability(p, r as any, id),
    ) ||
    projectGrant(p, id)?.financeAccess === true
  );
}
export const canViewIndividualPerformance = (
  p: UserPrincipal | null | undefined,
) => hasCapability(p, "OWNER");
export const canViewPayrollAndProfit = (p: UserPrincipal | null | undefined) =>
  hasCapability(p, "ADMIN");
export const canManagePeopleAndAccess = (p: UserPrincipal | null | undefined) =>
  hasCapability(p, "ADMIN");
export function canAcceptContractualDecisions(
  p: UserPrincipal | null | undefined,
  id: string,
): boolean {
  return (
    !!p &&
    hasCapability(p, "MAIN_CLIENT", id) &&
    projectGrant(p, id)?.contractualAuthority === true
  );
}
export function canReadInternalNotes(
  p: UserPrincipal | null | undefined,
  id: string,
): boolean {
  return (
    !!p &&
    canAccessProject(p, id) &&
    (hasCapability(p, "ADMIN") ||
      hasCapability(p, "OWNER") ||
      hasCapability(p, "MANAGER", id) ||
      hasCapability(p, "TEAM_MEMBER", id))
  );
}
export const canPublishProjectUpdates = (
  p: UserPrincipal | null | undefined,
  id: string,
) => hasCapability(p, "MANAGER", id);
export const canManageCompanyAnnouncements = (
  p: UserPrincipal | null | undefined,
) => hasCapability(p, "ADMIN") || hasCapability(p, "MANAGER");
export function assertFinanceAuthor(
  p: UserPrincipal,
  id: string,
  issue = false,
) {
  assertProjectAccess(p, id);
  const grant = projectGrant(p, id);
  const eligible =
    hasCapability(p, "TEAM_MEMBER", id) || hasCapability(p, "MANAGER", id);
  if (
    !eligible ||
    !grant ||
    !(issue ? grant.invoiceIssue : grant.financeAuthor)
  )
    throw new AuthorizationError(
      "An explicit project finance grant is required.",
    );
}
/** Resource identifiers never bypass organisation scope, including global portfolio readers. */
export async function assertProjectOrganisation(
  db: D1Database,
  p: UserPrincipal,
  id: string,
) {
  const project = await db
    .prepare("SELECT org_id FROM projects WHERE id=?")
    .bind(id)
    .first<{ org_id: string }>();
  if (!project || project.org_id !== p.orgId)
    throw new AuthorizationError("Project not found.", "NOT_FOUND");
}
