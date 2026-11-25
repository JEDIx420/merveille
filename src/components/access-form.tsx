"use client";
import { Field, ui } from "./ui";
export interface AccessProject {
  projectId: string;
  roles: string[];
  financeAccess: boolean;
  financeAuthor: boolean;
  invoiceIssue: boolean;
  contractualAuthority: boolean;
}
export function AccessGrants({
  roles,
  setRoles,
  projects,
  setProjects,
  options,
  confirm,
  setConfirm,
  defaultProjectRole,
  employeeOnly = false,
}: {
  employeeOnly?: boolean;
  defaultProjectRole?: "TEAM_MEMBER" | "MANAGER";
  roles: string[];
  setRoles: (v: string[]) => void;
  projects: AccessProject[];
  setProjects: (v: AccessProject[]) => void;
  options: { id: string; name: string }[];
  confirm: boolean;
  setConfirm: (v: boolean) => void;
}) {
  function update(projectId: string, patch: any) {
    if (
      patch.roles &&
      !patch.roles.some((r: string) => ["TEAM_MEMBER", "MANAGER"].includes(r))
    ) {
      patch.financeAuthor = false;
      patch.invoiceIssue = false;
    }
    setProjects(
      projects.map((p) => (p.projectId === projectId ? { ...p, ...patch } : p)),
    );
  }
  return (
    <>
      <fieldset>
        <legend>Project assignments</legend>
        <p className={ui.meta}>
          No project access is granted by default. Select each project and its
          specific permissions. Team members see internal project work; consultants see assigned review work and client commercial history; clients see released and published records.
        </p>
        {options.map((option) => {
          const grant = projects.find((p) => p.projectId === option.id);
          return (
            <div className="access-project" key={option.id}>
              <label className={ui.checkbox}>
                <input
                  type="checkbox"
                  checked={!!grant}
                  onChange={(e) =>
                    setProjects(
                      e.target.checked
                        ? [
                            ...projects,
                            {
                              projectId: option.id,
                              roles: defaultProjectRole ? [defaultProjectRole] : [],
                              financeAccess: false,
                              financeAuthor: false,
                              invoiceIssue: false,
                              contractualAuthority: false,
                            },
                          ]
                        : projects.filter((p) => p.projectId !== option.id),
                    )
                  }
                />
                <strong>{option.name}</strong>
              </label>
              {grant && (
                <div className="access-project-grants">
                  <fieldset>
                    <legend>Project roles</legend>
                    {[
                      ["MANAGER", "Project manager"],
                      ["TEAM_MEMBER", "Team member"],
                      ["CONSULTANT", "Consultant"],
                      ["MAIN_CLIENT", "Main client"],
                      ["CLIENT_REP", "Client representative"],
                    ].filter(([role]) => !employeeOnly || ["MANAGER","TEAM_MEMBER"].includes(role)).map(([role, label]) => (
                      <label className={ui.checkbox} key={role}>
                        <input
                          type="checkbox"
                          checked={grant.roles.includes(role)}
                          onChange={(e) =>
                            update(option.id, {
                              roles: e.target.checked
                                ? [...grant.roles, role]
                                : grant.roles.filter((r) => r !== role),
                              contractualAuthority:
                                role === "MAIN_CLIENT" && !e.target.checked
                                  ? false
                                  : grant.contractualAuthority,
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {(
                    ["financeAccess", "financeAuthor", "invoiceIssue"] as const
                  ).map((key, i) =>
                    key !== "financeAccess" &&
                    !grant.roles.some((r) =>
                      ["TEAM_MEMBER", "MANAGER"].includes(r),
                    ) ? null : (
                      <label key={key} className={ui.checkbox}>
                        <input
                          type="checkbox"
                          checked={grant[key]}
                          onChange={(e) =>
                            update(option.id, { [key]: e.target.checked })
                          }
                        />
                        {
                          [
                            "Read client quotation and payment history",
                            "Prepare quotations and invoices",
                            "Issue manager-approved invoices",
                          ][i]
                        }
                      </label>
                    ),
                  )}
                  {grant.roles.includes("MAIN_CLIENT") && (
                    <label className={ui.checkbox}>
                      <input
                        type="checkbox"
                        checked={grant.contractualAuthority}
                        onChange={(e) =>
                          update(option.id, {
                            contractualAuthority: e.target.checked,
                          })
                        }
                      />
                      Designate as the contractual decision contact
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!options.length && (
          <p>No projects yet. You can add this employee now, then assign Team member or Project manager access after creating a project.</p>
        )}
      </fieldset>
      <fieldset>
        <legend>Organisation-wide access (optional)</legend>
        <p className={ui.meta}>
          Employees usually need only project assignments below. Administrator includes payroll and profit; Owner includes individual performance. Neither grants project manager approval authority.
        </p>
        {["ADMIN", "OWNER", "TEAM_MEMBER", "MANAGER"].map((role) => (
          <label className={ui.checkbox} key={role}>
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={(e) =>
                setRoles(
                  e.target.checked
                    ? [...roles, role]
                    : roles.filter((r) => r !== role),
                )
              }
            />
            {
              (
                {
                  ADMIN: "Administrator — people, receipts, payroll and profit",
                  OWNER: "Owner — individual performance reporting",
                  TEAM_MEMBER: "Enquiry intake",
                  MANAGER: "Company announcement publishing and enquiry intake",
                } as Record<string, string>
              )[role]
            }
          </label>
        ))}
      </fieldset>
      {roles.some((r) => ["ADMIN", "OWNER"].includes(r)) && (
        <label className={ui.checkbox}>
          <input
            type="checkbox"
            checked={confirm}
            required
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I confirm this elevated access is intentional. A recent sign-in
          is required.
        </label>
      )}
    </>
  );
}
