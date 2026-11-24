/**
 * Central authorization policy engine for Merveille Designs.
 * Strict deny-by-default capability and scope enforcement.
 */

import { UserPrincipal } from "./principal";

export type FinancialFieldSensitivity =
  | "CLIENT_COMMERCIAL" // Quotations, payment schedules, client invoices, payment history
  | "INTERNAL_EXPENSES" // Project and overhead expenses, consultant bills
  | "PAYROLL_AND_PROFIT"; // Salaries, payroll, firm profit totals

export class AuthorizationError extends Error {
  constructor(message = "Action denied by security policy", public code = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Check if principal has access to a specific project.
 * Restricts cross-project enumeration (AC-002).
 */
export function canAccessProject(
  principal: UserPrincipal | null | undefined,
  projectId: string
): boolean {
  if (!principal) return false;

  // Global operational roles have firm-wide project visibility
  if (principal.role === "ADMIN" || principal.role === "OWNER") {
    return true;
  }

  // Scoped roles require explicit active membership in the target project
  return principal.projectMemberships.some((pm) => pm.projectId === projectId);
}

/**
 * Enforce project access, throwing an AuthorizationError if denied.
 */
export function assertProjectAccess(
  principal: UserPrincipal | null | undefined,
  projectId: string
): void {
  if (!canAccessProject(principal, projectId)) {
    throw new AuthorizationError("Access denied: You are not assigned to this project.", "CROSS_PROJECT_DENIED");
  }
}

/**
 * Field-level and financial category visibility check (AC-003, AC-005).
 */
export function canViewFinancials(
  principal: UserPrincipal | null | undefined,
  projectId: string,
  sensitivity: FinancialFieldSensitivity
): boolean {
  if (!principal) return false;

  // First requirement: must have access to the project
  if (!canAccessProject(principal, projectId)) {
    return false;
  }

  switch (sensitivity) {
    case "CLIENT_COMMERCIAL":
      // Client quotation, schedule, invoices, and payments are visible to:
      // ADMIN, OWNER, assigned MANAGER, assigned STAFF,
      // assigned CONSULTANT (intentionally confirmed in requirements),
      // assigned MAIN_CLIENT, and assigned CLIENT_REP.
      return true;

    case "INTERNAL_EXPENSES":
      // Firm expenses, non-payroll project costs
      if (principal.role === "ADMIN" || principal.role === "OWNER") return true;
      if (principal.role === "MANAGER") return true;
      // Consultants, clients, and reps are strictly denied internal expenses
      return false;

    case "PAYROLL_AND_PROFIT":
      // Salaries, payroll evidence, and profit are ADMIN-ONLY.
      // An OWNER without ADMIN cannot view salaries or profit (AC-005).
      return principal.role === "ADMIN";

    default:
      return false;
  }
}

/**
 * Individual performance reports and scorecards (AC-005).
 * OWNER-ONLY: An ADMIN without OWNER cannot view individual performance.
 */
export function canViewIndividualPerformance(
  principal: UserPrincipal | null | undefined
): boolean {
  if (!principal) return false;
  return principal.role === "OWNER";
}

/**
 * Salaries and profit access (AC-005).
 * ADMIN-ONLY: An OWNER without ADMIN cannot view salaries or profit.
 */
export function canViewPayrollAndProfit(
  principal: UserPrincipal | null | undefined
): boolean {
  if (!principal) return false;
  return principal.role === "ADMIN";
}

/**
 * Contractual decision acceptance (AC-001, AC-004).
 * Quotations, change estimates, binding material selections.
 * ONLY MAIN_CLIENT with assigned decision authority on this project.
 * Representatives cannot submit contractual decisions.
 */
export function canAcceptContractualDecisions(
  principal: UserPrincipal | null | undefined,
  projectId: string
): boolean {
  if (!principal) return false;

  // Representatives are strictly forbidden from contractual acceptance (AC-004)
  if (principal.role === "CLIENT_REP") return false;

  // Staff and consultants cannot substitute for the main client
  if (principal.role !== "MAIN_CLIENT") return false;

  // Must have project membership
  return principal.projectMemberships.some((pm) => pm.projectId === projectId);
}

/**
 * People and access management (SCR-18, AC-007).
 * ADMIN-ONLY: Only administrators can invite, assign, revoke or disable accounts.
 */
export function canManagePeopleAndAccess(
  principal: UserPrincipal | null | undefined
): boolean {
  if (!principal) return false;
  return principal.role === "ADMIN";
}

/**
 * Internal project comments and discussions (AC-003).
 * Client and consultant access is denied; internal discussions remain internal.
 */
export function canReadInternalNotes(
  principal: UserPrincipal | null | undefined,
  projectId: string
): boolean {
  if (!principal) return false;
  if (!canAccessProject(principal, projectId)) return false;

  // Consultants, clients, and representatives cannot read internal discussions
  if (
    principal.role === "CONSULTANT" ||
    principal.role === "MAIN_CLIENT" ||
    principal.role === "CLIENT_REP"
  ) {
    return false;
  }

  return true;
}

/**
 * Project update and announcement publication permission.
 * Managers/Admins/Owners only.
 */
export function canPublishProjectUpdates(
  principal: UserPrincipal | null | undefined,
  projectId: string
): boolean {
  if (!principal) return false;
  if (!canAccessProject(principal, projectId)) return false;
  return (
    principal.role === "MANAGER" ||
    principal.role === "ADMIN" ||
    principal.role === "OWNER"
  );
}

/**
 * Company announcement management permission.
 * Managers/Admins/Owners only.
 */
export function canManageCompanyAnnouncements(
  principal: UserPrincipal | null | undefined
): boolean {
  if (!principal) return false;
  return (
    principal.role === "MANAGER" ||
    principal.role === "ADMIN" ||
    principal.role === "OWNER"
  );
}

