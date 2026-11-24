"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function PerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isForbidden, setIsForbidden] = useState(false);
  const [periodDays, setPeriodDays] = useState(90);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    loadPerformance();
  }, [periodDays]);

  async function loadPerformance() {
    setLoading(true);
    setError("");
    setIsForbidden(false);
    try {
      const res = await fetch(`/api/dashboard/performance?periodDays=${periodDays}`);
      const json: any = await res.json();
      if (res.status === 403) {
        setIsForbidden(true);
        throw new Error(json.error || "Forbidden: Owner access required.");
      }
      if (!res.ok) throw new Error(json.error || "Failed to load team performance");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (isForbidden) {
    return (
      <div className="card" style={{ padding: "3rem 1.5rem", textAlign: "center", borderColor: "var(--merveille-error)" }}>
        <h1 style={{ fontSize: "1.35rem", color: "var(--merveille-error)", marginBottom: "0.5rem" }}>
          Access Denied (403 Forbidden)
        </h1>
        <p style={{ color: "var(--merveille-muted)", maxWidth: "540px", margin: "0 auto" }}>
          Individual performance scorecards and rework analytics are strictly restricted to the practice Owner.
          Team members, project managers, and administrators cannot view individual performance metrics.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/overview" className="btn-secondary">
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <h1 className="text-display">Team Performance & Rework</h1>
            <span className="badge" style={{ backgroundColor: "var(--merveille-gold-surface)", color: "var(--merveille-gold-text)", fontWeight: 600 }}>
              Owner Confidential
            </span>
          </div>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Evidence-based deadline adherence, quality rework, and site milestone progress.
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setPeriodDays(d)}
              className={periodDays === d ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </header>

      {/* Disclosed Transparent Metric Definitions (REQ-DAS-004) */}
      <section className="card" style={{ padding: "1.25rem", backgroundColor: "var(--merveille-surface)" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--merveille-ink)", marginBottom: "0.5rem" }}>
          Transparent Metric Definitions & Fairness Principles
        </h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--merveille-muted)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <li>
            <strong>Deadline Adherence:</strong> {data?.definitions?.deadlineAdherence || "Calculated against agreed baseline. Denominator: total completed tasks."}
          </li>
          <li>
            <strong>Rework vs Client Scope (Fairness):</strong> {data?.definitions?.reworkVsClientScope || "Client-driven scope additions or variations are strictly separated from internal quality rework."}
          </li>
          <li>
            <strong>Site Progress:</strong> {data?.definitions?.siteProgress || "Evaluated by verified stage completions, never fabricated from task checkboxes."}
          </li>
        </ul>
      </section>

      {loading ? (
        <div style={{ padding: "2rem", color: "var(--merveille-muted)" }}>Loading performance metrics...</div>
      ) : error ? (
        <div className="card" style={{ borderColor: "var(--merveille-error)" }}>
          <p style={{ color: "var(--merveille-error)" }}>{error}</p>
        </div>
      ) : (
        <>
          {/* Team Table */}
          <section className="card" style={{ padding: "1.5rem" }}>
            <h2 className="text-section" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Staff & Team Member Metrics
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--merveille-border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Team Member</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Role</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Completed Tasks</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>On-Time Rate</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Overdue Open</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Internal Rework</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Client Scope Variations</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.teamMetrics || []).map((m: any) => (
                    <tr
                      key={m.userId}
                      style={{
                        borderBottom: "1px solid var(--merveille-border)",
                        backgroundColor: selectedUser?.userId === m.userId ? "var(--merveille-selection)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                        {m.displayName}
                        <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", fontWeight: 400 }}>
                          {m.email}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span className="badge" style={{ fontSize: "0.75rem" }}>{m.role}</span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{m.completedTasksCount}</td>
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600, color: m.onTimePercentage ? "var(--merveille-ink)" : "var(--merveille-muted)" }}>
                        {m.onTimePercentage || "N/A (0 completed)"}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: m.overdueTasksCount > 0 ? "var(--merveille-error)" : "inherit" }}>
                        {m.overdueTasksCount}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: m.reopenedTasksCount > 0 ? "var(--merveille-gold-text)" : "inherit" }}>
                        {m.reopenedTasksCount}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", color: "var(--merveille-muted)" }}>
                        {m.clientScopeRevisionsCount} (client-driven)
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <button
                          onClick={() => setSelectedUser(selectedUser?.userId === m.userId ? null : m)}
                          className="btn-secondary"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          {selectedUser?.userId === m.userId ? "Hide Evidence" : "Inspect Evidence"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Drilldown Evidence Panel */}
          {selectedUser && (
            <section className="card" style={{ padding: "1.5rem", borderColor: "var(--merveille-gold)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                    Evidence Log: {selectedUser.displayName}
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--merveille-muted)", margin: "0.25rem 0 0 0" }}>
                    Underlying tasks, baseline deadlines, rework events, and scope change context.
                  </p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
                  Close
                </button>
              </div>

              {selectedUser.tasks.length === 0 ? (
                <p style={{ color: "var(--merveille-muted)", fontSize: "0.875rem" }}>No tasks assigned in this evaluation period.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedUser.tasks.map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "0.75rem 1rem",
                        backgroundColor: "var(--merveille-surface)",
                        borderRadius: "var(--merveille-radius-sm)",
                        border: "1px solid var(--merveille-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.85rem",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--merveille-ink)" }}>
                          [{t.projectCode}] {t.title}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.2rem" }}>
                          Original Due: {t.originalDueDate || "None"} &bull; Current Due: {t.currentDueDate || "None"} &bull; Status: {t.status}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {t.isClientScopeChange && (
                          <span className="badge" style={{ backgroundColor: "var(--merveille-selection)", color: "var(--merveille-gold-text)", fontSize: "0.75rem" }}>
                            Client Scope Addition
                          </span>
                        )}
                        {t.reopenCount > 0 && (
                          <span className="badge badge-error" style={{ fontSize: "0.75rem" }}>
                            Reopened {t.reopenCount}x (Internal Quality)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Project Stage Progress Section */}
          <section className="card" style={{ padding: "1.5rem" }}>
            <h2 className="text-section" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Project Milestone & Stage Progress
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--merveille-border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Project</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Stage</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Planned Target</th>
                    <th style={{ padding: "0.75rem 0.5rem" }}>Actual Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.projectStageProgress || []).map((s: any, idx: number) => (
                    <tr key={`${s.projectId}_${idx}`} style={{ borderBottom: "1px solid var(--merveille-border)" }}>
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                        {s.projectCode} &bull; {s.projectName}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{s.stageName}</td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span
                          className={`badge ${
                            s.status === "COMPLETED"
                              ? "badge-success"
                              : s.status === "IN_PROGRESS"
                              ? "badge-warning"
                              : ""
                          }`}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>{s.plannedCompletionDate || "Not set"}</td>
                      <td style={{ padding: "0.75rem 0.5rem", color: s.actualCompletionDate ? "var(--merveille-success)" : "var(--merveille-muted)" }}>
                        {s.actualCompletionDate || "Pending"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
