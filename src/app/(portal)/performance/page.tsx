"use client";
import { cx } from "@/components/utilities";
import { readResponse } from "@/components/ui";
import layout from "./page.module.css";

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
      const res = await fetch(
        `/api/dashboard/performance?periodDays=${periodDays}`,
      );
      const json: any = await readResponse(res);
      if (res.status === 403) {
        setIsForbidden(true);
        throw new Error(json.error || "Forbidden: Owner access required.");
      }
      if (!res.ok)
        throw new Error(json.error || "Failed to load team performance");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (isForbidden) {
    return (
      <div className={cx(["card", layout.block1].join(" "))}>
        <h1 className={cx(layout.block2)}>Access Denied (403 Forbidden)</h1>
        <p className={cx(layout.block3)}>
          Individual performance scorecards and rework analytics are strictly
          restricted to the practice Owner. Team members, project managers, and
          administrators cannot view individual performance metrics.
        </p>
        <div className={cx(layout.block4)}>
          <Link href="/overview" className={cx("btn-secondary")}>
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cx(layout.block5)}>
      {/* Header */}
      <header className={cx(layout.block6)}>
        <div>
          <div className={cx(layout.block7)}>
            <h1 className={cx("text-display")}>Team Performance & Rework</h1>
            <span className={cx(["badge", layout.block8].join(" "))}>
              Owner Confidential
            </span>
          </div>
          <p className={cx(["text-muted", layout.block9].join(" "))}>
            Evidence-based deadline adherence, quality rework, and site
            milestone progress.
          </p>
        </div>

        {/* Period Selector */}
        <div className={cx(layout.block10)}>
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setPeriodDays(d)}
              className={cx(
                [
                  periodDays === d ? "btn-primary" : "btn-secondary",
                  layout.block11,
                ].join(" "),
              )}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </header>

      {/* Disclosed Transparent Metric Definitions () */}
      <section className={cx(["card", layout.block12].join(" "))}>
        <h2 className={cx(layout.block13)}>
          Transparent Metric Definitions & Fairness Principles
        </h2>
        <ul className={cx(layout.block14)}>
          <li>
            <strong>Deadline Adherence:</strong>{" "}
            {data?.definitions?.deadlineAdherence ||
              "Calculated against agreed baseline. Denominator: total completed tasks."}
          </li>
          <li>
            <strong>Rework vs Client Scope (Fairness):</strong>{" "}
            {data?.definitions?.reworkVsClientScope ||
              "Client-driven scope additions or variations are strictly separated from internal quality rework."}
          </li>
          <li>
            <strong>Site Progress:</strong>{" "}
            {data?.definitions?.siteProgress ||
              "Evaluated by verified stage completions, never fabricated from task checkboxes."}
          </li>
        </ul>
      </section>

      {loading ? (
        <div className={cx(layout.block15)}>Loading performance metrics...</div>
      ) : error ? (
        <div className={cx(["card", layout.block16].join(" "))}>
          <p className={cx(layout.block17)}>{error}</p>
        </div>
      ) : (
        <>
          {/* Team Table */}
          <section className={cx(["card", layout.block18].join(" "))}>
            <h2 className={cx(["text-section", layout.block19].join(" "))}>
              Staff & Team Member Metrics
            </h2>
            <div className={cx(layout.block20)}>
              <table className={cx(layout.block21)}>
                <thead>
                  <tr className={cx(layout.block22)}>
                    <th className={cx(layout.block23)}>Team Member</th>
                    <th className={cx(layout.block24)}>Role</th>
                    <th className={cx(layout.block25)}>Completed Tasks</th>
                    <th className={cx(layout.block26)}>On-Time Rate</th>
                    <th className={cx(layout.block27)}>Overdue Open</th>
                    <th className={cx(layout.block28)}>Internal Rework</th>
                    <th className={cx(layout.block29)}>
                      Client Scope Variations
                    </th>
                    <th className={cx(layout.block30)}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.teamMetrics || []).map((m: any) => (
                    <tr
                      key={m.userId}
                      style={{
                        backgroundColor:
                          selectedUser?.userId === m.userId
                            ? "var(--ui-surface-subtle)"
                            : "transparent",
                      }}
                      className={cx(layout.block31)}
                    >
                      <td className={cx(layout.block32)}>
                        {m.displayName}
                        <div className={cx(layout.block33)}>{m.email}</div>
                      </td>
                      <td className={cx(layout.block34)}>
                        <span
                          className={cx(["badge", layout.block35].join(" "))}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className={cx(layout.block36)}>
                        {m.completedTasksCount}
                      </td>
                      <td
                        style={{
                          color: m.onTimePercentage
                            ? "var(--ui-text)"
                            : "var(--ui-text-muted)",
                        }}
                        className={cx(layout.block37)}
                      >
                        {m.onTimePercentage || "N/A (0 completed)"}
                      </td>
                      <td
                        style={{
                          color:
                            m.overdueTasksCount > 0
                              ? "var(--ui-danger)"
                              : "inherit",
                        }}
                        className={cx(layout.block38)}
                      >
                        {m.overdueTasksCount}
                      </td>
                      <td
                        style={{
                          color:
                            m.reopenedTasksCount > 0
                              ? "var(--ui-text)"
                              : "inherit",
                        }}
                        className={cx(layout.block39)}
                      >
                        {m.reopenedTasksCount}
                      </td>
                      <td className={cx(layout.block40)}>
                        {m.clientScopeRevisionsCount} (client-driven)
                      </td>
                      <td className={cx(layout.block41)}>
                        <button
                          onClick={() =>
                            setSelectedUser(
                              selectedUser?.userId === m.userId ? null : m,
                            )
                          }
                          className={cx(
                            ["btn-secondary", layout.block42].join(" "),
                          )}
                        >
                          {selectedUser?.userId === m.userId
                            ? "Hide Evidence"
                            : "Inspect Evidence"}
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
            <section className={cx(["card", layout.block43].join(" "))}>
              <div className={cx(layout.block44)}>
                <div>
                  <h3 className={cx(layout.block45)}>
                    Evidence Log: {selectedUser.displayName}
                  </h3>
                  <p className={cx(layout.block46)}>
                    Underlying tasks, baseline deadlines, rework events, and
                    scope change context.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className={cx(["btn-secondary", layout.block47].join(" "))}
                >
                  Close
                </button>
              </div>

              {selectedUser.tasks.length === 0 ? (
                <p className={cx(layout.block48)}>
                  No tasks assigned in this evaluation period.
                </p>
              ) : (
                <div className={cx(layout.block49)}>
                  {selectedUser.tasks.map((t: any) => (
                    <div key={t.id} className={cx(layout.block50)}>
                      <div>
                        <div className={cx(layout.block51)}>
                          [{t.projectCode}] {t.title}
                        </div>
                        <div className={cx(layout.block52)}>
                          Original Due: {t.originalDueDate || "None"} &bull;
                          Current Due: {t.currentDueDate || "None"} &bull;
                          Status: {t.status}
                        </div>
                      </div>

                      <div className={cx(layout.block53)}>
                        {t.isClientScopeChange && (
                          <span
                            className={cx(["badge", layout.block54].join(" "))}
                          >
                            Client Scope Addition
                          </span>
                        )}
                        {t.reopenCount > 0 && (
                          <span
                            className={cx(
                              ["badge badge-error", layout.block55].join(" "),
                            )}
                          >
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
          <section className={cx(["card", layout.block56].join(" "))}>
            <h2 className={cx(["text-section", layout.block57].join(" "))}>
              Project Milestone & Stage Progress
            </h2>
            <div className={cx(layout.block58)}>
              <table className={cx(layout.block59)}>
                <thead>
                  <tr className={cx(layout.block60)}>
                    <th className={cx(layout.block61)}>Project</th>
                    <th className={cx(layout.block62)}>Stage</th>
                    <th className={cx(layout.block63)}>Status</th>
                    <th className={cx(layout.block64)}>Planned Target</th>
                    <th className={cx(layout.block65)}>Actual Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.projectStageProgress || []).map(
                    (s: any, idx: number) => (
                      <tr
                        key={`${s.projectId}_${idx}`}
                        className={cx(layout.block66)}
                      >
                        <td className={cx(layout.block67)}>
                          {s.projectCode} &bull; {s.projectName}
                        </td>
                        <td className={cx(layout.block68)}>{s.stageName}</td>
                        <td className={cx(layout.block69)}>
                          <span
                            className={cx(
                              [
                                `badge ${
                                  s.status === "COMPLETED"
                                    ? "badge-success"
                                    : s.status === "IN_PROGRESS"
                                      ? "badge-warning"
                                      : ""
                                }`,
                                layout.block70,
                              ].join(" "),
                            )}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className={cx(layout.block71)}>
                          {s.plannedCompletionDate || "Not set"}
                        </td>
                        <td
                          style={{
                            color: s.actualCompletionDate
                              ? "var(--ui-success)"
                              : "var(--ui-text-muted)",
                          }}
                          className={cx(layout.block72)}
                        >
                          {s.actualCompletionDate || "Pending"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
