"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ObservationFile {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  is_client_shared?: number;
}

interface PermitObservation {
  id: string;
  observed_status_text: string;
  decision_date?: string;
  last_checked_date: string;
  source_description: string;
  reference_url?: string;
  staff_notes?: string;
  sharing_status: string;
  recorded_by_name: string;
  shared_by_name?: string;
  shared_at?: number;
  created_at: number;
  files?: ObservationFile[];
}

interface PermitMilestone {
  milestoneId: string;
  milestoneType: "SANCTION" | "COMPLETION";
  applicationReference?: string;
  trackingLabel?: string;
  hasPublishedRecord?: boolean;
  statusText?: string;
  decisionDate?: string;
  lastCheckedDate?: string;
  recordedByName?: string;
  sourceDescription?: string;
  referenceUrl?: string;
  recordStatement?: string;
  disclaimer?: string;
  files?: ObservationFile[];
  observations?: PermitObservation[];
}

export default function PermitsPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<PermitMilestone[]>([]);

  // Modal states
  const [showAddObsModal, setShowAddObsModal] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  // Form states
  const [statusText, setStatusText] = useState("");
  const [checkedDate, setCheckedDate] = useState(new Date().toISOString().slice(0, 10));
  const [decisionDate, setDecisionDate] = useState("");
  const [sourceDesc, setSourceDesc] = useState("Staff manual check on K-SMART portal");
  const [refUrl, setRefUrl] = useState("https://ksmart.kerala.gov.in");
  const [staffNotes, setStaffNotes] = useState("");

  const fetchPermits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`);
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to load permit records");
      }
      const data = await res.json() as any;
      setMilestones(data.permits || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchPermits();
    }
  }, [projectId]);

  const handleRecordObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestoneId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_OBSERVATION",
          milestoneId: selectedMilestoneId,
          observedStatusText: statusText,
          lastCheckedDate: checkedDate,
          decisionDate: decisionDate || undefined,
          sourceDescription: sourceDesc,
          referenceUrl: refUrl || undefined,
          staffNotes: staffNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to record observation");
      }

      setShowAddObsModal(false);
      setSelectedMilestoneId(null);
      setStatusText("");
      setStaffNotes("");
      fetchPermits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitForSharing = async (observationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_SHARING", observationId }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to submit for sharing");
      }
      fetchPermits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReviewSharing = async (observationId: string, decision: "APPROVE" | "RETURN") => {
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVIEW_SHARING", observationId, decision }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to process sharing decision");
      }
      fetchPermits();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="portal-container" style={{ padding: "2rem" }}>
        <p className="text-muted">Loading K-SMART permit records...</p>
      </div>
    );
  }

  return (
    <div className="portal-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <a href={`/projects/${projectId}/overview`} style={{ color: "var(--color-primary)", textDecoration: "none", fontSize: "0.875rem", marginBottom: "0.5rem", display: "inline-block" }}>
          ← Back to Project Overview
        </a>
        <h1 className="text-display" style={{ fontSize: "1.75rem", fontWeight: 600 }}>K-SMART Permit Records</h1>
        <p className="text-muted" style={{ marginTop: "0.25rem" }}>
          Sanction and completion permit observations recorded manually by the architectural team.
        </p>
      </div>

      {/* Disclaimers & Truthful Boundary Statement */}
      <div style={{ padding: "1rem 1.25rem", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", marginBottom: "2rem" }}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#1E40AF", lineHeight: 1.5 }}>
          ℹ️ <strong>Practice Tracking Boundary:</strong> Merveille Designs tracks observations manually from K-SMART submissions and documents. The portal does not query, scrape, or integrate with government servers, nor does it certify the legal validity of permits.
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#991B1B", borderRadius: "6px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* Milestones Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "2rem" }}>
        {milestones.map((milestone) => {
          const isSanction = milestone.milestoneType === "SANCTION";
          const title = isSanction ? "Sanction Permit (Building Permit)" : "Completion Certificate & Occupancy";
          const isInternal = Boolean(milestone.observations);

          return (
            <div
              key={milestone.milestoneId}
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Milestone Group
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0.25rem 0 0 0" }}>{title}</h2>
                  {milestone.applicationReference && (
                    <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                      Application Ref: <strong>{milestone.applicationReference}</strong>
                    </p>
                  )}
                </div>

                {isInternal && (
                  <button
                    onClick={() => {
                      setSelectedMilestoneId(milestone.milestoneId);
                      setShowAddObsModal(true);
                    }}
                    className="btn-primary"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8125rem", cursor: "pointer" }}
                  >
                    + Record Status
                  </button>
                )}
              </div>

              {/* Client View (Published Observation) */}
              {!isInternal && (
                <div>
                  {milestone.hasPublishedRecord ? (
                    <div style={{ padding: "1.25rem", backgroundColor: "#F9FAFB", borderRadius: "6px", border: "1px solid #E5E7EB" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111827" }}>
                          {milestone.statusText}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600, backgroundColor: "#D1FAE5", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                          VERIFIED RECORD
                        </span>
                      </div>

                      <p style={{ fontSize: "0.8125rem", color: "#4B5563", margin: "0.25rem 0" }}>
                        {milestone.recordStatement}
                      </p>

                      {milestone.decisionDate && (
                        <p style={{ fontSize: "0.8125rem", color: "#4B5563", margin: "0.25rem 0" }}>
                          Order / Decision Date: <strong>{milestone.decisionDate}</strong>
                        </p>
                      )}

                      {milestone.referenceUrl && (
                        <p style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                          <a href={milestone.referenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)" }}>
                            Open K-SMART Portal Reference ↗
                          </a>
                        </p>
                      )}

                      {/* Client shared files */}
                      {milestone.files && milestone.files.length > 0 && (
                        <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #E5E7EB" }}>
                          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                            Approved Supporting Documents
                          </p>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {milestone.files.map((file) => (
                              <div
                                key={file.id}
                                style={{
                                  padding: "0.4rem 0.6rem",
                                  backgroundColor: "#FFF",
                                  border: "1px solid #D1D5DB",
                                  borderRadius: "4px",
                                  fontSize: "0.8125rem",
                                }}
                              >
                                📄 {file.file_name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p style={{ fontSize: "0.6875rem", color: "#9CA3AF", marginTop: "1rem", fontStyle: "italic" }}>
                        {milestone.disclaimer}
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: "2rem", textAlign: "center", backgroundColor: "#F9FAFB", borderRadius: "6px" }}>
                      <p className="text-muted" style={{ fontSize: "0.875rem", margin: 0 }}>
                        No published permit observations recorded yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Timeline View */}
              {isInternal && milestone.observations && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase" }}>
                    Observation Timeline ({milestone.observations.length})
                  </div>

                  {milestone.observations.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: "0.875rem", margin: 0 }}>
                      No observations recorded yet. Click &quot;Record Status&quot; to log a check.
                    </p>
                  ) : (
                    milestone.observations.map((obs) => (
                      <div
                        key={obs.id}
                        style={{
                          padding: "1rem",
                          backgroundColor: "#F9FAFB",
                          borderRadius: "6px",
                          border: "1px solid #E5E7EB",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{obs.observed_status_text}</span>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              backgroundColor:
                                obs.sharing_status === "SHARED"
                                  ? "#D1FAE5"
                                  : obs.sharing_status === "SUBMITTED_FOR_SHARING"
                                  ? "#FEF3C7"
                                  : "#F3F4F6",
                              color:
                                obs.sharing_status === "SHARED"
                                  ? "#065F46"
                                  : obs.sharing_status === "SUBMITTED_FOR_SHARING"
                                  ? "#92400E"
                                  : "#374151",
                            }}
                          >
                            {obs.sharing_status}
                          </span>
                        </div>

                        <p style={{ fontSize: "0.8125rem", color: "#6B7280", margin: 0 }}>
                          Checked: <strong>{obs.last_checked_date}</strong> · Recorded by {obs.recorded_by_name}
                        </p>

                        {obs.staff_notes && (
                          <div style={{ padding: "0.5rem", backgroundColor: "#FFF", borderRadius: "4px", fontSize: "0.8125rem", border: "1px solid #E5E7EB" }}>
                            🔒 <em>Internal Note:</em> {obs.staff_notes}
                          </div>
                        )}

                        {obs.files && obs.files.length > 0 && (
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                            {obs.files.map((f) => (
                              <span
                                key={f.id}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "4px",
                                  backgroundColor: f.is_client_shared ? "#DBEAFE" : "#FEE2E2",
                                  color: f.is_client_shared ? "#1E40AF" : "#991B1B",
                                }}
                              >
                                {f.is_client_shared ? "🌐 Client Shared" : "🔒 Internal Only"}: {f.file_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Manager sharing controls */}
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", justifyContent: "flex-end" }}>
                          {obs.sharing_status === "INTERNAL" && (
                            <button
                              onClick={() => handleSubmitForSharing(obs.id)}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              Submit for Client Sharing
                            </button>
                          )}
                          {obs.sharing_status === "SUBMITTED_FOR_SHARING" && (
                            <>
                              <button
                                onClick={() => handleReviewSharing(obs.id, "APPROVE")}
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Approve & Publish
                              </button>
                              <button
                                onClick={() => handleReviewSharing(obs.id, "RETURN")}
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", backgroundColor: "#DC2626", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Keep Internal
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record Observation Modal */}
      {showAddObsModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "550px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Record K-SMART Status Observation</h2>
            <form onSubmit={handleRecordObservation}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Observed Status</label>
                <input
                  type="text"
                  required
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. Scrutiny in progress / Sanction Order Issued"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Last Checked Date</label>
                  <input
                    type="date"
                    required
                    value={checkedDate}
                    onChange={(e) => setCheckedDate(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Order / Decision Date (Optional)</label>
                  <input
                    type="date"
                    value={decisionDate}
                    onChange={(e) => setDecisionDate(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Source Description</label>
                <input
                  type="text"
                  required
                  value={sourceDesc}
                  onChange={(e) => setSourceDesc(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Reference URL (Optional)</label>
                <input
                  type="url"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Internal Staff Notes (Private)</label>
                <textarea
                  rows={3}
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="Private commentary for team members only..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAddObsModal(false)}
                  style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Record Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
