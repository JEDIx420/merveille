"use client";
import { useState, useEffect, useRef } from "react";
import {
  Button,
  LoadingState,
  EmptyState,
  readResponse,
} from "@/components/ui";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { useTaskPanel, TaskRef } from "./task-panel";
import { businessDateISO, formatBusinessDate } from "@/shared/config";
import styles from "./workspace.module.css";
type Item = TaskRef & {
  title: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  status: string;
  dueDate: string | null;
  assigneeName?: string;
  revision: number;
  allowedActions?: Record<string, boolean>;
};
const columns = [
  ["PENDING_ASSIGNMENT", "Pending assignment"],
  ["TODO", "To do"],
  ["IN_PROGRESS", "In progress"],
  ["BLOCKED", "Blocked"],
  ["COMPLETED", "Completed"],
];
export function TaskWorkspace({
  projectId,
  compact = false,
  readOnly = false,
}: {
  projectId?: string;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const panel = useTaskPanel();
  const { principal } = useSession();
  const manager = !!projectId && hasCapability(principal, "MANAGER", projectId);
  const [items, setItems] = useState<Item[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [participants, setParticipants] = useState<any[]>([]);
  const [team, setTeam] = useState(""),
    [view, setView] = useState("LIST"),
    [filter, setFilter] = useState(compact ? "UPCOMING" : "ALL"),
    [search, setSearch] = useState(""),
    [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [title, setTitle] = useState(""),
    [due, setDue] = useState(""),
    [assignee, setAssignee] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [cursor, setCursor] = useState(
      () => businessDateISO().slice(0, 7) + "-01",
    ),
    [span, setSpan] = useState("MONTH");
  const requestSeq = useRef(0);
  const [drag, setDrag] = useState<Item | null>(null);
  async function load() {
    const seq = ++requestSeq.current;
    try {
      const d = await readResponse(
        await fetch(
          projectId
            ? `/api/projects/${projectId}/tasks`
            : team
              ? `/api/my-tasks?teamUserId=${encodeURIComponent(team)}`
              : "/api/my-tasks",
        ),
      );
      if (seq !== requestSeq.current) return;
      setItems(
        projectId
          ? (d.tasks || []).map((t: any) => ({
              id: t.id,
              scope: "PROJECT",
              title: t.title,
              projectId,
              status: t.status,
              dueDate: t.effective_due_date,
              isOverdue: t.isOverdue,
              assigneeName: t.assignee_name || "Unassigned",
              revision: t.revision,
              allowedActions: t.allowedActions,
            }))
          : d.items || [],
      );
      if (!team) setMembers(d.teamMembers || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setLoading(true);
    load();
    const changed = () => load();
    window.addEventListener("workspace:changed", changed);
    return () => window.removeEventListener("workspace:changed", changed);
  }, [projectId, team]);
  useEffect(() => {
    if (!compact)
      fetch("/api/workspace")
        .then(readResponse)
        .then((p) => setView(p.view || "LIST"))
        .catch(() => {});
    if (projectId && !readOnly)
      fetch(`/api/projects/${projectId}/participants`)
        .then(readResponse)
        .then((d) =>
          setParticipants(
            (d.participants || []).filter((p: any) =>
              p.roles?.some((r: string) =>
                [
                  "MANAGER",
                  "STAFF",
                  "TEAM_MEMBER",
                  "PROJECT_MANAGER",
                  "ARCHITECT",
                  "DIRECTOR",
                ].includes(r),
              ),
            ),
          ),
        )
        .catch(() => {});
  }, [projectId]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get(projectId ? "taskId" : "personalTaskId");
    if (id) panel.open({ id, scope: projectId ? "PROJECT" : "PERSONAL" });
  }, [projectId]);
  const today = businessDateISO();
  const filtered = items.filter((t) => {
    const complete = t.status === "COMPLETED",
      cancel = t.status === "CANCELLED";
    if (filter === "COMPLETED" && !complete) return false;
    if (filter === "CANCELLED" && !cancel) return false;
    if (filter !== "CANCELLED" && cancel) return false;
    if (filter === "OVERDUE" && (complete || !t.dueDate || t.dueDate >= today))
      return false;
    if (
      filter === "UPCOMING" &&
      (complete || (!!t.dueDate && t.dueDate < today))
    )
      return false;
    return (
      (!projectFilter || t.projectId === projectFilter) &&
      (!assigneeFilter || t.assigneeName === assigneeFilter) &&
      (!search ||
        `${t.title} ${t.projectName || ""} ${t.assigneeName || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()))
    );
  });
  const visible = compact ? filtered.slice(0, 6) : filtered;
  function move(t: Item, target: string) {
    if (target === t.status) return;
    const a =
      target === "IN_PROGRESS"
        ? "START"
        : target === "COMPLETED"
          ? "COMPLETE"
          : target === "BLOCKED"
            ? "BLOCK"
            : target === "TODO"
              ? "REOPEN"
              : "";
    if (t.scope === "PERSONAL") {
      panel.open({ ...t, target });
      return;
    }
    if (a && t.allowedActions?.[a.toLowerCase()])
      panel.open({ ...t, target: a });
    else
      setError(
        "This move needs a different action or project manager. Open the task to see available actions.",
      );
  }
  function canMove(t: Item, target: string) {
    if (t.scope === "PERSONAL") return true;
    const k =
      target === "IN_PROGRESS"
        ? "start"
        : target === "COMPLETED"
          ? "complete"
          : target === "BLOCKED"
            ? "block"
            : target === "TODO"
              ? "reopen"
              : "";
    return !!t.allowedActions?.[k];
  }
  async function quick(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await readResponse(
        await fetch(
          projectId ? `/api/projects/${projectId}/tasks` : "/api/my-tasks",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              projectId
                ? {
                    title,
                    proposedAssigneeId: assignee || undefined,
                    proposedDueDate: due || undefined,
                  }
                : { title, dueDate: due || undefined },
            ),
          },
        ),
      );
      setTitle("");
      setDue("");
      window.dispatchEvent(new Event("workspace:changed"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const open = (t: Item) => panel.open(t);
  const dayCursor = new Date(cursor + "T00:00:00Z");
  const start = new Date(dayCursor);
  if (span === "MONTH") start.setUTCDate(1);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const days = Array.from({ length: span === "WEEK" ? 7 : 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  function advance(n: number) {
    const d = new Date(cursor + "T00:00:00Z");
    if (span === "WEEK") d.setUTCDate(d.getUTCDate() + n * 7);
    else {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + n);
    }
    setCursor(d.toISOString().slice(0, 10));
  }
  return (
    <section
      className={styles.workspace}
      aria-label={projectId ? "Project tasks" : "My tasks"}
    >
      <div className={styles.toolbar}>
        {compact ? (
          <h2>My tasks</h2>
        ) : (
          <h1>{projectId ? "Tasks" : "My Tasks"}</h1>
        )}
        {!compact && (
          <div className={styles.tabs} role="tablist" aria-label="Task view">
            {["LIST", "BOARD", "CALENDAR"].map((v) => (
              <button
                type="button"
                role="tab"
                tabIndex={view === v ? 0 : -1}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const tabs = Array.from(
                      e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                        "button",
                      ),
                    );
                    const index = tabs.indexOf(e.currentTarget);
                    const next =
                      tabs[
                        (index +
                          (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                          tabs.length
                      ];
                    next.focus();
                    next.click();
                  }
                }}
                key={v}
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  fetch("/api/workspace", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ view: v }),
                  }).catch(() => {});
                }}
              >
                {v[0] + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.tabs} aria-label="Task filters">
          {(compact
            ? ["UPCOMING", "OVERDUE", "COMPLETED"]
            : ["ALL", "UPCOMING", "OVERDUE", "COMPLETED", "CANCELLED"]
          ).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === filter}
              onClick={() => setFilter(f)}
            >
              {f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {!compact && (
          <div className={styles.inline}>
            {members.length > 0 && !projectId && (
              <select
                aria-label="Tasks for"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              >
                <option value="">My tasks</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="search"
              aria-label="Search tasks"
              placeholder="Find a task…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {projectId && (
              <select
                aria-label="Filter by assignee"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
              >
                <option value="">Everyone</option>
                {Array.from(
                  new Set(items.map((t) => t.assigneeName || "Unassigned")),
                ).map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            {!projectId && (
              <select
                aria-label="Filter by project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">All projects</option>
                {Array.from(
                  new Map(
                    items
                      .filter((t) => t.projectId)
                      .map((t) => [t.projectId, t]),
                  ).values(),
                ).map((t) => (
                  <option key={t.projectId} value={t.projectId}>
                    {t.projectName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      {!team && !readOnly && (
        <form onSubmit={quick} className={styles.inline}>
          <input
            aria-label="Task name"
            placeholder={projectId ? "Add a task…" : "Add a private task…"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
          />
          {(!projectId || manager) && (
            <input
              aria-label="New task due date"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          )}
          {manager && participants.length > 0 && (
            <select
              aria-label="New task assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button disabled={saving || !title.trim()} type="submit">
            {saving ? "Adding…" : "Add task"}
          </Button>
        </form>
      )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <Button secondary onClick={load}>
            Reload tasks
          </Button>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading tasks…" />
      ) : view === "CALENDAR" && !compact ? (
        <>
          <div className={styles.toolbar}>
            <div className={styles.inline}>
              <Button
                secondary
                onClick={() => advance(-1)}
                aria-label="Previous period"
              >
                ‹
              </Button>
              <strong>
                {new Date(cursor + "T00:00:00Z").toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </strong>
              <Button
                secondary
                onClick={() => advance(1)}
                aria-label="Next period"
              >
                ›
              </Button>
              <Button secondary onClick={() => setCursor(today)}>
                Today
              </Button>
            </div>
            <select
              aria-label="Calendar range"
              value={span}
              onChange={(e) => {
                setSpan(e.target.value);
                setCursor(today);
              }}
            >
              <option value="MONTH">Month</option>
              <option value="WEEK">Week</option>
            </select>
          </div>
          <div className={styles.calendar}>
            <div className={styles.calendarGrid}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span className={styles.weekLabel} key={d}>
                  {d}
                </span>
              ))}
              {days.map((d) => (
                <div
                  key={d}
                  className={[
                    styles.day,
                    d === today ? styles.today : "",
                    span === "MONTH" && d.slice(0, 7) !== cursor.slice(0, 7)
                      ? styles.outside
                      : "",
                  ].join(" ")}
                >
                  <strong>{Number(d.slice(-2))}</strong>
                  {visible
                    .filter((t) => t.dueDate === d)
                    .map((t) => (
                      <button key={t.id} onClick={() => open(t)}>
                        {t.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
          <p className={styles.muted}>
            {filtered.filter((t) => !t.dueDate).length} tasks without a date.
            Switch to List to see them.
          </p>
        </>
      ) : !visible.length ? (
        <EmptyState
          title="No tasks in this view"
          description="Add a task or choose a different filter."
        />
      ) : view === "BOARD" && !compact ? (
        <div className={styles.board}>
          {(filter === "CANCELLED" ? [["CANCELLED", "Cancelled"]] : columns)
            .filter(
              ([key]) =>
                key !== "PENDING_ASSIGNMENT" ||
                visible.some((t) => t.status === key),
            )
            .map(([key, label]) => (
              <section
                className={styles.column}
                key={key}
                aria-label={label}
                onDragOver={(e) => {
                  if (drag && canMove(drag, key)) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag) move(drag, key);
                  setDrag(null);
                }}
              >
                <h3>
                  {label}
                  <span>{visible.filter((t) => t.status === key).length}</span>
                </h3>
                {visible
                  .filter((t) => t.status === key)
                  .map((t) => (
                    <article
                      className={styles.card}
                      key={t.id}
                      draggable={
                        !readOnly &&
                        columns.some(([v]) => v !== t.status && canMove(t, v))
                      }
                      onDragStart={() => setDrag(t)}
                      onDragEnd={() => setDrag(null)}
                    >
                      <button
                        className={styles.taskTitle}
                        onClick={() => open(t)}
                      >
                        {t.title}
                      </button>
                      <p className={styles.muted}>
                        {t.projectName || t.assigneeName || "Private task"}
                      </p>
                      <p className={styles.muted}>
                        {t.dueDate
                          ? formatBusinessDate(t.dueDate)
                          : "No due date"}
                      </p>
                      {!readOnly &&
                        columns.some(
                          ([v]) => v !== t.status && canMove(t, v),
                        ) && (
                          <select
                            aria-label={`Move ${t.title}`}
                            value={t.status}
                            onChange={(e) => move(t, e.target.value)}
                          >
                            {columns
                              .filter(([v]) => v === t.status || canMove(t, v))
                              .map(([v, l]) => (
                                <option value={v} key={v}>
                                  {l}
                                </option>
                              ))}
                          </select>
                        )}
                    </article>
                  ))}
              </section>
            ))}
        </div>
      ) : (
        <div>
          {visible.map((t) => (
            <div className={styles.row} key={t.scope + t.id}>
              <button
                type="button"
                aria-label={`Open completion for ${t.title}`}
                onClick={() =>
                  canMove(t, "COMPLETED")
                    ? move(t, t.status === "COMPLETED" ? "TODO" : "COMPLETED")
                    : open(t)
                }
              >
                {t.status === "COMPLETED" ? "✓" : "○"}
              </button>
              <button
                className={[
                  styles.taskTitle,
                  t.status === "COMPLETED" ? styles.done : "",
                ].join(" ")}
                onClick={() => open(t)}
              >
                {t.title}
                <small>{t.projectName || (!projectId ? "Only me" : "")}</small>
              </button>
              <span className={styles.assignee}>
                {t.assigneeName || "Unassigned"}
              </span>
              <span
                className={
                  t.dueDate &&
                  t.dueDate < today &&
                  !["COMPLETED", "CANCELLED"].includes(t.status)
                    ? styles.overdue
                    : styles.muted
                }
              >
                {t.dueDate ? formatBusinessDate(t.dueDate) : "No date"}
              </span>
              <span className={[styles.muted, styles.status].join(" ")}>
                {t.status.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
      {compact && filtered.length > 6 && (
        <a href="/waiting">View all {filtered.length} tasks</a>
      )}
    </section>
  );
}
