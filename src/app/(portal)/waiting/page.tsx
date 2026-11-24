"use client";
import { cx } from "@/components/utilities";
import { readResponse } from "@/components/ui";
import layout from "./page.module.css";

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
  const [filterType, setFilterType] = useState<
    "ALL" | "OVERDUE" | "APPROVALS" | "DECISIONS" | "TASKS"
  >("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("type");
    if (
      requested &&
      ["ALL", "OVERDUE", "APPROVALS", "DECISIONS", "TASKS"].includes(requested)
    )
      setFilterType(requested as any);
    loadWaitingItems();
  }, []);

  async function loadWaitingItems() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/waiting");
      const json: any = await readResponse(res);
      if (!res.ok)
        throw new Error(json.error || "Failed to load waiting items");
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
    <div className={cx(layout.block1)}>
      {/* Header */}
      <header className={cx(layout.block2)}>
        <div>
          <h1 className={cx("text-display")}>Waiting on you</h1>
          <p className={cx(["text-muted", layout.block3].join(" "))}>
            Direct actionable responsibilities requiring your decision or
            completion.
          </p>
        </div>
        <button
          onClick={loadWaitingItems}
          className={cx(["btn-secondary", layout.block4].join(" "))}
        >
          Refresh Queue
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className={cx(layout.block5)}>
        <div className={cx(layout.block6)}>
          {(["ALL", "OVERDUE", "APPROVALS", "DECISIONS", "TASKS"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={cx(
                  [
                    filterType === tab ? "btn-primary" : "btn-secondary",
                    layout.block7,
                  ].join(" "),
                )}
              >
                {tab === "ALL" && `All (${items.length})`}
                {tab === "OVERDUE" &&
                  `Overdue (${items.filter((i) => i.isOverdue).length})`}
                {tab === "APPROVALS" && `Approvals & Releases`}
                {tab === "DECISIONS" && `Client Decisions`}
                {tab === "TASKS" && `Tasks & Remediations`}
              </button>
            ),
          )}
        </div>

        <input
          type="text"
          placeholder="Filter by project, title or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cx(layout.block8)}
        />
      </div>

      {loading ? (
        <div className={cx(layout.block9)}>Loading queue...</div>
      ) : error ? (
        <div className={cx(["card", layout.block10].join(" "))}>
          <p className={cx(layout.block11)}>{error}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={cx(["card", layout.block12].join(" "))}>
          <h2 className={cx(layout.block13)}>Nothing waiting on you</h2>
          <p className={cx(layout.block14)}>
            You are fully up to date. No actions are currently pending your
            approval, decision, or completion.
          </p>
          <div className={cx(layout.block15)}>
            <Link href="/projects" className={cx("btn-secondary")}>
              View Active Projects &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <div className={cx(layout.block16)}>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cx(["card", layout.block17].join(" "))}
              style={{
                borderLeft: item.isOverdue
                  ? "4px solid var(--ui-danger)"
                  : item.urgency === "URGENT" || item.urgency === "HIGH"
                    ? "4px solid var(--ui-action)"
                    : "1px solid var(--ui-divider)",
              }}
            >
              <div className={cx(layout.block18)}>
                <div className={cx(layout.block19)}>
                  {item.isOverdue && (
                    <span
                      className={cx(
                        ["badge badge-error", layout.block20].join(" "),
                      )}
                    >
                      OVERDUE
                    </span>
                  )}
                  <span className={cx(["badge", layout.block21].join(" "))}>
                    {item.entityType.replace("_", " ")}
                  </span>
                  {item.projectCode && (
                    <span className={cx(layout.block22)}>
                      {item.projectCode}
                    </span>
                  )}
                  {item.projectName && (
                    <span className={cx(layout.block23)}>
                      &bull; {item.projectName}
                    </span>
                  )}
                </div>

                <div className={cx(layout.block24)}>{item.title}</div>

                <p className={cx(layout.block25)}>{item.description}</p>

                {item.dueDate && (
                  <div
                    style={{
                      color: item.isOverdue
                        ? "var(--ui-danger)"
                        : "var(--ui-text-muted)",
                    }}
                    className={cx(layout.block26)}
                  >
                    Target Deadline: {item.dueDate}
                  </div>
                )}
              </div>

              <div>
                <Link
                  href={item.link}
                  className={cx(["btn-primary", layout.block27].join(" "))}
                >
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
