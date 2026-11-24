"use client";
import { cx } from "@/components/utilities";
import { readResponse } from "@/components/ui";
import layout from "./page.module.css";

import { useState, useEffect } from "react";
import { formatBusinessDate } from "@/shared/config";

interface EnquiryItem {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  site_location: string;
  status:
    | "OPEN"
    | "FEASIBILITY_REVIEW"
    | "QUOTE_PREPARATION"
    | "ON_HOLD"
    | "LOST"
    | "DECLINED"
    | "CONVERTED";
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
      const data: any = await readResponse(res);
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
    if (filter === "ACTIVE")
      return (
        e.status === "OPEN" ||
        e.status === "FEASIBILITY_REVIEW" ||
        e.status === "QUOTE_PREPARATION"
      );
    if (filter === "CLOSED")
      return e.status === "LOST" || e.status === "DECLINED";
    if (filter === "CONVERTED") return e.status === "CONVERTED";
    return e.status === filter;
  });

  return (
    <div className={cx(layout.block1)}>
      {/* Header */}
      <header className={cx(layout.block2)}>
        <div>
          <h1 className={cx("text-display")}>Enquiries & Pipeline</h1>
          <p className={cx(["text-muted", layout.block3].join(" "))}>
            New architectural prospects, site feasibility assessments, and
            project conversion intake.
          </p>
        </div>
        <a href="/enquiries/new" className={cx("btn-primary")}>
          + Record New Enquiry
        </a>
      </header>

      {/* Tabs */}
      <div className={cx(layout.block4)}>
        {["ALL", "ACTIVE", "CONVERTED", "CLOSED"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              backgroundColor:
                filter === t ? "var(--ui-surface-subtle)" : "transparent",
              color: filter === t ? "var(--ui-action)" : "var(--ui-text-muted)",
            }}
            className={cx(layout.block5)}
          >
            {t === "ALL"
              ? "All Enquiries"
              : t === "ACTIVE"
                ? "In Progress"
                : t === "CONVERTED"
                  ? "Converted to Projects"
                  : "Lost / Declined"}
          </button>
        ))}
      </div>

      {error && <div className={cx(layout.block6)}>{error}</div>}

      {loading ? (
        <div className={cx(["card text-muted", layout.block7].join(" "))}>
          Loading intake pipeline...
        </div>
      ) : filtered.length === 0 ? (
        <div className={cx(["card text-muted", layout.block8].join(" "))}>
          No enquiries matching current filter.
        </div>
      ) : (
        <div className={cx(["card", layout.block9].join(" "))}>
          <table className={cx(layout.block10)}>
            <thead>
              <tr className={cx(layout.block11)}>
                <th className={cx(layout.block12)}>Prospect / Client</th>
                <th className={cx(layout.block13)}>Site Location</th>
                <th className={cx(layout.block14)}>Status</th>
                <th className={cx(layout.block15)}>Received Date</th>
                <th className={cx(layout.block16)}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((enq) => {
                const isConverted = enq.status === "CONVERTED";
                const isClosed =
                  enq.status === "LOST" || enq.status === "DECLINED";

                return (
                  <tr key={enq.id} className={cx(layout.block17)}>
                    <td className={cx(layout.block18)}>
                      <div className={cx(layout.block19)}>
                        {enq.contact_name}
                      </div>
                      <div className={cx(layout.block20)}>
                        {enq.contact_email}
                      </div>
                    </td>
                    <td className={cx(layout.block21)}>{enq.site_location}</td>
                    <td className={cx(layout.block22)}>
                      <span
                        className={cx(
                          `badge badge-${
                            isConverted
                              ? "active"
                              : isClosed
                                ? "paused"
                                : "draft"
                          }`,
                        )}
                      >
                        {enq.status}
                      </span>
                    </td>
                    <td className={cx(layout.block23)}>
                      {formatBusinessDate(enq.created_at)}
                    </td>
                    <td className={cx(layout.block24)}>
                      <div className={cx(layout.block25)}>
                        <a
                          href={`/enquiries/${enq.id}`}
                          className={cx(
                            ["btn-secondary", layout.block26].join(" "),
                          )}
                        >
                          View Details
                        </a>
                        {isConverted && enq.linked_project_id && (
                          <a
                            href={`/projects/${enq.linked_project_id}/overview`}
                            className={cx(layout.block27)}
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
