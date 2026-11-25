"use client";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import layout from "./internal-project-overview.module.css";
import { useFeedback } from "@/components/ui";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface Stage {
  id: string;
  project_id: string;
  stage_order: number;
  name: string;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  actual_completion_date: string | null;
  completed_by_user_id: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  revision: number;
}

interface Member {
  id: string;
  user_id: string;
  project_role: string;
  display_name: string;
  email: string;
  assigned_at: number;
}

interface EventLog {
  id: string;
  event_type: string;
  old_state: string | null;
  new_state: string | null;
  reason: string | null;
  created_at: number;
  actor_name: string | null;
}

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const feedback = useFeedback();
  const { id: projectId } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modals / forms
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to load project");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    if (
      !(await feedback.confirm(
        "Are you sure you want to activate this project baseline? Commercial gates will be verified.",
      ))
    ) {
      return;
    }
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACTIVATE" }),
      });
      const resData: any = await readResponse(res);
      if (!res.ok)
        throw new Error(resData.error || "Failed to activate project");
      setActionSuccess(
        "Project successfully activated into active operations.",
      );
      loadProject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStage(
    stage: Stage,
    newStatus: "IN_PROGRESS" | "COMPLETED",
  ) {
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_STAGE",
          stageId: stage.id,
          status: newStatus,
          expectedRevision: stage.revision,
          actualCompletionDate: new Date().toISOString().split("T")[0],
        }),
      });
      const resData: any = await readResponse(res);
      if (!res.ok) throw new Error(resData.error || "Failed to advance stage");
      setActionSuccess(`Stage '${stage.name}' updated to ${newStatus}.`);
      loadProject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePauseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PAUSE", reason: lifecycleReason }),
      });
      const resData: any = await readResponse(res);
      if (!res.ok) throw new Error(resData.error || "Failed to pause project");
      setShowPauseModal(false);
      setLifecycleReason("");
      setActionSuccess("Project delivery paused.");
      loadProject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResumeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESUME", reason: lifecycleReason }),
      });
      const resData: any = await readResponse(res);
      if (!res.ok) throw new Error(resData.error || "Failed to resume project");
      setShowResumeModal(false);
      setLifecycleReason("");
      setActionSuccess("Project delivery resumed.");
      loadProject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={cx(["card text-muted", layout.block1].join(" "))}>
        Loading project details and timeline...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={cx(["card", layout.block2].join(" "))}>
        <h2 className={cx(layout.block3)}>Access Denied or Not Found</h2>
        <p className={cx("text-muted")}>{error}</p>
        <a
          href="/projects"
          className={cx(["btn-secondary", layout.block4].join(" "))}
        >
          Back to Projects
        </a>
      </div>
    );
  }

  const project = data.project;
  const stages: Stage[] = data.stages || [];
  const members: Member[] = data.members || [];
  const events: EventLog[] = data.events || [];

  const quoteAccepted = !!project.quote_accepted_at;
  const advanceConfirmed = !!project.advance_confirmed_at;
  const canActivate =
    project.status === "DRAFT" && quoteAccepted && advanceConfirmed;

  return (
    <div className={cx(layout.block5)}>
      {/* Breadcrumb & Navigation */}
      <nav className={cx(layout.block6)}>
        <a href="/projects" className={cx(layout.block7)}>
          Projects
        </a>
        <span>/</span>
        <span className={cx(layout.block8)}>{project.code}</span>
      </nav>

      {data.onboarding && <section className={cx("card")}><h2>Existing project setup</h2><p>Review the original handover and complete the commercial checks before manager activation.</p><Link href={`/projects/${projectId}/onboarding`}>View onboarding checklist and original records</Link></section>}
      {/* Project Header */}
      <header className={cx(layout.block9)}>
        <div>
          <div className={cx(layout.block10)}>
            <span className={cx(layout.block11)}>{project.code}</span>
            <span
              className={cx(
                `badge badge-${
                  project.status === "ACTIVE"
                    ? "active"
                    : project.status === "PAUSED"
                      ? "paused"
                      : "draft"
                }`,
              )}
            >
              {project.status}
            </span>
            {project.is_archived === 1 && (
              <span className={cx("badge badge-paused")}>ARCHIVED</span>
            )}
          </div>
          <h1 className={cx("text-display")}>{project.name}</h1>
          <p className={cx(["text-muted", layout.block12].join(" "))}>
            {project.site_location || "Site location not specified"}
          </p>
        </div>

        {/* Manager Actions Bar */}
        <div className={cx(layout.block13)}>
          <a
            href={`/projects/${projectId}/finance`}
            className={cx(["btn-secondary", layout.block14].join(" "))}
          >
            Finance & Invoicing
          </a>
          <a
            href={`/projects/${projectId}/updates`}
            className={cx(["btn-secondary", layout.block15].join(" "))}
          >
            Updates
          </a>
          <a
            href={`/projects/${projectId}/permits`}
            className={cx(["btn-secondary", layout.block16].join(" "))}
          >
            Permits & K-SMART
          </a>
          <a
            href={`/projects/${projectId}/drawings`}
            className={cx(["btn-secondary", layout.block17].join(" "))}
          >
            Drawings
          </a>
          <a
            href={`/projects/${projectId}/tasks`}
            className={cx(["btn-secondary", layout.block18].join(" "))}
          >
            Tasks
          </a>
          <a
            href={`/projects/${projectId}/documents`}
            className={cx(["btn-secondary", layout.block19].join(" "))}
          >
            Documents & Media
          </a>

          {project.status === "DRAFT" && (
            <PermissionGate projectId={projectId} roles={["MANAGER"]}>
              <button
                onClick={handleActivate}
                disabled={submitting}
                className={cx("btn-primary")}
                style={{
                  opacity: canActivate ? 1 : 0.6,
                  cursor: canActivate ? "pointer" : "not-allowed",
                }}
                title={
                  canActivate
                    ? "Activate project into full production"
                    : "Both quotation acceptance and advance receipt required before activation"
                }
              >
                Activate Project Baseline
              </button>
            </PermissionGate>
          )}

          {project.status === "ACTIVE" && (
            <PermissionGate projectId={projectId} roles={["MANAGER"]}>
              <button
                onClick={() => {
                  setLifecycleReason("");
                  setShowPauseModal(true);
                }}
                className={cx("btn-secondary")}
              >
                Pause Delivery
              </button>
            </PermissionGate>
          )}

          {project.status === "PAUSED" && (
            <PermissionGate projectId={projectId} roles={["MANAGER"]}>
              <button
                onClick={() => {
                  setLifecycleReason("");
                  setShowResumeModal(true);
                }}
                className={cx("btn-primary")}
              >
                Resume Delivery
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className={cx(layout.block20)}>{actionSuccess}</div>
      )}

      {error && <div className={cx(layout.block21)}>{error}</div>}

      {/* Pause banner if paused */}
      {project.status === "PAUSED" && (
        <div className={cx(["card", layout.block22].join(" "))}>
          <strong className={cx(layout.block23)}>
            Delivery Currently Paused
          </strong>
          <p className={cx(layout.block24)}>
            Reason: {project.pause_reason || "Not specified"}
          </p>
        </div>
      )}

      {/* Commercial Activation Gate Card */}
      <div className={cx("card")}>
        <h2 className={cx(layout.block25)}>
          Commercial Baseline & Activation Gates
        </h2>
        <p className={cx(["text-muted", layout.block26].join(" "))}>
          Architectural delivery cannot proceed without an accepted quotation
          from the client and confirmed advance fee receipt ().
        </p>

        <div className={cx(layout.block27)}>
          <div
            style={{
              border: `1px solid ${quoteAccepted ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
            }}
            className={cx(layout.block28)}
          >
            <div className={cx(layout.block29)}>Commercial Gate 1</div>
            <div className={cx(layout.block30)}>Accepted Quotation</div>
            <div
              style={{
                color: quoteAccepted ? "var(--ui-success)" : "var(--ui-danger)",
              }}
              className={cx(layout.block31)}
            >
              {quoteAccepted
                ? `Accepted on ${formatBusinessDate(project.quote_accepted_at)}`
                : "Awaiting Client Acceptance"}
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${advanceConfirmed ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
            }}
            className={cx(layout.block32)}
          >
            <div className={cx(layout.block33)}>Commercial Gate 2</div>
            <div className={cx(layout.block34)}>
              Advance Receipt Confirmation
            </div>
            <div
              style={{
                color: advanceConfirmed
                  ? "var(--ui-success)"
                  : "var(--ui-danger)",
              }}
              className={cx(layout.block35)}
            >
              {advanceConfirmed
                ? `Confirmed on ${formatBusinessDate(project.advance_confirmed_at)}`
                : "Awaiting Admin Confirmation"}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progression Timeline */}
      <div className={cx("card")}>
        <div className={cx(layout.block36)}>
          <div>
            <h2 className={cx(layout.block37)}>
              Architectural Practice Stages
            </h2>
            <p className={cx(["text-muted", layout.block38].join(" "))}>
              Ordered phases from schematic conception to site supervision and
              completion.
            </p>
          </div>
          <span className={cx(["text-muted", layout.block39].join(" "))}>
            Current:{" "}
            <strong className={cx(layout.block40)}>{project.stage}</strong>
          </span>
        </div>

        <div className={cx(layout.block41)}>
          {stages.map((stg) => {
            const isCurrent = project.stage === stg.name;
            const isCompleted = stg.status === "COMPLETED";

            return (
              <div
                key={stg.id}
                style={{
                  backgroundColor: isCurrent
                    ? "var(--ui-surface-subtle)"
                    : "var(--ui-divider)",
                  border: isCurrent
                    ? "1px solid var(--ui-surface-subtle)"
                    : "1px solid var(--ui-divider)",
                }}
                className={cx(layout.block42)}
              >
                <div className={cx(layout.block43)}>
                  <span
                    style={{
                      backgroundColor: isCompleted
                        ? "rgba(74, 222, 128, 0.2)"
                        : isCurrent
                          ? "var(--ui-surface-subtle)"
                          : "var(--ui-divider)",
                      color: isCompleted
                        ? "var(--ui-success)"
                        : isCurrent
                          ? "var(--ui-action)"
                          : "var(--ui-text-muted)",
                    }}
                    className={cx(layout.block44)}
                  >
                    {isCompleted ? "✓" : stg.stage_order}
                  </span>
                  <div>
                    <div
                      style={{
                        color: isCurrent
                          ? "var(--ui-action)"
                          : "var(--ui-text)",
                      }}
                      className={cx(layout.block45)}
                    >
                      {stg.name}
                    </div>
                    {stg.actual_completion_date && (
                      <div className={cx(layout.block46)}>
                        Completed: {stg.actual_completion_date}
                      </div>
                    )}
                  </div>
                </div>

                <div className={cx(layout.block47)}>
                  <span
                    className={cx(
                      `badge badge-${
                        stg.status === "COMPLETED"
                          ? "active"
                          : stg.status === "IN_PROGRESS"
                            ? "paused"
                            : "draft"
                      }`,
                    )}
                  >
                    {stg.status}
                  </span>

                  {/* Actions for Manager */}
                  {stg.status !== "COMPLETED" && (
                    <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                      <button
                        onClick={() => handleUpdateStage(stg, "COMPLETED")}
                        disabled={submitting}
                        className={cx(
                          ["btn-secondary", layout.block48].join(" "),
                        )}
                      >
                        Mark Completed
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Roster & Lifecycle Audit */}
      <div className={cx(layout.block49)}>
        {/* Project Team */}
        <div className={cx("card")}>
          <h2 className={cx(layout.block50)}>Assigned Project Team</h2>
          <div className={cx(layout.block51)}>
            {members.map((m) => (
              <div key={m.id} className={cx(layout.block52)}>
                <div>
                  <div className={cx(layout.block53)}>{m.display_name}</div>
                  <div className={cx(layout.block54)}>{m.email}</div>
                </div>
                <span
                  className={cx(
                    ["badge badge-draft", layout.block55].join(" "),
                  )}
                >
                  {m.project_role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lifecycle Events */}
        <div className={cx("card")}>
          <h2 className={cx(layout.block56)}>Lifecycle & Stage Audit Log</h2>
          {events.length === 0 ? (
            <p className={cx(["text-muted", layout.block57].join(" "))}>
              No lifecycle events recorded yet.
            </p>
          ) : (
            <div className={cx(layout.block58)}>
              {events.map((ev) => (
                <div key={ev.id} className={cx(layout.block59)}>
                  <div className={cx(layout.block60)}>
                    <strong className={cx(layout.block61)}>
                      {ev.event_type}
                    </strong>
                    <span className={cx(layout.block62)}>
                      {formatBusinessDate(ev.created_at)}
                    </span>
                  </div>
                  {ev.reason && (
                    <div className={cx(layout.block63)}>{ev.reason}</div>
                  )}
                  {ev.actor_name && (
                    <div className={cx(layout.block64)}>by {ev.actor_name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pause Modal */}
      {showPauseModal && (
        <Dialog
          title="Pause Project Delivery"
          onClose={() => setShowPauseModal(false)}
        >
          <div className={cx(["card", layout.block66].join(" "))}>
            <h3 className={cx(layout.block67)}>Pause Project Delivery</h3>
            <p className={cx(["text-muted", layout.block68].join(" "))}>
              Please provide the reason for pausing this project. All team
              members will be notified.
            </p>
            <form onSubmit={handlePauseSubmit}>
              <textarea
                required
                rows={3}
                placeholder="e.g. Awaiting statutory municipal review or client design revision..."
                value={lifecycleReason}
                onChange={(e) => setLifecycleReason(e.target.value)}
                className={cx(layout.block69)}
              />
              <div className={cx(layout.block70)}>
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowPauseModal(false)}
                    className={cx("btn-secondary")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Pausing..." : "Confirm Pause"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Resume Modal */}
      {showResumeModal && (
        <Dialog
          title="Resume Project Delivery"
          onClose={() => setShowResumeModal(false)}
        >
          <div className={cx(["card", layout.block72].join(" "))}>
            <h3 className={cx(layout.block73)}>Resume Project Delivery</h3>
            <p className={cx(["text-muted", layout.block74].join(" "))}>
              Confirm that the hold conditions have been resolved and active
              delivery is ready to resume.
            </p>
            <form onSubmit={handleResumeSubmit}>
              <textarea
                required
                rows={3}
                placeholder="e.g. Statutory approval received / Client approved updated layout..."
                value={lifecycleReason}
                onChange={(e) => setLifecycleReason(e.target.value)}
                className={cx(layout.block75)}
              />
              <div className={cx(layout.block76)}>
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowResumeModal(false)}
                    className={cx("btn-secondary")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Resuming..." : "Confirm Resume"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
