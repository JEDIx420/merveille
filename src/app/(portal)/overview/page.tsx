"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatRupees, formatBusinessDate } from "@/shared/config";

interface WaitingItem {
  id: string;
  entityType: string;
  entityId: string;
  entityVersion?: number | string | null;
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  title: string;
  description: string;
  requiredAction: string;
  urgency: string;
  isOverdue: boolean;
  dueDate: string | null;
  link: string;
}

export default function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/overview");
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard overview");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: "var(--merveille-muted)" }}>
        Loading dashboard overview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: "var(--merveille-error)" }}>
        <h2 style={{ color: "var(--merveille-error)", marginBottom: "0.5rem" }}>Unable to load overview</h2>
        <p style={{ color: "var(--merveille-muted)" }}>{error}</p>
        <button onClick={loadOverview} className="btn-secondary" style={{ marginTop: "1rem" }}>
          Retry
        </button>
      </div>
    );
  }

  const waitingItems: WaitingItem[] = data?.waitingItems || [];
  const overdueItems = waitingItems.filter((i) => i.isOverdue);
  const urgentItems = waitingItems.filter((i) => !i.isOverdue && (i.urgency === "URGENT" || i.urgency === "HIGH"));
  const role = data?.principal?.role;
  const isOwner = role === "OWNER";
  const isAdmin = role === "ADMIN";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">Dashboard Overview</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Welcome back, {data?.principal?.name} &bull; {formatBusinessDate(new Date())}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className="badge" style={{ backgroundColor: "var(--merveille-gold-surface)", color: "var(--merveille-gold-text)", fontWeight: 600 }}>
            {role}
          </span>
          {isOwner && (
            <Link href="/performance" className="btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
              Team Performance
            </Link>
          )}
        </div>
      </header>

      {/* Priority Action Section ("Waiting on you") */}
      <section className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 className="text-section" style={{ fontSize: "1.15rem", margin: 0 }}>
              Waiting on you
            </h2>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              {waitingItems.length === 0
                ? "You have no pending items requiring action."
                : `${waitingItems.length} actionable item${waitingItems.length > 1 ? "s" : ""} requiring your decision or completion.`}
            </p>
          </div>
          {waitingItems.length > 0 && (
            <Link href="/waiting" className="btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}>
              View full queue ({waitingItems.length})
            </Link>
          )}
        </div>

        {waitingItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--merveille-muted)" }}>
            <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--merveille-ink)" }}>
              All caught up!
            </p>
            <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
              No drawings, invoices, change requests, or assigned tasks are currently waiting on you.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {waitingItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  backgroundColor: item.isOverdue ? "var(--merveille-error-surface)" : "var(--merveille-surface)",
                  borderRadius: "var(--merveille-radius-sm)",
                  border: `1px solid ${item.isOverdue ? "var(--merveille-error)" : "var(--merveille-border)"}`,
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: "70%" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {item.isOverdue && (
                      <span className="badge badge-error" style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem" }}>
                        OVERDUE
                      </span>
                    )}
                    {item.projectCode && (
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--merveille-muted)" }}>
                        {item.projectCode}
                      </span>
                    )}
                    <span style={{ fontWeight: 600, color: "var(--merveille-ink)", fontSize: "0.95rem" }}>
                      {item.title}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--merveille-muted)" }}>
                    {item.description}
                  </p>
                  {item.dueDate && (
                    <span style={{ fontSize: "0.75rem", color: item.isOverdue ? "var(--merveille-error)" : "var(--merveille-muted)" }}>
                      Due: {item.dueDate}
                    </span>
                  )}
                </div>

                <div>
                  <Link href={item.link} className="btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                    {item.requiredAction} &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Firm Commercial Summary (Separate Invoiced vs Received - REQ-DAS-002) */}
      {data?.firmFinance && (
        <section>
          <h2 className="text-section" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
            Commercial & Financial Summary
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--merveille-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Invoiced
              </div>
              <div className="text-money" style={{ fontSize: "1.35rem", fontWeight: 600, marginTop: "0.5rem" }}>
                {formatRupees(data.firmFinance.totalInvoicedMinor)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
                Active issued billings
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--merveille-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Received
              </div>
              <div className="text-money" style={{ fontSize: "1.35rem", fontWeight: 600, marginTop: "0.5rem", color: "var(--merveille-success)" }}>
                {formatRupees(data.firmFinance.totalReceivedMinor)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
                Confirmed client collections
              </div>
            </div>

            {/* Admin-only Payroll and Profit (REQ-DAS-002, AC-005) */}
            {data.firmFinance.payrollAndProfit && (
              <>
                <div className="card" style={{ padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--merveille-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Total Payroll
                  </div>
                  <div className="text-money" style={{ fontSize: "1.35rem", fontWeight: 600, marginTop: "0.5rem" }}>
                    {formatRupees(data.firmFinance.payrollAndProfit.totalPayrollMinor)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
                    Admin-only salary ledger
                  </div>
                </div>

                <div className="card" style={{ padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--merveille-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Net Operating Profit
                  </div>
                  <div className="text-money" style={{ fontSize: "1.35rem", fontWeight: 600, marginTop: "0.5rem", color: "var(--merveille-ink)" }}>
                    {formatRupees(data.firmFinance.payrollAndProfit.netProfitMinor)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.25rem" }}>
                    Collections minus expenses & payroll
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Active Projects Grid */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="text-section" style={{ fontSize: "1.1rem", margin: 0 }}>
            Active Projects ({data?.activeProjects?.length || 0})
          </h2>
          <Link href="/projects" className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
            All Projects &rarr;
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {(data?.activeProjects || []).map((p: any) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/overview`}
              className="card"
              style={{ textDecoration: "none", color: "inherit", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--merveille-gold-text)" }}>
                  {p.code}
                </span>
                <span className="badge" style={{ fontSize: "0.75rem", backgroundColor: "var(--merveille-surface)", border: "1px solid var(--merveille-border)" }}>
                  {p.status}
                </span>
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, color: "var(--merveille-ink)" }}>
                {p.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
