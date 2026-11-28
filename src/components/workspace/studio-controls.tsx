"use client";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { Button, readResponse } from "@/components/ui";
import { labels, taskTemplates } from "@/shared/studio/definitions";
import styles from "./workspace.module.css";
export function Avatar({ name }: { name: string }) {
  const color = Array.from(name).reduce((n, c) => n + c.charCodeAt(0), 0) % 4;
  return (
    <span className={styles.avatar} data-color={color} aria-hidden="true">
      {name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function StudioTaskControls({
  id,
  scope,
  editable,
}: {
  id: string;
  scope: "PROJECT" | "PERSONAL";
  editable: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [template, setTemplate] = useState("");
  async function load() {
    try {
      const d = await readResponse(
        await fetch(
          `/api/studio?taskId=${encodeURIComponent(id)}&scope=${scope}`,
        ),
      );
      setSelected(d.labels || []);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await readResponse(
        await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: id,
            scope,
            labels: selected,
            ...(template ? { template } : {}),
          }),
        }),
      );
      window.dispatchEvent(new Event("workspace:changed"));
      setError("");
      setTemplate("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Popover.Root
      onOpenChange={(v) => {
        if (v) load();
      }}
    >
      <Popover.Trigger className={styles.chip}>
        Labels & checklist
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          sideOffset={8}
          collisionPadding={16}
          aria-label="Task labels and templates"
        >
          <h3>Task details</h3>
          <fieldset disabled={!editable || busy}>
            <legend>Labels</legend>
            {labels.map((l) => (
              <label className={styles.check} key={l}>
                <input
                  type="checkbox"
                  checked={selected.includes(l)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, l]
                        : selected.filter((v) => v !== l),
                    )
                  }
                />
                {l}
              </label>
            ))}
          </fieldset>
          {editable && (
            <>
              <label>
                Apply checklist
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="">Keep existing checklist</option>
                  {taskTemplates.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save task details"}
              </Button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Popover.Close className={styles.chip}>Close</Popover.Close>
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function ProjectMark({ name }: { name: string }) {
  const color = Array.from(name).reduce((n, c) => n + c.charCodeAt(0), 0) % 4;
  return (
    <span className={styles.projectMark} data-color={color} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 20V8l8-4 8 4v12H4Z M4 12l8-4 8 4 M12 8v12 M8 14v6 M16 14v6" />
      </svg>
    </span>
  );
}
