"use client";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface Enquiry {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  site_location: string;
  requirements_text: string | null;
  status: "OPEN" | "FEASIBILITY_REVIEW" | "QUOTE_PREPARATION" | "ON_HOLD" | "LOST" | "DECLINED" | "CONVERTED";
  decline_reason: string | null;
  linked_project_id: string | null;
  created_at: number;
}

interface FeasibilityStudy {
  id: string;
  observations: string;
  site_constraints: string | null;
  recommendations: string;
  created_at: number;
}

export default function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: enquiryId } = use(params);
  const [data, setData] = useState<{ enquiry: Enquiry; studies: FeasibilityStudy[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Feasibility Form
  const [showFeasibilityForm, setShowFeasibilityForm] = useState(false);
  const [observations, setObservations] = useState("");
  const [siteConstraints, setSiteConstraints] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // Close Modal (Lost/Declined)
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"LOST" | "DECLINED">("LOST");
  const [closeReason, setCloseReason] = useState("");

  // Convert Modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [mainClientUserId, setMainClientUserId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEnquiry();
    loadUsers();
  }, [enquiryId]);

  async function loadEnquiry() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load enquiry");
      setData(json);
      if (json.enquiry) {
        setProjectName(`${json.enquiry.contact_name} Residence`);
        setProjectCode(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/people");
      const json: any = await res.json();
      if (res.ok) {
        setUsersList(json.people || []);
      }
    } catch {
      // Ignore user list fetch failure
    }
  }

  async function handleFeasibilitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_FEASIBILITY",
          observations,
          siteConstraints,
          recommendations,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record study");
      setActionSuccess("Feasibility assessment successfully recorded.");
      setShowFeasibilityForm(false);
      setObservations("");
      setSiteConstraints("");
      setRecommendations("");
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          status: closeStatus,
          reason: closeReason,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to close enquiry");
      setActionSuccess(`Enquiry successfully marked as ${closeStatus}.`);
      setShowCloseModal(false);
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConvertSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONVERT",
          projectCode,
          projectName,
          mainClientUserId,
          managerUserId,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to convert enquiry");
      setActionSuccess("Enquiry converted into a draft project with baseline stages.");
      setShowConvertModal(false);
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
        Loading enquiry details...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="card" style={{ padding: "2rem" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "0.5rem" }}>Enquiry Not Found</h2>
        <p className="text-muted">{error || "Could not retrieve enquiry."}</p>
        <a href="/enquiries" className="btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
          Back to Enquiries
        </a>
      </div>
    );
  }

  const enq = data.enquiry;
  const isClosed = enq.status === "LOST" || enq.status === "DECLINED";
  const isConverted = enq.status === "CONVERTED";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/enquiries" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Enquiries
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>{enq.contact_name}</span>
      </nav>

      {/* Header */}
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
              className={`badge badge-${
                isConverted ? "active" : isClosed ? "paused" : "draft"
              }`}
            >
              {enq.status}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)" }}>
              Received {formatBusinessDate(enq.created_at)}
            </span>
          </div>
          <h1 className="text-display">{enq.contact_name}</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            {enq.site_location}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {!isConverted && !isClosed && (
            <>
              <button
                onClick={() => setShowCloseModal(true)}
                className="btn-secondary"
              >
                Close as Lost/Declined
              </button>
              <button
                onClick={() => setShowConvertModal(true)}
                className="btn-primary"
              >
                Convert to Project
              </button>
            </>
          )}

          {isConverted && enq.linked_project_id && (
            <a
              href={`/projects/${enq.linked_project_id}/overview`}
              className="btn-primary"
            >
              Open Converted Project →
            </a>
          )}
        </div>
      </header>

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

      {/* Closed Reason Banner */}
      {isClosed && (
        <div
          className="card"
          style={{
            borderColor: "rgba(239, 68, 68, 0.3)",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            padding: "1rem 1.25rem",
          }}
        >
          <strong style={{ color: "#f87171", display: "block", marginBottom: "0.25rem" }}>
            Enquiry Closed ({enq.status})
          </strong>
          <p style={{ fontSize: "0.875rem", color: "var(--merveille-foreground)" }}>
            Reason: {enq.decline_reason || "No decline reason recorded."}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
            Per AC-009, this enquiry was closed without creating an active architectural commission.
          </p>
        </div>
      )}

      {/* Brief & Contact Details Card */}
      <div className="card">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "1rem" }}>
          Prospect & Brief Details
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Contact Name</div>
            <div style={{ fontWeight: 500, color: "#fff" }}>{enq.contact_name}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Email</div>
            <div style={{ fontWeight: 500, color: "#fff" }}>{enq.contact_email}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Phone</div>
            <div style={{ fontWeight: 500, color: "#fff" }}>{enq.contact_phone || "Not recorded"}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Location</div>
            <div style={{ fontWeight: 500, color: "#fff" }}>{enq.site_location}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: "0.35rem" }}>
            Spatial Requirements & Brief
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--merveille-foreground)", lineHeight: "1.5" }}>
            {enq.requirements_text || "No preliminary requirements recorded."}
          </div>
        </div>
      </div>

      {/* Feasibility Studies */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff" }}>
              Site Feasibility Studies
            </h2>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.2rem" }}>
              Site topography, municipal zoning, road access, and architectural recommendations.
            </p>
          </div>
          {!isClosed && !showFeasibilityForm && (
            <button
              onClick={() => setShowFeasibilityForm(true)}
              className="btn-secondary"
            >
              + Record Study
            </button>
          )}
        </div>

        {/* Feasibility study creation form */}
        {showFeasibilityForm && (
          <form
            onSubmit={handleFeasibilitySubmit}
            style={{
              padding: "1.25rem",
              borderRadius: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              marginBottom: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--merveille-gold)" }}>
              New Feasibility Assessment
            </h3>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                Site Observations *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Topography, existing vegetation, road width, neighbouring structures..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
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
                Site & Regulatory Constraints
              </label>
              <textarea
                rows={2}
                placeholder="Frontage setbacks, K-SMART FAR limitations, CRZ / environmental buffers..."
                value={siteConstraints}
                onChange={(e) => setSiteConstraints(e.target.value)}
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
                Design Recommendations *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Recommended footprint, massing orientation, structural approach..."
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setShowFeasibilityForm(false)}
                className="btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Saving..." : "Save Feasibility Study"}
              </button>
            </div>
          </form>
        )}

        {/* Existing studies list */}
        {data.studies.length === 0 ? (
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            No feasibility assessments recorded yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {data.studies.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "1rem",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--merveille-gold)", fontSize: "0.875rem" }}>
                    Feasibility Assessment
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
                    {formatBusinessDate(s.created_at)}
                  </span>
                </div>
                <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                  <strong style={{ color: "var(--merveille-muted)", display: "block", fontSize: "0.75rem" }}>
                    Observations:
                  </strong>
                  {s.observations}
                </div>
                {s.site_constraints && (
                  <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                    <strong style={{ color: "var(--merveille-muted)", display: "block", fontSize: "0.75rem" }}>
                      Constraints:
                    </strong>
                    {s.site_constraints}
                  </div>
                )}
                <div style={{ fontSize: "0.875rem" }}>
                  <strong style={{ color: "var(--merveille-muted)", display: "block", fontSize: "0.75rem" }}>
                    Recommendations:
                  </strong>
                  {s.recommendations}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close Modal (Lost / Declined) */}
      {showCloseModal && (
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
              Close Enquiry without Commission
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Per AC-009, recording an enquiry as lost or declined closes intake without creating an active project record.
            </p>
            <form onSubmit={handleCloseSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Outcome *
                </label>
                <select
                  value={closeStatus}
                  onChange={(e) => setCloseStatus(e.target.value as "LOST" | "DECLINED")}
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
                  <option value="LOST">Lost (Client chose alternative / decided not to proceed)</option>
                  <option value="DECLINED">Declined (Practice capacity / location outside focus)</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Reason for Closure *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the commercial or logistical reason..."
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Closing..." : "Confirm Closure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {showConvertModal && (
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
              Convert Enquiry to Project Record
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Initializes a new architectural project with standard stages in DRAFT status. Full activation requires accepted quotation and confirmed advance payment.
            </p>
            <form onSubmit={handleConvertSubmit}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Project Code *
                </label>
                <input
                  type="text"
                  required
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
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

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
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

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Main Client Authority *
                </label>
                <select
                  required
                  value={mainClientUserId}
                  onChange={(e) => setMainClientUserId(e.target.value)}
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
                  <option value="">Select registered client user...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Lead Project Manager *
                </label>
                <select
                  required
                  value={managerUserId}
                  onChange={(e) => setManagerUserId(e.target.value)}
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
                  <option value="">Select project manager...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Converting..." : "Convert to Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
