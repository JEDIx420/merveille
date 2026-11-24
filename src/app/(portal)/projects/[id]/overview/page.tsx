"use client";

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
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load project");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    if (!confirm("Are you sure you want to activate this project baseline? Commercial gates will be verified.")) {
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
      const resData: any = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to activate project");
      setActionSuccess("Project successfully activated into active operations.");
      loadProject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStage(stage: Stage, newStatus: "IN_PROGRESS" | "COMPLETED") {
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
      const resData: any = await res.json();
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
      const resData: any = await res.json();
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
      const resData: any = await res.json();
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
      <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
        Loading project details and timeline...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: "2rem" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "0.5rem" }}>Access Denied or Not Found</h2>
        <p className="text-muted">{error}</p>
        <a href="/projects" className="btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
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
  const canActivate = project.status === "DRAFT" && quoteAccepted && advanceConfirmed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumb & Navigation */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/projects" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Projects
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>{project.code}</span>
      </nav>

      {/* Project Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "3px",
                backgroundColor: "rgba(197, 160, 89, 0.15)",
                color: "var(--merveille-gold)",
                letterSpacing: "0.05em",
              }}
            >
              {project.code}
            </span>
            <span
              className={`badge badge-${
                project.status === "ACTIVE"
                  ? "active"
                  : project.status === "PAUSED"
                  ? "paused"
                  : "draft"
              }`}
            >
              {project.status}
            </span>
            {project.is_archived === 1 && (
              <span className="badge badge-paused">ARCHIVED</span>
            )}
          </div>
          <h1 className="text-display">{project.name}</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            {project.site_location || "Site location not specified"}
          </p>
        </div>

        {/* Manager Actions Bar */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <a
            href={`/projects/${projectId}/documents`}
            className="btn-secondary"
            style={{ textDecoration: "none" }}
          >
            Documents & Media
          </a>

          {project.status === "DRAFT" && (
            <button
              onClick={handleActivate}
              disabled={submitting}
              className="btn-primary"
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
          )}

          {project.status === "ACTIVE" && (
            <button
              onClick={() => {
                setLifecycleReason("");
                setShowPauseModal(true);
              }}
              className="btn-secondary"
            >
              Pause Delivery
            </button>
          )}

          {project.status === "PAUSED" && (
            <button
              onClick={() => {
                setLifecycleReason("");
                setShowResumeModal(true);
              }}
              className="btn-primary"
            >
              Resume Delivery
            </button>
          )}
        </div>
      </header>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#86efac",
            fontSize: "0.875rem",
          }}
        >
          {actionSuccess}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#fca5a5",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Pause banner if paused */}
      {project.status === "PAUSED" && (
        <div
          className="card"
          style={{
            borderColor: "rgba(234, 179, 8, 0.3)",
            backgroundColor: "rgba(234, 179, 8, 0.05)",
            padding: "1rem 1.25rem",
          }}
        >
          <strong style={{ color: "#facc15", display: "block", marginBottom: "0.25rem" }}>
            Delivery Currently Paused
          </strong>
          <p style={{ fontSize: "0.875rem", color: "var(--merveille-foreground)" }}>
            Reason: {project.pause_reason || "Not specified"}
          </p>
        </div>
      )}

      {/* Commercial Activation Gate Card */}
      <div className="card">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
          Commercial Baseline & Activation Gates
        </h2>
        <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          Architectural delivery cannot proceed without an accepted quotation from the client and confirmed advance fee receipt (REQ-PRJ-002).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          <div
            style={{
              padding: "1rem",
              borderRadius: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: `1px solid ${quoteAccepted ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginBottom: "0.25rem" }}>
              Commercial Gate 1
            </div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#fff" }}>
              Accepted Quotation
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: quoteAccepted ? "#4ade80" : "#f87171" }}>
              {quoteAccepted
                ? `Accepted on ${formatBusinessDate(project.quote_accepted_at)}`
                : "Awaiting Client Acceptance"}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              borderRadius: "4px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: `1px solid ${advanceConfirmed ? "rgba(74, 222, 128, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginBottom: "0.25rem" }}>
              Commercial Gate 2
            </div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#fff" }}>
              Advance Receipt Confirmation
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: advanceConfirmed ? "#4ade80" : "#f87171" }}>
              {advanceConfirmed
                ? `Confirmed on ${formatBusinessDate(project.advance_confirmed_at)}`
                : "Awaiting Admin Confirmation"}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progression Timeline */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff" }}>
              Architectural Practice Stages
            </h2>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.2rem" }}>
              Ordered phases from schematic conception to site supervision and completion.
            </p>
          </div>
          <span className="text-muted" style={{ fontSize: "0.8125rem" }}>
            Current: <strong style={{ color: "var(--merveille-gold)" }}>{project.stage}</strong>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {stages.map((stg) => {
            const isCurrent = project.stage === stg.name;
            const isCompleted = stg.status === "COMPLETED";

            return (
              <div
                key={stg.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.875rem 1.25rem",
                  borderRadius: "6px",
                  backgroundColor: isCurrent
                    ? "rgba(197, 160, 89, 0.08)"
                    : "rgba(255, 255, 255, 0.02)",
                  border: isCurrent
                    ? "1px solid rgba(197, 160, 89, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: isCompleted
                        ? "rgba(74, 222, 128, 0.2)"
                        : isCurrent
                        ? "rgba(197, 160, 89, 0.2)"
                        : "rgba(255, 255, 255, 0.05)",
                      color: isCompleted ? "#4ade80" : isCurrent ? "var(--merveille-gold)" : "var(--merveille-muted)",
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                    }}
                  >
                    {isCompleted ? "✓" : stg.stage_order}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: isCurrent ? "var(--merveille-gold)" : "#fff" }}>
                      {stg.name}
                    </div>
                    {stg.actual_completion_date && (
                      <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
                        Completed: {stg.actual_completion_date}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    className={`badge badge-${
                      stg.status === "COMPLETED"
                        ? "active"
                        : stg.status === "IN_PROGRESS"
                        ? "paused"
                        : "draft"
                    }`}
                  >
                    {stg.status}
                  </span>

                  {/* Actions for Manager */}
                  {stg.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleUpdateStage(stg, "COMPLETED")}
                      disabled={submitting}
                      className="btn-secondary"
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Roster & Lifecycle Audit */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Project Team */}
        <div className="card">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "1rem" }}>
            Assigned Project Team
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#fff" }}>
                    {m.display_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
                    {m.email}
                  </div>
                </div>
                <span className="badge badge-draft" style={{ fontSize: "0.7rem" }}>
                  {m.project_role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lifecycle Events */}
        <div className="card">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "1rem" }}>
            Lifecycle & Stage Audit Log
          </h2>
          {events.length === 0 ? (
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>
              No lifecycle events recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "280px", overflowY: "auto" }}>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    borderLeft: "2px solid var(--merveille-gold)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <strong style={{ color: "#fff" }}>{ev.event_type}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
                      {formatBusinessDate(ev.created_at)}
                    </span>
                  </div>
                  {ev.reason && (
                    <div style={{ color: "var(--merveille-muted)", fontSize: "0.75rem" }}>
                      {ev.reason}
                    </div>
                  )}
                  {ev.actor_name && (
                    <div style={{ color: "var(--merveille-gold)", fontSize: "0.7rem", marginTop: "0.2rem" }}>
                      by {ev.actor_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pause Modal */}
      {showPauseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "480px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Pause Project Delivery
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Please provide the reason for pausing this project. All team members will be notified.
            </p>
            <form onSubmit={handlePauseSubmit}>
              <textarea
                required
                rows={3}
                placeholder="e.g. Awaiting statutory municipal review or client design revision..."
                value={lifecycleReason}
                onChange={(e) => setLifecycleReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "4px",
                  backgroundColor: "var(--merveille-charcoal)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowPauseModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Pausing..." : "Confirm Pause"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resume Modal */}
      {showResumeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "480px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Resume Project Delivery
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Confirm that the hold conditions have been resolved and active delivery is ready to resume.
            </p>
            <form onSubmit={handleResumeSubmit}>
              <textarea
                required
                rows={3}
                placeholder="e.g. Statutory approval received / Client approved updated layout..."
                value={lifecycleReason}
                onChange={(e) => setLifecycleReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "4px",
                  backgroundColor: "var(--merveille-charcoal)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowResumeModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Resuming..." : "Confirm Resume"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
