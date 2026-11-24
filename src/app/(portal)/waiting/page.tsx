"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatBusinessDate } from "@/shared/config";

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
  urgency: "URGENT" | "HIGH" | "NORMAL" | "LOW";
  isOverdue: boolean;
  dueDate: string | null;
  link: string;
  createdAt: number;
}

export default function WaitingOnYouPage() {
  const [items, setItems] = useState<WaitingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "OVERDUE" | "APPROVALS" | "DECISIONS" | "TASKS">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadWaitingItems();
  }, []);

  async function loadWaitingItems() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/waiting");
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load waiting items");
      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter((item) => {
    // Text search
    if (search) {
      const q = search.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.projectCode && item.projectCode.toLowerCase().includes(q)) ||
        item.requiredAction.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterType === "OVERDUE") return item.isOverdue;
    if (filterType === "APPROVALS") {
      return (
        item.entityType === "DRAWING_REVIEW" ||
        item.entityType === "DRAWING_RELEASE" ||
        item.entityType === "INVOICE_APPROVAL" ||
        item.entityType === "CHANGE_AUTHORIZATION" ||
        item.entityType === "SNAG_VERIFICATION"
      );
    }
    if (filterType === "DECISIONS") {
      return (
        item.entityType === "CHANGE_DECISION" ||
        item.entityType === "MATERIAL_DECISION" ||
        item.entityType === "QUOTE_DECISION" ||
        item.entityType === "PAYMENT_DUE"
      );
    }
    if (filterType === "TASKS") {
      return (
        item.entityType === "TASK" ||
        item.entityType === "SNAG_REMEDIATION" ||
        item.entityType === "SNAG_TRIAGE" ||
        item.entityType === "CHANGE_ESTIMATE"
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">Waiting on you</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Direct actionable responsibilities requiring your decision or completion.
          </p>
        </div>
        <button onClick={loadWaitingItems} className="btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
          Refresh Queue
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {(["ALL", "OVERDUE", "APPROVALS", "DECISIONS", "TASKS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={filterType === tab ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
            >
              {tab === "ALL" && `All (${items.length})`}
              {tab === "OVERDUE" && `Overdue (${items.filter((i) => i.isOverdue).length})`}
              {tab === "APPROVALS" && `Approvals & Releases`}
              {tab === "DECISIONS" && `Client Decisions`}
              {tab === "TASKS" && `Tasks & Remediations`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by project, title or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.4rem 0.8rem",
            fontSize: "0.85rem",
            borderRadius: "var(--merveille-radius-sm)",
            border: "1px solid var(--merveille-border)",
            backgroundColor: "var(--merveille-surface)",
            color: "var(--merveille-ink)",
            minWidth: "260px",
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: "2rem", color: "var(--merveille-muted)" }}>Loading queue...</div>
      ) : error ? (
        <div className="card" style={{ borderColor: "var(--merveille-error)" }}>
          <p style={{ color: "var(--merveille-error)" }}>{error}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <h2 style={{ fontSize: "1.2rem", color: "var(--merveille-ink)", marginBottom: "0.5rem" }}>
            Nothing waiting on you
          </h2>
          <p style={{ color: "var(--merveille-muted)", maxWidth: "500px", margin: "0 auto" }}>
            You are fully up to date. No actions are currently pending your approval, decision, or completion.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <Link href="/projects" className="btn-secondary">
              View Active Projects &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.25rem",
                borderLeft: item.isOverdue
                  ? "4px solid var(--merveille-error)"
                  : item.urgency === "URGENT" || item.urgency === "HIGH"
                  ? "4px solid var(--merveille-gold)"
                  : "1px solid var(--merveille-border)",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxWidth: "75%" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  {item.isOverdue && (
                    <span className="badge badge-error" style={{ fontSize: "0.75rem", padding: "0.15rem 0.45rem" }}>
                      OVERDUE
                    </span>
                  )}
                  <span
                    className="badge"
                    style={{
                      fontSize: "0.75rem",
                      backgroundColor: "var(--merveille-surface)",
                      color: "var(--merveille-ink)",
                      border: "1px solid var(--merveille-border)",
                    }}
                  >
                    {item.entityType.replace("_", " ")}
                  </span>
                  {item.projectCode && (
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--merveille-gold-text)" }}>
                      {item.projectCode}
                    </span>
                  )}
                  {item.projectName && (
                    <span style={{ fontSize: "0.8rem", color: "var(--merveille-muted)" }}>
                      &bull; {item.projectName}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--merveille-ink)" }}>
                  {item.title}
                </div>

                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--merveille-muted)" }}>
                  {item.description}
                </p>

                {item.dueDate && (
                  <div style={{ fontSize: "0.8rem", color: item.isOverdue ? "var(--merveille-error)" : "var(--merveille-muted)" }}>
                    Target Deadline: {item.dueDate}
                  </div>
                )}
              </div>

              <div>
                <Link href={item.link} className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  {item.requiredAction} &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
