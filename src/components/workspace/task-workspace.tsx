"use client";
import { useState, useEffect, useRef, useId } from "react";
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
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { List, Columns3, CalendarDays, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { StudioBoard } from "./studio-board";
import { Avatar } from "./studio-controls";
import { InlineTask } from "./inline-task";
import { useAppearance } from "@/components/experience/provider";
import { taskTemplates, labels } from "@/shared/studio/definitions";
type Item = TaskRef & {
  title: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  status: string;
  dueDate: string | null;
  assigneeName?: string;
  revision: number;
  assigneeId?: string;
  labels?: string[];
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
  const [labelFilter, setLabelFilter] = useState("");
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
  const viewOptionsId = useId();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const osReduce = useReducedMotion();
  const { appearance } = useAppearance();
  const reduce = osReduce || appearance.celebrations !== "full";
  const [group, setGroup] = useState("NONE"),
    [density, setDensity] = useState("COMFORTABLE"),
    [sort, setSort] = useState("DUE"),
    [savedViews, setSavedViews] = useState<any[]>([]),
    [viewName, setViewName] = useState(""),
    [template, setTemplate] = useState("");
  async function saveView() {
    try {
      const next = [
        ...savedViews.filter((v) => v.name !== viewName),
        {
          name: viewName,
          view,
          group,
          density,
          sort,
          search,
          filter,
          labelFilter,
          projectFilter,
          assigneeFilter,
        },
      ];
      await readResponse(
        await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: projectId || "personal",
            settings: { views: next },
          }),
        }),
      );
      setSavedViews(next);
      setViewName("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (!compact)
      fetch(`/api/studio?scope=${encodeURIComponent(projectId || "personal")}`)
        .then(readResponse)
        .then((d) => setSavedViews(d.views || []))
        .catch(() => {});
  }, [projectId, compact]);
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
              assigneeId: t.assignee_user_id,
              labels: JSON.parse(t.studio_labels || "[]"),
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
      (!labelFilter || t.labels?.includes(labelFilter)) &&
      (!projectFilter || t.projectId === projectFilter) &&
      (!assigneeFilter || t.assigneeName === assigneeFilter) &&
      (!search ||
        `${t.title} ${t.projectName || ""} ${t.assigneeName || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()))
    );
  });
  filtered.sort((a, b) =>
    sort === "TITLE"
      ? a.title.localeCompare(b.title)
      : (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
  );
  const visible = compact ? filtered.slice(0, 6) : filtered;
  const groups = new Map<string, Item[]>();
  for (const t of visible) {
    const key =
      group === "STATUS"
        ? t.status.replaceAll("_", " ").toLowerCase()
        : group === "ASSIGNEE"
          ? t.assigneeName || "Unassigned"
          : group === "DUE"
            ? t.dueDate
              ? t.dueDate < today
                ? "Overdue"
                : t.dueDate === today
                  ? "Today"
                  : "Upcoming"
              : "No due date"
            : "";
    groups.set(key, [...(groups.get(key) || []), t]);
  }
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
                    template: template || undefined,
                    proposedAssigneeId: assignee || undefined,
                    proposedDueDate: due || undefined,
                  }
                : {
                    title,
                    template: template || undefined,
                    dueDate: due || undefined,
                  },
            ),
          },
        ),
      );
      setTemplate("");
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
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <section
        className={[
          styles.workspace,
          density === "COMPACT" ? styles.compact : "",
        ].join(" ")}
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
                  {v === "LIST" ? (
                    <List size={15} />
                  ) : v === "BOARD" ? (
                    <Columns3 size={15} />
                  ) : (
                    <CalendarDays size={15} />
                  )}{" "}
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
        {!compact && (
          <>
            <button
              type="button"
              className={styles.optionsToggle}
              aria-expanded={optionsOpen}
              aria-controls={viewOptionsId}
              onClick={() => setOptionsOpen((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              View options
            </button>
            <div
              id={viewOptionsId}
              className={styles.viewTools}
              data-expanded={optionsOpen}
            >
              <select
                aria-label="Group tasks"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                {[
                  ["NONE", "No grouping"],
                  ["STATUS", "By status"],
                  ["ASSIGNEE", "By assignee"],
                  ["DUE", "By due date"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                aria-label="Task density"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
              >
                <option value="COMFORTABLE">Comfortable</option>
                <option value="COMPACT">Compact</option>
              </select>
              <select
                aria-label="Sort tasks"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="DUE">Due date</option>
                <option value="TITLE">Task name</option>
              </select>
              <select
                aria-label="Filter task labels"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
              >
                <option value="">All labels</option>
                {labels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <details>
                <summary className={styles.chip}>
                  <SlidersHorizontal size={14} />
                  Saved views
                </summary>
                <div className={styles.stack}>
                  {savedViews.map((v) => (
                    <button
                      className={styles.chip}
                      key={v.name}
                      onClick={() => {
                        setView(v.view);
                        setGroup(v.group);
                        setDensity(v.density);
                        setSort(v.sort);
                        setSearch(v.search);
                        setFilter(v.filter);
                        setLabelFilter(v.labelFilter || "");
                        setProjectFilter(v.projectFilter || "");
                        setAssigneeFilter(v.assigneeFilter || "");
                      }}
                    >
                      {v.name}
                    </button>
                  ))}
                  <div className={styles.inline}>
                    <input
                      aria-label="Save view as"
                      placeholder="Name this view"
                      maxLength={40}
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                    />
                    <Button
                      secondary
                      disabled={!viewName.trim() || savedViews.length >= 10}
                      onClick={saveView}
                    >
                      Save view
                    </Button>
                  </div>
                </div>
              </details>
              {!projectId && (
                <Link className={styles.chip} href="/waiting/automations">
                  Automations
                </Link>
              )}
            </div>
          </>
        )}
        {!team && !readOnly && (
          <form
            onSubmit={quick}
            className={[styles.inline, styles.quickAdd].join(" ")}
          >
            <input
              aria-label="Task name"
              placeholder={projectId ? "Add a task…" : "Add a private task…"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
            />
            <details className={styles.quickOptions}>
              <summary className={styles.chip}>Task details</summary>
              <div className={styles.stack}>
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
                {(!projectId || manager) && (
                  <select
                    aria-label="Task template"
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      if (!title)
                        setTitle(
                          taskTemplates.find((t) => t.name === e.target.value)
                            ?.title || "",
                        );
                    }}
                  >
                    <option value="">Blank task</option>
                    {taskTemplates.map((t) => (
                      <option key={t.name}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </details>
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
          <StudioBoard
            items={visible}
            columns={(filter === "CANCELLED"
              ? [["CANCELLED", "Cancelled"]]
              : columns
            ).filter(
              ([key]) =>
                key !== "PENDING_ASSIGNMENT" ||
                visible.some((t) => t.status === key),
            )}
            readOnly={readOnly}
            canMove={canMove}
            move={move}
            open={open}
          />
        ) : (
          <div>
            {Array.from(groups, ([heading, tasks]) => (
              <section key={heading}>
                {heading && (
                  <h3 className={styles.groupHeading}>
                    {heading}
                    <span>{tasks.length}</span>
                  </h3>
                )}
                <div className={styles.list}>
                  <div className={styles.listHeader}>
                    <span />
                    <span>Task name</span>
                    <span>Assignee</span>
                    <span>Due date</span>
                    <span>Status</span>
                  </div>
                  {tasks.map((t) => (
                    <motion.div
                      layout={!reduce}
                      transition={{ layout: { duration: 0.22 } }}
                      className={styles.row}
                      data-selected={panel.selectedId === t.id}
                      key={t.scope + t.id}
                    >
                      <button
                        type="button"
                        aria-label={`Open completion for ${t.title}`}
                        onClick={() =>
                          canMove(t, "COMPLETED")
                            ? move(
                                t,
                                t.status === "COMPLETED" ? "TODO" : "COMPLETED",
                              )
                            : open(t)
                        }
                      >
                        {t.status === "COMPLETED" ? "✓" : "○"}
                      </button>
                      <div className={styles.titleCell}>
                        <button
                          className={[
                            styles.taskTitle,
                            t.status === "COMPLETED" ? styles.done : "",
                          ].join(" ")}
                          onClick={() => open(t)}
                        >
                          {t.title}
                          <small>
                            {t.projectName || (!projectId ? "Only me" : "")}
                          </small>
                          {t.labels?.map((l) => (
                            <span className={styles.projectChip} key={l}>
                              {l}
                            </span>
                          ))}
                        </button>
                        <InlineTask task={t} field="title">
                          <span aria-hidden="true">✎</span>
                        </InlineTask>
                      </div>
                      <span className={styles.assignee}>
                        <InlineTask
                          task={t}
                          field="assignee"
                          members={participants}
                        >
                          <Avatar name={t.assigneeName || "Unassigned"} />
                          {t.assigneeName || "Unassigned"}
                        </InlineTask>
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
                        <InlineTask task={t} field="due">
                          {t.dueDate
                            ? formatBusinessDate(t.dueDate)
                            : "No date"}
                        </InlineTask>
                      </span>
                      <span className={[styles.muted, styles.status].join(" ")}>
                        {t.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {compact && filtered.length > 6 && (
          <a href="/waiting">View all {filtered.length} tasks</a>
        )}
      </section>
    </MotionConfig>
  );
}
