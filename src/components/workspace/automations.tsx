"use client";
import { useEffect, useState } from "react";
import {
  Button,
  Field,
  Dialog,
  readResponse,
  LoadingState,
} from "@/components/ui";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  RuleDefinition,
  ruleTemplates,
  ruleSentence,
  labels,
} from "@/shared/studio/definitions";
import styles from "./workspace.module.css";
export function Automations({ projectId }: { projectId?: string }) {
  const { principal } = useSession();
  const manager = !projectId || hasCapability(principal, "MANAGER", projectId);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [name, setName] = useState(""),
    [definition, setDefinition] = useState<RuleDefinition>(
      structuredClone(ruleTemplates[0].definition),
    ),
    [simulation, setSimulation] = useState<any>(null),
    [members, setMembers] = useState<any[]>([]),
    [mode, setMode] = useState("TEMPLATE"),
    [prompt, setPrompt] = useState(""),
    [generic, setGeneric] = useState(false);
  async function load() {
    try {
      setData(
        await readResponse(
          await fetch(
            `/api/automations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
          ),
        ),
      );
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    if (projectId)
      fetch(`/api/projects/${projectId}/participants`)
        .then(readResponse)
        .then((d) =>
          setMembers(
            (d.participants || []).filter((m: any) =>
              m.roles?.some((r: string) =>
                ["MANAGER", "STAFF", "TEAM_MEMBER"].includes(r),
              ),
            ),
          ),
        )
        .catch(() => {});
  }, [projectId]);
  function update(d: RuleDefinition) {
    setDefinition(d);
    setSimulation(null);
  }
  async function command(operation: string, row?: any) {
    setBusy(true);
    setError("");
    try {
      const d = await readResponse(
        await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation,
            projectId,
            ...(row || editing
              ? {
                  id: (row || editing).id,
                  expectedRevision: (row || editing).revision,
                }
              : {}),
            name,
            definition,
          }),
        }),
      );
      if (operation === "simulate") setSimulation(d);
      else {
        setOpen(false);
        await load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row?: any) {
    setEditing(row || null);
    setName(row?.name || "");
    setDefinition(
      structuredClone(row?.definition || ruleTemplates[0].definition),
    );
    setSimulation(null);
    setOpen(true);
    setError("");
  }
  async function generate() {
    setBusy(true);
    try {
      const d = await readResponse(
        await fetch("/api/automation-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, genericOnly: generic }),
        }),
      );
      update(d.definition);
      setMode("BUILD");
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.workspace}>
      <div className={styles.toolbar}>
        <div>
          <h1>Automations</h1>
          <p className={styles.muted}>
            {projectId
              ? "Small rules that keep project work moving."
              : "Your private task routines."}
          </p>
        </div>
        <Button onClick={() => edit()}>Create rule</Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {data && !data.executionEnabled && (
        <p className={styles.notice}>
          Draft and test your rules here. Live execution is awaiting Free-plan
          verification.
        </p>
      )}
      {!data && !error ? (
        <LoadingState />
      ) : data?.rules.length ? (
        <div className={styles.stack}>
          {data.rules.map((r: any) => (
            <article className={styles.ruleCard} key={r.id}>
              <div>
                <h3>{r.name}</h3>
                <p>
                  {r.state === "ACTIVE" && r.published_revision !== r.revision
                    ? `Live: ${r.liveSentence}`
                    : r.sentence}
                </p>
                {r.published_revision &&
                  r.published_revision !== r.revision && (
                    <p className={styles.muted}>Draft: {r.sentence}</p>
                  )}
                <small className={styles.muted}>
                  {r.state.toLowerCase()} · draft v{r.revision}
                  {r.published_revision
                    ? ` · live v${r.published_revision}`
                    : ""}
                  {r.next_run_at
                    ? ` · next ${new Date(r.next_run_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
                    : ""}
                </small>
              </div>
              <div className={styles.inline}>
                <Button secondary onClick={() => edit(r)}>
                  Edit
                </Button>
                {manager && r.state === "ACTIVE" && (
                  <Button
                    secondary
                    disabled={busy}
                    onClick={() => command("pause", r)}
                  >
                    Pause
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.ruleCard}>
          <div>
            <h2>Start with one useful routine</h2>
            <p className={styles.muted}>
              Reminders, recurring site reviews and coordination handoffs. You
              decide what runs.
            </p>
          </div>
        </div>
      )}
      {data?.runs.length > 0 && (
        <div className={styles.stack}>
          <h2>Recent activity</h2>
          {data.runs.map((r: any) => (
            <div key={r.id} className={styles.ruleCard}>
              <div>
                <strong>
                  {data.rules.find((v: any) => v.id === r.rule_id)?.name}
                </strong>
                <p>{r.detail}</p>
                <small>
                  {new Date(r.created_at).toLocaleString("en-IN")} ·{" "}
                  {r.status.toLowerCase()}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Dialog
          title={editing ? "Edit rule" : "Create a rule"}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className={styles.stack}>
            <div className={styles.tabs}>
              {[
                ["TEMPLATE", "Use a template"],
                ["AI", "Describe a rule"],
                ["BUILD", "Build a rule"],
              ].map(([v, l]) => (
                <button
                  aria-pressed={mode === v}
                  key={v}
                  onClick={() => setMode(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            {mode === "TEMPLATE" && (
              <div className={styles.templateGrid}>
                {ruleTemplates.map((t) => (
                  <button
                    key={t.name}
                    className={styles.templateCard}
                    onClick={() => {
                      setName(t.name);
                      update(structuredClone(t.definition));
                      setMode("BUILD");
                    }}
                  >
                    <strong>{t.name}</strong>
                    <span>{ruleSentence(t.definition)}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === "AI" ? (
              <>
                <p className={styles.muted}>
                  Describe a generic workflow. Do not include actual names,
                  company details, addresses, task text or documents. Choose
                  real people and projects in the builder afterward.
                </p>
                <Field label="Text sent to Gemini">
                  <textarea
                    maxLength={1000}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setGeneric(false);
                    }}
                    placeholder="Every Monday, create a site review task due in two days."
                  />
                </Field>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={generic}
                    onChange={(e) => setGeneric(e.target.checked)}
                  />
                  I reviewed this text; it contains only a generic workflow.
                </label>
                <Button
                  disabled={busy || !generic || !prompt.trim()}
                  onClick={generate}
                >
                  Generate draft
                </Button>
              </>
            ) : (
              <>
                <Field label="Rule name">
                  <input
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="When">
                  <select
                    value={definition.trigger}
                    onChange={(e) =>
                      update({
                        ...definition,
                        trigger: e.target.value as RuleDefinition["trigger"],
                      })
                    }
                  >
                    {[
                      ["WEEKLY", "Every week"],
                      ["TASK_COMPLETED", "A task is completed"],
                      ["DUE_SOON", "A task is due in two days"],
                      ["OVERDUE", "A task becomes overdue"],
                      ...(projectId
                        ? [["DRAWING_RELEASED", "A drawing is released"]]
                        : []),
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                {definition.trigger === "WEEKLY" && (
                  <div className={styles.inline}>
                    <Field label="Day">
                      <select
                        value={definition.weekday}
                        onChange={(e) =>
                          update({
                            ...definition,
                            weekday: Number(e.target.value),
                          })
                        }
                      >
                        {[
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ].map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Hour (IST)">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={definition.hour}
                        onChange={(e) =>
                          update({
                            ...definition,
                            hour: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
                {!["WEEKLY", "DRAWING_RELEASED"].includes(
                  definition.trigger,
                ) && (
                  <Field label="Only tasks with label">
                    <select
                      value={definition.condition.label || ""}
                      onChange={(e) =>
                        update({
                          ...definition,
                          condition: e.target.value
                            ? { label: e.target.value }
                            : {},
                        })
                      }
                    >
                      <option value="">Any label</option>
                      {labels.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </Field>
                )}
                {definition.actions.map((a, i) => (
                  <fieldset key={i} className={styles.actionGroup}>
                    <legend>Then {i + 1}</legend>
                    <Field label="Action">
                      <select
                        value={a.type}
                        onChange={(e) =>
                          update({
                            ...definition,
                            actions: definition.actions.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    type: e.target.value as typeof a.type,
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        <option value="CREATE_TASK">Create a task</option>
                        <option value="REMIND">
                          Send an internal reminder
                        </option>
                        {!["WEEKLY", "DRAWING_RELEASED"].includes(
                          definition.trigger,
                        ) && <option value="LABEL">Add a task label</option>}
                      </select>
                    </Field>
                    <Field
                      label={
                        a.type === "REMIND" ? "Reminder text" : "Task title"
                      }
                    >
                      <input
                        maxLength={300}
                        value={a.title}
                        onChange={(e) =>
                          update({
                            ...definition,
                            actions: definition.actions.map((v, j) =>
                              j === i ? { ...v, title: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </Field>
                    {projectId && a.type !== "LABEL" && (
                      <Field
                        label={
                          a.type === "CREATE_TASK" ? "Assign to" : "Notify"
                        }
                      >
                        <select
                          value={a.assigneeId || ""}
                          onChange={(e) =>
                            update({
                              ...definition,
                              actions: definition.actions.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      assigneeId: e.target.value || undefined,
                                    }
                                  : v,
                              ),
                            })
                          }
                        >
                          <option value="">
                            {a.type === "CREATE_TASK"
                              ? "Choose a person"
                              : "Task assignee, or rule author"}
                          </option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {a.type === "CREATE_TASK" && (
                      <Field label="Due in days">
                        <input
                          type="number"
                          min={0}
                          max={90}
                          value={a.dueDays}
                          onChange={(e) =>
                            update({
                              ...definition,
                              actions: definition.actions.map((v, j) =>
                                j === i
                                  ? { ...v, dueDays: Number(e.target.value) }
                                  : v,
                              ),
                            })
                          }
                        />
                      </Field>
                    )}
                    {a.type === "LABEL" && (
                      <Field label="Label">
                        <select
                          value={a.label || ""}
                          onChange={(e) =>
                            update({
                              ...definition,
                              actions: definition.actions.map((v, j) =>
                                j === i ? { ...v, label: e.target.value } : v,
                              ),
                            })
                          }
                        >
                          <option value="">Choose label</option>
                          {labels.map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {definition.actions.length > 1 && (
                      <Button
                        secondary
                        onClick={() =>
                          update({
                            ...definition,
                            actions: definition.actions.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        Remove action
                      </Button>
                    )}
                  </fieldset>
                ))}
                {definition.actions.length < 3 && (
                  <Button
                    secondary
                    onClick={() =>
                      update({
                        ...definition,
                        actions: [
                          ...definition.actions,
                          {
                            type: "REMIND",
                            title: "Follow up on this task",
                            dueDays: 0,
                          },
                        ],
                      })
                    }
                  >
                    Add action
                  </Button>
                )}
                <p className={styles.notice}>{ruleSentence(definition)}</p>
                {simulation && (
                  <div role="status" className={styles.notice}>
                    <strong>
                      Preview: {simulation.matches.length} matching samples
                    </strong>
                    {simulation.matches.map((m: any) => (
                      <p key={m.key}>{m.title}</p>
                    ))}
                    <p>{simulation.notice}</p>
                  </div>
                )}
                <div className={styles.inline}>
                  <Button
                    secondary
                    disabled={busy}
                    onClick={() => command("simulate")}
                  >
                    Test rule
                  </Button>
                  <Button
                    secondary
                    disabled={busy || !name.trim()}
                    onClick={() => command("save")}
                  >
                    Save draft
                  </Button>
                  {manager && (
                    <Button
                      disabled={busy || !simulation || !data?.executionEnabled}
                      onClick={() => command("publish")}
                    >
                      Publish rule
                    </Button>
                  )}
                </div>
                <p className={styles.muted}>
                  {projectId
                    ? "Project managers publish routine actions. Approvals and publication remain human decisions."
                    : "Only your private tasks and reminders are affected."}{" "}
                  Schedules are checked every 15 minutes.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
