"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Badge, readResponse, EmptyState, LoadingState } from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";

interface MyTaskItem {
  id: string;
  scope: "PROJECT" | "PERSONAL";
  projectId: string | null;
  projectCode: string;
  projectName: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  sectionLabel: string | null;
  assigneeName: string;
  revision: number;
  link: string;
}

export function MyTasksPanel() {
  const [items, setItems] = useState<MyTaskItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [internalProjects, setInternalProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedTeamUserId, setSelectedTeamUserId] = useState("");
  const [promoteTaskId, setPromoteTaskId] = useState<string | null>(null);
  const [promoteProjectId, setPromoteProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"LIST" | "BOARD" | "CALENDAR">("LIST");
  const [bucket, setBucket] = useState<"ALL" | "UPCOMING" | "OVERDUE" | "COMPLETED">("ALL");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDue, setQuickDue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(teamId = selectedTeamUserId) {
    setLoading(true);
    setError("");
    try {
      const url = teamId ? `/api/my-tasks?teamUserId=${encodeURIComponent(teamId)}` : "/api/my-tasks";
      const res = await fetch(url);
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to load tasks");
      setItems(json.items || []);
      if (!teamId) {
        setTeamMembers(json.teamMembers || []);
        setInternalProjects(json.internalProjects || []);
        if (!promoteProjectId && json.internalProjects?.length) {
          setPromoteProjectId(json.internalProjects[0].id);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(selectedTeamUserId);
  }, [selectedTeamUserId]);

  async function handlePromote(personalTaskId: string) {
    if (!promoteProjectId) return;
    setError("");
    try {
      const res = await fetch("/api/my-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote",
          personalTaskId,
          projectId: promoteProjectId,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not move task to project");
      setPromoteTaskId(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/my-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          dueDate: quickDue || undefined,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not save task");
      setQuickTitle("");
      setQuickDue("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePersonalComplete(item: MyTaskItem) {
    if (item.scope !== "PERSONAL") return;
    const nextStatus = item.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      const res = await fetch("/api/my-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          personalTaskId: item.id,
          patch: { status: nextStatus, expectedRevision: item.revision },
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not update task");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filtered = items.filter((it) => {
    if (bucket === "OVERDUE") return it.isOverdue && it.status !== "COMPLETED";
    if (bucket === "COMPLETED") return it.status === "COMPLETED";
    if (bucket === "UPCOMING") return !it.isOverdue && it.status !== "COMPLETED" && it.status !== "CANCELLED";
    return true;
  });

  const boardColumns: { key: string; label: string; statuses: string[] }[] = [
    { key: "PENDING", label: "Pending assignment", statuses: ["PENDING_ASSIGNMENT"] },
    { key: "TODO", label: "To do", statuses: ["TODO"] },
    { key: "IN_PROGRESS", label: "In progress", statuses: ["IN_PROGRESS"] },
    { key: "BLOCKED", label: "Blocked", statuses: ["BLOCKED"] },
    { key: "COMPLETED", label: "Completed", statuses: ["COMPLETED"] },
  ];

  const datedItems = filtered.filter((i) => i.dueDate);
  const groupedByDate = datedItems.reduce<Record<string, MyTaskItem[]>>((acc, item) => {
    const key = item.dueDate!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 className="text-section">My Tasks</h2>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Canonical project assignments and private personal tasks in List, Board, or Calendar view.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {teamMembers.length > 0 && (
            <select
              aria-label="Task scope"
              value={selectedTeamUserId}
              onChange={(e) => setSelectedTeamUserId(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
            >
              <option value="">My Tasks (Personal + Shared)</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  Team: {tm.name} (Shared project tasks)
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }} role="tablist" aria-label="Task view mode">
            {(["LIST", "BOARD", "CALENDAR"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                className={view === mode ? "btn-primary" : "btn-secondary"}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
              >
                {mode === "LIST" ? "List" : mode === "BOARD" ? "Board" : "Calendar"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!selectedTeamUserId && (
      <form onSubmit={handleQuickAdd} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Quick add private personal task..."
          aria-label="Quick add private personal task"
          style={{ flex: "1 1 220px", padding: "0.45rem 0.7rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
        />
        <input
          type="date"
          value={quickDue}
          onChange={(e) => setQuickDue(e.target.value)}
          aria-label="Personal due date"
          style={{ padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
        />
        <Button type="submit" disabled={saving || !quickTitle.trim()}>
          {saving ? "Adding…" : "Add task"}
        </Button>
      </form>
      )}

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {(["ALL", "UPCOMING", "OVERDUE", "COMPLETED"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBucket(b)}
            className={bucket === b ? "btn-primary" : "btn-secondary"}
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
          >
            {b === "ALL" ? "All" : b === "UPCOMING" ? "Upcoming" : b === "OVERDUE" ? "Overdue" : "Completed"}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{ padding: "0.65rem 0.85rem", borderRadius: "6px", border: "1px solid var(--merveille-danger)", color: "var(--merveille-danger)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading your tasks…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No tasks in this view" description="Add a private task above or switch filters to see upcoming, overdue, or completed work." />
      ) : view === "LIST" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((item) => (
            <div
              key={`${item.scope}_${item.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--merveille-border)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
                {item.scope === "PERSONAL" && (
                  <input
                    type="checkbox"
                    checked={item.status === "COMPLETED"}
                    onChange={() => handleTogglePersonalComplete(item)}
                    aria-label={`Mark ${item.title} complete`}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 500, textDecoration: item.status === "COMPLETED" ? "line-through" : "none" }}>
                    {item.title}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    {item.projectCode} • {item.projectName}
                    {item.dueDate ? ` • Due ${formatBusinessDate(item.dueDate)}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                {item.isOverdue && <span className="badge badge-danger">Overdue</span>}
                <Badge>
                  {item.status.replace(/_/g, " ")}
                </Badge>
                {item.scope === "PROJECT" && (
                  <Link href={item.link} className="btn-secondary" style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}>
                    Open
                  </Link>
                )}
                {item.scope === "PERSONAL" && internalProjects.length > 0 && (
                  promoteTaskId === item.id ? (
                    <span style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
                      <select
                        aria-label="Target project"
                        value={promoteProjectId}
                        onChange={(e) => setPromoteProjectId(e.target.value)}
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
                      >
                        {internalProjects.map((p) => (
                          <option key={p.id} value={p.id}>{p.code} • {p.name}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-primary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handlePromote(item.id)}>
                        Move
                      </button>
                      <button type="button" className="btn-secondary" style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }} onClick={() => setPromoteTaskId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                      onClick={() => setPromoteTaskId(item.id)}
                    >
                      Move to project
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      ) : view === "BOARD" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" }}>
          {boardColumns.map((col) => {
            const colItems = filtered.filter((i) => col.statuses.includes(i.status));
            return (
              <div key={col.key} style={{ border: "1px solid var(--merveille-border)", borderRadius: "8px", padding: "0.65rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                  <span>{col.label}</span>
                  <span className="text-muted">{colItems.length}</span>
                </div>
                {colItems.map((item) => (
                  <div key={`${item.scope}_${item.id}`} style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", fontSize: "0.82rem" }}>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div className="text-muted" style={{ fontSize: "0.74rem", marginTop: "0.2rem" }}>
                      {item.projectCode} {item.dueDate ? `• ${item.dueDate}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {sortedDates.length === 0 ? (
            <EmptyState title="No dated tasks" description="Assign due dates to see tasks grouped on the calendar timeline." />
          ) : (
            sortedDates.map((d) => (
              <div key={d} style={{ border: "1px solid var(--merveille-border)", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                  {formatBusinessDate(d)} ({d})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {groupedByDate[d].map((item) => (
                    <div key={`${item.scope}_${item.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span>{item.title} <span className="text-muted">({item.projectCode})</span></span>
                      <Badge>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
