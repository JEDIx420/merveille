"use client";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Dialog,
  Button,
  Field,
  LoadingState,
  ErrorState,
  readResponse,
  useFeedback,
} from "@/components/ui";
import { formatBusinessTimestamp } from "@/shared/config";
import styles from "./workspace.module.css";
import { StudioTaskControls } from "./studio-controls";
export type TaskRef = {
  id: string;
  scope: "PROJECT" | "PERSONAL";
  target?: string;
};
const PanelContext = createContext<{open:(t:TaskRef)=>void;selectedId:string|null}>({ open: (_t: TaskRef) => {},selectedId:null });
export const useTaskPanel = () => useContext(PanelContext);
export function taskReference(href: string): TaskRef | null {
  try {
    const u = new URL(href, "https://workspace.invalid");
    const id =
      u.searchParams.get("taskId") || u.searchParams.get("personalTaskId");
    return id
      ? {
          id,
          scope: u.searchParams.has("personalTaskId") ? "PERSONAL" : "PROJECT",
        }
      : null;
  } catch {
    return null;
  }
}
export function TaskLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useTaskPanel();
  const task = taskReference(href);
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (task && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          panel.open(task);
        }
      }}
    >
      {children}
    </Link>
  );
}
export function TaskPanelProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<TaskRef | null>(null);
  return (
    <PanelContext.Provider value={{ open: setSelected,selectedId:selected?.id || null }}>
      {children}
      {selected && (
        <TaskPanel
          key={selected.scope + selected.id}
          selected={selected}
          close={() => setSelected(null)}
        />
      )}
    </PanelContext.Provider>
  );
}
function TaskPanel({
  selected,
  close,
}: {
  selected: TaskRef;
  close: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [action, setAction] = useState(selected.target || ""),
    [text, setText] = useState(""),
    [date, setDate] = useState(""),
    [person, setPerson] = useState("");
  const [comment, setComment] = useState(""),
    [check, setCheck] = useState(""),
    [child, setChild] = useState(""),
    [attachment, setAttachment] = useState("");
  const [participants, setParticipants] = useState<any[]>([]),
    [files, setFiles] = useState<any[]>([]),
    [projects, setProjects] = useState<any[]>([]),
    [project, setProject] = useState("");
  const feedback = useFeedback();
  async function requestClose() {
    if (
      (text.trim() || comment.trim() || check.trim() || child.trim()) &&
      !(await feedback.confirm("Discard unsaved task changes?"))
    )
      return;
    close();
  }
  const personal = selected.scope === "PERSONAL";
  const requestId = useRef(0);
  async function load() {
    const n = ++requestId.current;
    try {
      const d = await readResponse(
        await fetch(
          personal
            ? `/api/workspace?personalTaskId=${encodeURIComponent(selected.id)}`
            : `/api/tasks/${encodeURIComponent(selected.id)}`,
        ),
      );
      if (n !== requestId.current) return;
      setData(d);
      if (personal) {
        const result = await readResponse(await fetch("/api/my-tasks"));
        setProjects(result.internalProjects || []);
      } else if (d.allowedActions?.edit) {
        const [p, f] = await Promise.all([
          fetch(`/api/projects/${d.task.project_id}/participants`).then(
            readResponse,
          ),
          fetch(`/api/projects/${d.task.project_id}/files`).then(readResponse),
        ]);
        setParticipants(
          (p.participants || []).filter((m: any) =>
            m.roles?.some((r: string) =>
              [
                "MANAGER",
                "TEAM_MEMBER",
                "STAFF",
                "ARCHITECT",
                "DIRECTOR",
                "PROJECT_MANAGER",
              ].includes(r),
            ),
          ),
        );
        setFiles(f.files || []);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    window.addEventListener("workspace:changed", load);
    return () => {
      window.removeEventListener("workspace:changed", load);
      requestId.current++;
    };
  }, []);
  async function mutate(url: string, payload: any) {
    setBusy(true);
    setError("");
    try {
      await readResponse(
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      window.dispatchEvent(new Event("workspace:changed"));
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }
  const t = data?.task;
  const allowed = data?.allowedActions || {};
  const writable = personal ? t?.status !== "PROMOTED" : allowed.edit;
  const options = personal
    ? [
        ["TODO", "To do"],
        ["IN_PROGRESS", "In progress"],
        ["BLOCKED", "Blocked"],
        ["COMPLETED", "Complete"],
        ["CANCELLED", "Cancel task"],
      ]
    : [
        ...(allowed.start ? [["START", "Start work"]] : []),
        ...(allowed.complete ? [["COMPLETE", "Complete task"]] : []),
        ...(allowed.block ? [["BLOCK", "Block task"]] : []),
        ...(allowed.reopen ? [["REOPEN", "Reopen task"]] : []),
        ...(allowed.assign ? [["ASSIGN", "Assign task"]] : []),
        ...(allowed.deadline ? [["CHANGE_DEADLINE", "Change deadline"]] : []),
        ...(allowed.cancel ? [["CANCEL", "Cancel task"]] : []),
      ];
  async function saveAction(e: React.FormEvent) {
    e.preventDefault();
    const ok = personal
      ? await mutate("/api/my-tasks", {
          action: "update",
          personalTaskId: t.id,
          patch: { status: action, expectedRevision: t.revision },
        })
      : await mutate(`/api/tasks/${t.id}`, {
          action,
          expectedRevision: t.revision,
          reason: text,
          completionNote: text,
          category: "CORRECTION_DEFECT",
          assigneeUserId: person,
          dueDate: date,
        });
    if (ok) {
      setAction("");
      setText("");
    }
  }
  async function add(kind: string, value: string) {
    if (!value.trim()) return;
    const ok = await mutate(
      personal ? "/api/workspace" : `/api/tasks/${t.id}`,
      personal
        ? { action: kind, personalTaskId: t.id, text: value }
        : {
            action:
              kind === "comment"
                ? "ADD_COMMENT"
                : kind === "checklist"
                  ? "ADD_CHECKLIST"
                  : "CREATE_SUBTASK",
            commentText: value,
            label: value,
            title: value,
            attachmentFileId: attachment || undefined,
          },
    );
    if (ok) {
      if (kind === "comment") {
        setComment("");
        setAttachment("");
      } else if (kind === "checklist") setCheck("");
      else setChild("");
    }
  }
  return (
    <Dialog title={t?.title || "Task details"} onClose={requestClose} side>
      {!data ? (
        error ? (
          <ErrorState
            message={error}
            retry={() => {
              setError("");
              load();
            }}
          />
        ) : (
          <LoadingState label="Opening task…" />
        )
      ) : (
        <div className={styles.detail}>
          <StudioTaskControls id={selected.id} scope={selected.scope} editable={personal || !!allowed.assign || !!allowed.reopen}/>
          <div className={styles.muted}>
            {personal
              ? "Only you can see this task"
              : `${t.assignee_name || "Unassigned"} · Shared project task`}
          </div>
          <p>{t.description || "No description yet."}</p>
          <dl className={styles.facts}>
            <div>
              <dt>Status</dt>
              <dd>{t.status.replaceAll("_", " ").toLowerCase()}</dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{t.effective_due_date || t.due_date || "No date"}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{t.priority?.toLowerCase()}</dd>
            </div>
          </dl>
          {error && (
            <div role="alert" className={styles.error}>
              {error}
              <p>
                Your draft is kept. Review the task details before retrying.
              </p>
            </div>
          )}
          {options.length > 0 && (
            <form onSubmit={saveAction} className={styles.stack}>
              <Field label="Move to or update">
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  required
                >
                  <option value="">Choose an action…</option>
                  {options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              {action && (
                <>
                  {!personal &&
                    [
                      "COMPLETE",
                      "BLOCK",
                      "REOPEN",
                      "CHANGE_DEADLINE",
                      "CANCEL",
                    ].includes(action) && (
                      <Field
                        label={
                          action === "COMPLETE" ? "Completion note" : "Reason"
                        }
                      >
                        <textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          required
                          rows={2}
                        />
                      </Field>
                    )}
                  {!personal && action === "ASSIGN" && (
                    <Field label="Assign to">
                      <select
                        required
                        value={person}
                        onChange={(e) => setPerson(e.target.value)}
                      >
                        <option value="">Choose person</option>
                        {participants.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {!personal &&
                    ["ASSIGN", "CHANGE_DEADLINE"].includes(action) && (
                      <Field label="Due date">
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </Field>
                    )}
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save change"}
                  </Button>
                </>
              )}
            </form>
          )}
          {personal && (
            <details>
              <summary>Edit details</summary>
              <form
                key={t.revision}
                className={styles.stack}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await mutate("/api/my-tasks", {
                    action: "update",
                    personalTaskId: t.id,
                    patch: {
                      title: f.get("title"),
                      description: f.get("description"),
                      dueDate: f.get("date") || null,
                      expectedRevision: t.revision,
                    },
                  });
                }}
              >
                <Field label="Task name">
                  <input name="title" defaultValue={t.title} required />
                </Field>
                <Field label="Description">
                  <textarea
                    name="description"
                    defaultValue={t.description || ""}
                  />
                </Field>
                <Field label="Due date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={t.due_date || ""}
                  />
                </Field>
                <Button disabled={busy}>Save details</Button>
              </form>
            </details>
          )}
          <section className={styles.stack}>
            <h3>Checklist</h3>
            {(data.checklists || []).map((c: any) => (
              <label className={styles.check} key={c.id}>
                <input
                  type="checkbox"
                  checked={!!c.is_completed}
                  disabled={busy || !writable}
                  onChange={(e) =>
                    mutate(
                      personal ? "/api/workspace" : `/api/tasks/${t.id}`,
                      personal
                        ? {
                            action: "toggle",
                            personalTaskId: t.id,
                            itemId: c.id,
                            completed: e.target.checked,
                          }
                        : {
                            action: "TOGGLE_CHECKLIST",
                            itemId: c.id,
                            isCompleted: e.target.checked,
                          },
                    )
                  }
                />
                <span>{c.label}</span>
              </label>
            ))}
            {writable && (
              <form
                className={styles.inline}
                onSubmit={(e) => {
                  e.preventDefault();
                  add("checklist", check);
                }}
              >
                <input
                  aria-label="New checklist item"
                  placeholder="Add checklist item"
                  value={check}
                  onChange={(e) => setCheck(e.target.value)}
                  maxLength={300}
                />
                <Button secondary disabled={busy || !check.trim()}>
                  Add
                </Button>
              </form>
            )}
          </section>
          <section className={styles.stack}>
            <h3>Subtasks</h3>
            {data.subtasks?.map((c: any) => (
              <TaskLink
                key={c.id}
                href={
                  personal
                    ? `/waiting?personalTaskId=${c.id}`
                    : `/projects/${t.project_id}/tasks?taskId=${c.id}`
                }
              >
                {c.title}
              </TaskLink>
            ))}
            {!t.parent_task_id &&
              writable &&
              !["COMPLETED", "CANCELLED"].includes(t.status) && (
                <form
                  className={styles.inline}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (personal) {
                      if (
                        await mutate("/api/my-tasks", {
                          title: child,
                          parentTaskId: t.id,
                        })
                      )
                        setChild("");
                    } else add("subtask", child);
                  }}
                >
                  <input
                    aria-label="New subtask"
                    placeholder="Add subtask"
                    value={child}
                    onChange={(e) => setChild(e.target.value)}
                  />
                  <Button secondary disabled={busy || !child.trim()}>
                    Add
                  </Button>
                </form>
              )}
          </section>
          <section className={styles.stack}>
            <h3>Comments</h3>
            {data.comments?.map((c: any) => (
              <article key={c.id} className={styles.comment}>
                <strong>{c.author_name || "You"}</strong>
                <p>{c.comment_text || c.body_text}</p>
                {c.attachment_file_id && (
                  <Link href={`/api/files/${c.attachment_file_id}/download`}>
                    {c.attachment_name || "Attachment"}
                  </Link>
                )}
                <small className={styles.muted}>
                  {formatBusinessTimestamp(c.created_at)}
                </small>
              </article>
            ))}
            {writable && (
              <form
                className={styles.stack}
                onSubmit={(e) => {
                  e.preventDefault();
                  add("comment", comment);
                }}
              >
                <textarea
                  aria-label="Comment"
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={5000}
                  rows={3}
                />
                {!personal && files.length > 0 && (
                  <details>
                    <summary>Attach a project file</summary>
                    <select
                      aria-label="Comment attachment"
                      value={attachment}
                      onChange={(e) => setAttachment(e.target.value)}
                    >
                      <option value="">No attachment</option>
                      {files.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.file_name}
                        </option>
                      ))}
                    </select>
                  </details>
                )}
                <Button secondary disabled={busy || !comment.trim()}>
                  Add comment
                </Button>
              </form>
            )}
          </section>
          {personal && projects.length > 0 && t.status !== "PROMOTED" && (
            <details>
              <summary>Move to a project</summary>
              <p className={styles.muted}>
                This shares the task with the project. A manager confirms its
                assignment and deadline.
              </p>
              <form
                className={styles.stack}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await mutate("/api/my-tasks", {
                      action: "promote",
                      personalTaskId: t.id,
                      projectId: project,
                    })
                  )
                    close();
                }}
              >
                <select
                  required
                  aria-label="Target project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                >
                  <option value="">Choose project</option>
                  {projects.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button secondary disabled={busy || !project}>
                  Move to project
                </Button>
              </form>
            </details>
          )}
          {!personal && (
            <details>
              <summary>Activity history</summary>
              <div className={styles.stack}>
                {data.events?.map((e: any) => (
                  <p key={e.id}>
                    <strong>{e.actor_name}</strong>{" "}
                    {e.event_type
                      .replaceAll("TASK_", "")
                      .replaceAll("_", " ")
                      .toLowerCase()}
                    <br />
                    <small>
                      {e.reason} · {formatBusinessTimestamp(e.created_at)}
                    </small>
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}
