"use client";
import { useSession } from "./session";
import { hasCapability } from "@/server/auth/principal";
import type { UserRole } from "@/server/auth/principal";
export function PermissionGate({
  children,
  projectId,
  roles,
  grant,
  contractual = false,
  paymentReport = false,
  assigneeId,
}: {
  children: React.ReactNode;
  projectId?: string | null;
  roles?: UserRole[];
  grant?: "financeAuthor" | "invoiceIssue";
  contractual?: boolean;
  paymentReport?: boolean;
  assigneeId?: string;
}) {
  const { principal } = useSession();
  if (!principal) return null;
  if (assigneeId !== undefined)
    return assigneeId === principal.id ? children : null;
  const project = principal.projectMemberships.find(
    (m) => m.projectId === projectId,
  );
  if (contractual)
    return project?.contractualAuthority &&
      hasCapability(principal, "MAIN_CLIENT", projectId || undefined)
      ? children
      : null;
  if (paymentReport)
    return hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "MANAGER", projectId || undefined) ||
      hasCapability(principal, "TEAM_MEMBER", projectId || undefined) ||
      hasCapability(principal, "MAIN_CLIENT", projectId || undefined) ||
      (hasCapability(principal, "CLIENT_REP", projectId || undefined) &&
        project?.financeAccess)
      ? children
      : null;
  if (grant)
    return project?.[grant] &&
      (hasCapability(principal, "MANAGER", projectId || undefined) ||
        hasCapability(principal, "TEAM_MEMBER", projectId || undefined))
      ? children
      : null;
  const allowed = roles?.some((role) =>
    hasCapability(principal, role, projectId || undefined),
  );
  return allowed ? children : null;
}
