"use client";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface DrawingItem {
  id: string;
  project_id: string;
  drawing_number: string;
  title: string;
  discipline: string;
  current_released_version_id: string | null;
  current_version_label: string | null;
  current_version_status: string | null;
  released_at: number | null;
  is_withdrawn: number;
  withdrawal_reason: string | null;
  file_name: string | null;
  size_bytes: number | null;
}

const DISCIPLINES = ["ALL", "ARCHITECTURAL", "STRUCTURAL", "MEP", "LANDSCAPE", "INTERIOR", "CIVIL"];

export default function ProjectDrawingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [discipline, setDiscipline] = useState("ALL");

  // New Drawing Modal
  const [showNewDrawingModal, setShowNewDrawingModal] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDiscipline, setNewDiscipline] = useState<string>("ARCHITECTURAL");

  // Expanded Drawing Detail / Version History
  const [expandedDrawingId, setExpandedDrawingId] = useState<string | null>(null);
  const [drawingDetail, setDrawingDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New Version Modal
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [targetDrawingId, setTargetDrawingId] = useState("");
  const [newVersionLabel, setNewVersionLabel] = useState("V1");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [selectedConsultantIds, setSelectedConsultantIds] = useState<string[]>([]);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [projectConsultants, setProjectConsultants] = useState<any[]>([]);

  // Consultant Review Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [targetVersionId, setTargetVersionId] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "CHANGES_REQUESTED" | "REJECTED">("APPROVED");
  const [reviewReason, setReviewReason] = useState("");

  // Withdraw Modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDrawings();
    loadFilesAndTeam();
  }, [projectId, discipline]);

  async function loadDrawings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/drawings?discipline=${discipline}`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load drawings");
      setDrawings(json.drawings || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFilesAndTeam() {
    try {
      const [filesRes, peopleRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/files`),
        fetch("/api/people"),
      ]);
      const filesJson: any = await filesRes.json();
      const peopleJson: any = await peopleRes.json();
      if (filesRes.ok) setProjectFiles(filesJson.files || []);
      if (peopleRes.ok) {
        const consultants = (peopleJson.people || []).filter((p: any) =>
          p.roles?.includes("CONSULTANT")
        );
        setProjectConsultants(consultants);
      }
    } catch {
      // Ignore
    }
  }

  async function loadDrawingDetail(drawingId: string) {
    if (expandedDrawingId === drawingId) {
      setExpandedDrawingId(null);
      setDrawingDetail(null);
      return;
    }

    setExpandedDrawingId(drawingId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/drawings/${drawingId}`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load drawing versions");
      setDrawingDetail(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateDrawing(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/projects/${projectId}/drawings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawingNumber: newNumber,
          title: newTitle,
          discipline: newDiscipline,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create drawing sheet");

      setActionSuccess(`Drawing sheet ${newNumber} created in register.`);
      setShowNewDrawingModal(false);
      setNewNumber("");
      setNewTitle("");
      loadDrawings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateVersionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/drawings/${targetDrawingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_VERSION",
          versionLabel: newVersionLabel,
          fileId: selectedFileId,
          submissionNote,
          requiredConsultantIds: selectedConsultantIds,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create version");

      setActionSuccess(`Version ${newVersionLabel} created in DRAFT.`);
      setShowNewVersionModal(false);
      loadDrawings();
      if (expandedDrawingId === targetDrawingId) loadDrawingDetail(targetDrawingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitForReview(versionId: string) {
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/drawings/versions/${versionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_REVIEW" }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit for review");

      setActionSuccess("Version submitted for required consultant review.");
      if (expandedDrawingId) loadDrawingDetail(expandedDrawingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConsultantDecision(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/drawings/versions/${targetVersionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONSULTANT_DECISION",
          decision: reviewDecision,
          reason: reviewReason,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit consultant decision");

      setActionSuccess(`Consultant decision '${reviewDecision}' recorded.`);
      setShowReviewModal(false);
      setReviewReason("");
      if (expandedDrawingId) loadDrawingDetail(expandedDrawingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManagerRelease(versionId: string, currentVersionId: string | null) {
    if (!confirm("Are you sure you want to finally release this drawing to active operations and clients?")) {
      return;
    }

    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/drawings/versions/${versionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RELEASE",
          expectedCurrentVersionId: currentVersionId,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to release drawing");

      setActionSuccess("Drawing successfully released. Prior released versions marked as Superseded.");
      loadDrawings();
      if (expandedDrawingId) loadDrawingDetail(expandedDrawingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedDrawingId) return;

    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/drawings/${expandedDrawingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW", reason: withdrawReason }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to withdraw drawing");

      setActionSuccess("Drawing withdrawn. No current released version active.");
      setShowWithdrawModal(false);
      setWithdrawReason("");
      loadDrawings();
      loadDrawingDetail(expandedDrawingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/projects" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Projects
        </a>
        <span>/</span>
        <a href={`/projects/${projectId}/overview`} style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Overview
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>Drawing Register</span>
      </nav>

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">Drawing Register & Revision History</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Controlled architectural and engineering drawings, version-specific approvals, and manager releases.
          </p>
        </div>
        <button onClick={() => setShowNewDrawingModal(true)} className="btn-primary">
          + Add Drawing Sheet
        </button>
      </header>

      {/* Confirmed Authority Notice (AC-017) */}
      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--merveille-gold)",
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          backgroundColor: "rgba(197, 160, 89, 0.05)",
        }}
      >
        <strong style={{ color: "var(--merveille-gold)", display: "block", marginBottom: "0.25rem" }}>
          Drawing Authority & Approval Gate
        </strong>
        <p style={{ color: "var(--merveille-foreground)", margin: 0, lineHeight: 1.5 }}>
          Team prepares drawing versions → required designated consultants approve → <strong>project manager finally releases</strong>.
          There is no client drawing approval gate (AC-017). Clients receive unambiguous current released drawings.
        </p>
      </div>

      {/* Alerts */}
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

      {/* Discipline Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.5rem", overflowX: "auto" }}>
        {DISCIPLINES.map((d) => (
          <button
            key={d}
            onClick={() => setDiscipline(d)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "4px",
              backgroundColor: discipline === d ? "rgba(197, 160, 89, 0.2)" : "transparent",
              color: discipline === d ? "var(--merveille-gold)" : "var(--merveille-muted)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {d === "ALL" ? "All Disciplines" : d}
          </button>
        ))}
      </div>

      {/* Drawings Register Table */}
      {loading ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          Loading drawing register...
        </div>
      ) : drawings.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          No drawing sheets registered for this discipline.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {drawings.map((drw) => {
            const isExpanded = expandedDrawingId === drw.id;
            const hasRelease = drw.current_released_version_id && !drw.is_withdrawn;

            return (
              <div
                key={drw.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "1.25rem",
                  borderLeft: drw.is_withdrawn
                    ? "3px solid #ef4444"
                    : hasRelease
                    ? "3px solid #4ade80"
                    : "3px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8125rem",
                          padding: "0.2rem 0.4rem",
                          borderRadius: "3px",
                          backgroundColor: "rgba(197, 160, 89, 0.15)",
                          color: "var(--merveille-gold)",
                          letterSpacing: "0.05em",
                          fontWeight: 600,
                        }}
                      >
                        {drw.drawing_number}
                      </span>
                      <span className="badge badge-draft" style={{ fontSize: "0.7rem" }}>
                        {drw.discipline}
                      </span>
                      {drw.is_withdrawn === 1 && (
                        <span className="badge badge-paused" style={{ fontSize: "0.7rem" }}>
                          WITHDRAWN
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.25rem" }}>
                      {drw.title}
                    </h3>

                    <div style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
                      {hasRelease ? (
                        <span>
                          Current Approved Release: <strong style={{ color: "#4ade80" }}>{drw.current_version_label}</strong>{" "}
                          (Released {drw.released_at ? formatBusinessDate(drw.released_at) : "Recently"})
                        </span>
                      ) : drw.is_withdrawn === 1 ? (
                        <span style={{ color: "#f87171" }}>
                          Withdrawn: {drw.withdrawal_reason || "No current released version"}
                        </span>
                      ) : (
                        <span>No current released version (In preparation / review)</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                      onClick={() => loadDrawingDetail(drw.id)}
                      className="btn-secondary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                    >
                      {isExpanded ? "Hide Revision History" : "View Versions & Approvals"}
                    </button>

                    <button
                      onClick={() => {
                        setTargetDrawingId(drw.id);
                        setNewVersionLabel(hasRelease ? `V${parseInt(drw.current_version_label?.replace("V", "") || "1", 10) + 1}` : "V1");
                        setShowNewVersionModal(true);
                      }}
                      className="btn-primary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                    >
                      + New Version
                    </button>
                  </div>
                </div>

                {/* Expanded Version History Drawer */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                      marginTop: "1rem",
                      paddingTop: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {loadingDetail ? (
                      <p className="text-muted" style={{ fontSize: "0.875rem" }}>
                        Loading version history...
                      </p>
                    ) : !drawingDetail ? (
                      <p className="text-muted" style={{ fontSize: "0.875rem" }}>
                        Could not retrieve versions.
                      </p>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--merveille-gold)" }}>
                            Version History & Review Log
                          </h4>
                          {hasRelease && (
                            <button
                              onClick={() => setShowWithdrawModal(true)}
                              className="btn-secondary"
                              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", color: "#f87171" }}
                            >
                              Withdraw Current Release
                            </button>
                          )}
                        </div>

                        {drawingDetail.versions.length === 0 ? (
                          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
                            No versions uploaded yet. Click '+ New Version' to submit V1.
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {drawingDetail.versions.map((ver: any) => {
                              const isSuperseded = ver.status === "SUPERSEDED";
                              const isReleased = ver.status === "RELEASED";
                              const canRelease = ver.status === "CONSULTANT_APPROVED";

                              return (
                                <div
                                  key={ver.id}
                                  style={{
                                    padding: "0.875rem 1rem",
                                    borderRadius: "4px",
                                    backgroundColor: isReleased
                                      ? "rgba(74, 222, 128, 0.05)"
                                      : isSuperseded
                                      ? "rgba(255, 255, 255, 0.02)"
                                      : "rgba(255, 255, 255, 0.04)",
                                    border: isReleased
                                      ? "1px solid rgba(74, 222, 128, 0.3)"
                                      : "1px solid rgba(255, 255, 255, 0.08)",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontWeight: 700, color: "#fff", fontSize: "1rem" }}>
                                          {ver.version_label}
                                        </span>

                                        <span
                                          className={`badge badge-${
                                            isReleased
                                              ? "active"
                                              : isSuperseded
                                              ? "paused"
                                              : "draft"
                                          }`}
                                        >
                                          {ver.status}
                                        </span>

                                        {isSuperseded && (
                                          <span style={{ fontSize: "0.75rem", color: "#facc15" }}>
                                            Superseded — do not use as the current version
                                          </span>
                                        )}
                                      </div>

                                      <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.35rem" }}>
                                        Uploaded {formatBusinessDate(ver.created_at)} by {ver.author_name}
                                        {ver.submission_note && ` • Note: ${ver.submission_note}`}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                      {ver.file_id && (
                                        <a
                                          href={`/api/files/${ver.file_id}/download`}
                                          className="btn-secondary"
                                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", textDecoration: "none" }}
                                        >
                                          Download PDF
                                        </a>
                                      )}

                                      {ver.status === "DRAFT" && (
                                        <button
                                          onClick={() => handleSubmitForReview(ver.id)}
                                          disabled={submitting}
                                          className="btn-primary"
                                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                                        >
                                          Submit for Review
                                        </button>
                                      )}

                                      {ver.status === "IN_REVIEW" && (
                                        <button
                                          onClick={() => {
                                            setTargetVersionId(ver.id);
                                            setShowReviewModal(true);
                                          }}
                                          className="btn-secondary"
                                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                                        >
                                          Review Decision
                                        </button>
                                      )}

                                      {canRelease && (
                                        <button
                                          onClick={() => handleManagerRelease(ver.id, drw.current_released_version_id)}
                                          disabled={submitting}
                                          className="btn-primary"
                                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                                          title="All required consultant approvals complete. Final manager release."
                                        >
                                          Manager Release
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Reviewers List */}
                                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginBottom: "0.25rem" }}>
                                      Required Consultant Reviews:
                                    </div>
                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                      {ver.reviews?.map((rev: any) => (
                                        <div
                                          key={rev.id}
                                          style={{
                                            fontSize: "0.75rem",
                                            padding: "0.2rem 0.5rem",
                                            borderRadius: "3px",
                                            backgroundColor:
                                              rev.status === "APPROVED"
                                                ? "rgba(74, 222, 128, 0.15)"
                                                : rev.status === "CHANGES_REQUESTED"
                                                ? "rgba(239, 68, 68, 0.15)"
                                                : "rgba(255, 255, 255, 0.05)",
                                            color:
                                              rev.status === "APPROVED"
                                                ? "#4ade80"
                                                : rev.status === "CHANGES_REQUESTED"
                                                ? "#f87171"
                                                : "var(--merveille-muted)",
                                          }}
                                        >
                                          {rev.consultant_name}: <strong>{rev.status}</strong>
                                          {rev.decision_reason && ` (${rev.decision_reason})`}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Drawing Modal */}
      {showNewDrawingModal && (
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
              Add Drawing Sheet to Register
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Creates a logical drawing sheet with stable numbering (REQ-DRW-001).
            </p>
            <form onSubmit={handleCreateDrawing} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Drawing Sheet Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MD-ARC-101"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Drawing Sheet Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor Architectural Layout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Discipline *
                </label>
                <select
                  value={newDiscipline}
                  onChange={(e) => setNewDiscipline(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="ARCHITECTURAL">Architectural</option>
                  <option value="STRUCTURAL">Structural</option>
                  <option value="MEP">MEP (Mechanical/Electrical/Plumbing)</option>
                  <option value="LANDSCAPE">Landscape</option>
                  <option value="INTERIOR">Interior</option>
                  <option value="CIVIL">Civil / Site Works</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowNewDrawingModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Drawing Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Version Modal */}
      {showNewVersionModal && (
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
          <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Submit Drawing Version
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Uploads a version snapshot and designates required consultants. Revisions invalidate prior approvals (AC-019).
            </p>
            <form onSubmit={handleCreateVersionSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Version Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. V1, V2"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Attached PDF Document *
                </label>
                <select
                  required
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="">Select uploaded PDF file...</option>
                  {projectFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.file_name} ({(f.size_bytes / (1024 * 1024)).toFixed(2)} MiB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Submission Revision Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Revised column grid and added structural slab drops..."
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Required Consultant Reviewers (AC-016)
                </label>
                <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {projectConsultants.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                      No consultants registered. Invite consultants in People & Access.
                    </span>
                  ) : (
                    projectConsultants.map((c) => (
                      <label
                        key={c.id}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedConsultantIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedConsultantIds([...selectedConsultantIds, c.id]);
                            else setSelectedConsultantIds(selectedConsultantIds.filter((id) => id !== c.id));
                          }}
                        />
                        {c.name} ({c.email})
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowNewVersionModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Create Draft Version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consultant Review Modal */}
      {showReviewModal && (
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
              Consultant Review Decision
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Per AC-016/AC-017, approvals are version-bound and queue the manager release gate.
            </p>
            <form onSubmit={handleConsultantDecision} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Decision *
                </label>
                <select
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="APPROVED">Approved (Complies with engineering discipline)</option>
                  <option value="CHANGES_REQUESTED">Changes Requested (Return for modifications)</option>
                  <option value="REJECTED">Declined / Rejected</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Technical Review Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail engineering review observations..."
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
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
              Withdraw Current Released Drawing
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Withdraws current release. Does not automatically promote older versions (AC-018).
            </p>
            <form onSubmit={handleWithdrawSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Withdrawal Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Critical structural clash detected on site; stop execution..."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Withdrawing..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
