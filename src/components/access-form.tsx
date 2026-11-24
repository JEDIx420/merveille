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
}: {
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
        <legend>Organisation capabilities</legend>
        <p className={ui.meta}>
          These capabilities are independent. Administrator access does not
          include manager approvals or owner performance.
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
      <fieldset>
        <legend>Project assignments</legend>
        <p className={ui.meta}>
          No project access is granted by default. Select each project and its
          specific permissions.
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
                              roles: [],
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
                    ].map(([role, label]) => (
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
          <p>No projects available. Project access can be assigned later.</p>
        )}
      </fieldset>
      {roles.some((r) => ["ADMIN", "OWNER"].includes(r)) && (
        <label className={ui.checkbox}>
          <input
            type="checkbox"
            checked={confirm}
            required
            onChange={(e) => setConfirm(e.target.checked)}
          />
          I confirm this elevated access is intentional. A recent Google sign-in
          is required.
        </label>
      )}
    </>
  );
}
