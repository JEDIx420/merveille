"use client";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { Button, Field, readResponse } from "@/components/ui";
import styles from "./workspace.module.css";
export function InlineTask({
  task,
  field,
  children,
  members = [],
}: {
  task: any;
  field: "title" | "due" | "assignee";
  children: React.ReactNode;
  members?: any[];
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const personal = task.scope === "PERSONAL";
  const permitted = personal
    ? field !== "assignee"
    : field === "title"
      ? !!task.allowedActions?.assign
      : field === "due"
        ? !!task.allowedActions?.deadline
        : !!task.allowedActions?.assign;
  if (!permitted) return field === "title" ? null : <>{children}</>;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let url = "/api/my-tasks",
        body: any = {
          action: "update",
          personalTaskId: task.id,
          patch: {
            expectedRevision: task.revision,
            ...(field === "title"
              ? { title: value }
              : { dueDate: value || null }),
          },
        };
      if (!personal) {
        url = field === "title" ? "/api/studio" : `/api/tasks/${task.id}`;
        body =
          field === "title"
            ? {
                taskId: task.id,
                scope: "PROJECT",
                title: value,
                expectedRevision: task.revision,
              }
            : field === "due"
              ? {
                  action: "CHANGE_DEADLINE",
                  dueDate: value,
                  reason,
                  expectedRevision: task.revision,
                }
              : {
                  action: "ASSIGN",
                  assigneeUserId: value,
                  dueDate: task.dueDate,
                  reason,
                  expectedRevision: task.revision,
                };
      }
      await readResponse(
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setOpen(false);
      window.dispatchEvent(new Event("workspace:changed"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setValue(
            field === "title"
              ? task.title
              : field === "due"
                ? task.dueDate || ""
                : task.assigneeId || "",
          );
          setError("");
        }
      }}
    >
      <Popover.Trigger
        className={styles.chip}
        aria-label={`Edit ${field} for ${task.title}`}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          sideOffset={8}
          collisionPadding={16}
        >
          <form className={styles.stack} onSubmit={save}>
            <Field
              label={
                field === "title"
                  ? "Task title"
                  : field === "due"
                    ? "Due date"
                    : "Assignee"
              }
            >
              {field === "assignee" ? (
                <select
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                >
                  <option value="">Choose a person</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required={!personal || field === "title"}
                  type={field === "due" ? "date" : "text"}
                  maxLength={300}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            {!personal && field !== "title" && (
              <Field label="Reason">
                <input
                  required
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
            {field === "assignee" && !task.dueDate ? (
              <p>Set a due date before assigning from this view.</p>
            ) : (
              <Button disabled={busy} type="submit">
                {busy ? "Saving…" : "Save change"}
              </Button>
            )}
            {error && <p role="alert">{error}</p>}
            <Popover.Close type="button" className={styles.chip}>
              Cancel
            </Popover.Close>
          </form>
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
