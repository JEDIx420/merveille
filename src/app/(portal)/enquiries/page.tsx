"use client";

import { useState, useEffect } from "react";
import { formatBusinessDate } from "@/shared/config";

interface EnquiryItem {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  site_location: string;
  status: "OPEN" | "FEASIBILITY_REVIEW" | "QUOTE_PREPARATION" | "ON_HOLD" | "LOST" | "DECLINED" | "CONVERTED";
  decline_reason: string | null;
  linked_project_id: string | null;
  created_at: number;
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<EnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    loadEnquiries();
  }, []);

  async function loadEnquiries() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/enquiries");
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load enquiries");
      setEnquiries(data.enquiries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = enquiries.filter((e) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return e.status === "OPEN" || e.status === "FEASIBILITY_REVIEW" || e.status === "QUOTE_PREPARATION";
    if (filter === "CLOSED") return e.status === "LOST" || e.status === "DECLINED";
    if (filter === "CONVERTED") return e.status === "CONVERTED";
    return e.status === filter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="text-display">Enquiries & Pipeline</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            New architectural prospects, site feasibility assessments, and project conversion intake.
          </p>
        </div>
        <a href="/enquiries/new" className="btn-primary">
          + Record New Enquiry
        </a>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.5rem" }}>
        {["ALL", "ACTIVE", "CONVERTED", "CLOSED"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "4px",
              backgroundColor: filter === t ? "rgba(197, 160, 89, 0.2)" : "transparent",
              color: filter === t ? "var(--merveille-gold)" : "var(--merveille-muted)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t === "ALL" ? "All Enquiries" : t === "ACTIVE" ? "In Progress" : t === "CONVERTED" ? "Converted to Projects" : "Lost / Declined"}
          </button>
        ))}
      </div>

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

      {loading ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          Loading intake pipeline...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          No enquiries matching current filter.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
                <th style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontWeight: 500 }}>Prospect / Client</th>
                <th style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontWeight: 500 }}>Site Location</th>
                <th style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontWeight: 500 }}>Received Date</th>
                <th style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontWeight: 500 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((enq) => {
                const isConverted = enq.status === "CONVERTED";
                const isClosed = enq.status === "LOST" || enq.status === "DECLINED";

                return (
                  <tr
                    key={enq.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "#fff" }}>{enq.contact_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>{enq.contact_email}</div>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "var(--merveille-foreground)" }}>
                      {enq.site_location}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span
                        className={`badge badge-${
                          isConverted
                            ? "active"
                            : isClosed
                            ? "paused"
                            : "draft"
                        }`}
                      >
                        {enq.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "var(--merveille-muted)", fontSize: "0.8125rem" }}>
                      {formatBusinessDate(enq.created_at)}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <a
                          href={`/enquiries/${enq.id}`}
                          className="btn-secondary"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          View Details
                        </a>
                        {isConverted && enq.linked_project_id && (
                          <a
                            href={`/projects/${enq.linked_project_id}/overview`}
                            style={{ fontSize: "0.75rem", color: "var(--merveille-gold)", textDecoration: "none" }}
                          >
                            Go to Project →
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
