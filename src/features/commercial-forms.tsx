"use client";
import { useState, useEffect } from "react";
import { useProject } from "@/components/project-context";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  Button,
  Dialog,
  Field,
  ErrorState,
  ui,
  readResponse,
} from "@/components/ui";
import { formatRupees } from "@/shared/config";
const minor = (v: string) => {
  const n = Number(v) * 100;
  if (!Number.isSafeInteger(Math.round(n)) || n <= 0)
    throw new Error("Enter a positive amount with at most two decimal places.");
  return Math.round(n);
};
export function CommercialForms({
  projectId,
  quotations,
  onSaved,
}: {
  projectId: string;
  quotations: any[];
  onSaved: () => void;
}) {
  const { principal } = useSession();
  const project = useProject();
  const [mode, setMode] = useState<"quote" | "schedule" | null>(null);
  const [title, setTitle] = useState("");
  const [advance, setAdvance] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState([
    {
      description: "",
      quantity: "1",
      rate: "",
      date: "",
      trigger: "DATE_ONLY",
      stage: "",
      isAdvance: false,
    },
  ]);
  const [stages, setStages] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const grant = principal?.projectMemberships.find(
    (m) => m.projectId === projectId,
  );
  const manager = hasCapability(principal, "MANAGER", projectId);
  useEffect(() => {
    if (mode === "schedule")
      fetch(`/api/projects/${projectId}`)
        .then(readResponse)
        .then((d) => setStages(d.stages || []))
        .catch((e) => setError(e.message));
  }, [mode, projectId]);
  function patch(i: number, key: string, value: any) {
    setLines(
      lines.map((l, index) => (index === i ? { ...l, [key]: value } : l)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        mode === "quote"
          ? {
              title,
              requiredAdvanceMinor: minor(advance),
              currency: "INR",
              items: lines.map((l) => ({
                description: l.description,
                quantity: Number(l.quantity),
                unitRateMinor: minor(l.rate),
              })),
            }
          : {
              quotationId: quoteId || undefined,
              reason,
              items: lines.map((l) => ({
                description: l.description,
                amountMinor: minor(l.rate),
                targetDate: l.date || undefined,
                triggerType: l.trigger,
                targetStageName: l.stage || undefined,
                isAdvance: l.isAdvance,
              })),
            };
      await readResponse(
        await fetch(
          `/api/projects/${projectId}/finance/${mode === "quote" ? "quotes" : "schedule"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        ),
      );
      setMode(null);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (
    project?.is_archived === 1 ||
    project?.status === "ARCHIVED" ||
    (!grant?.financeAuthor && !manager)
  )
    return null;
  return (
    <>
      <div className={ui.actions}>
        {grant?.financeAuthor && (
          <Button
            secondary
            onClick={() => {
              setError("");
              setMode("quote");
            }}
          >
            Prepare quotation
          </Button>
        )}
        {manager && (
          <Button
            secondary
            onClick={() => {
              setError("");
              setMode("schedule");
            }}
          >
            Create or revise schedule
          </Button>
        )}
      </div>
      {mode && (
        <Dialog
          title={mode === "quote" ? "Prepare quotation" : "Payment schedule"}
          onClose={() => setMode(null)}
        >
          <form className={ui.form} onSubmit={save}>
            {error && <ErrorState message={error} />}{" "}
            {mode === "quote" ? (
              <>
                <Field label="Quotation title">
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="Required advance (₹)">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                  />
                </Field>
                <p className={ui.meta}>
                  The main client must accept the quotation. An administrator
                  confirms the advance before the manager can activate work.
                </p>
              </>
            ) : (
              <>
                <Field label="Related quotation">
                  <select
                    value={quoteId}
                    onChange={(e) => setQuoteId(e.target.value)}
                  >
                    <option value="">Select quotation</option>
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} · Revision {q.version_number}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Schedule change reason">
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </Field>
              </>
            )}
            {lines.map((line, i) => (
              <fieldset key={i}>
                <legend>Item {i + 1}</legend>
                <div className={ui.form}>
                  <Field label="Description">
                    <input
                      required
                      value={line.description}
                      onChange={(e) => patch(i, "description", e.target.value)}
                    />
                  </Field>
                  {mode === "quote" && (
                    <Field label="Quantity">
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => patch(i, "quantity", e.target.value)}
                      />
                    </Field>
                  )}
                  <Field
                    label={
                      mode === "quote"
                        ? "Unit rate (₹)"
                        : "Scheduled amount (₹)"
                    }
                  >
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) => patch(i, "rate", e.target.value)}
                    />
                  </Field>
                  {mode === "schedule" && (
                    <>
                      <Field label="Payment trigger">
                        <select
                          value={line.trigger}
                          onChange={(e) => patch(i, "trigger", e.target.value)}
                        >
                          <option value="DATE_ONLY">
                            On the scheduled date
                          </option>
                          <option value="STAGE_ONLY">
                            On stage completion
                          </option>
                          <option value="DATE_AND_STAGE">
                            Date and stage completion required
                          </option>
                          <option value="DATE_OR_STAGE">
                            Date or stage completion
                          </option>
                        </select>
                      </Field>
                      {line.trigger !== "STAGE_ONLY" && (
                        <Field label="Scheduled date">
                          <input
                            required
                            type="date"
                            value={line.date}
                            onChange={(e) => patch(i, "date", e.target.value)}
                          />
                        </Field>
                      )}
                      {line.trigger !== "DATE_ONLY" && (
                        <Field label="Stage">
                          <select
                            required
                            value={line.stage}
                            onChange={(e) => patch(i, "stage", e.target.value)}
                          >
                            <option value="">Select project stage</option>
                            {stages.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <label className={ui.checkbox}>
                        <input
                          type="checkbox"
                          checked={line.isAdvance}
                          onChange={(e) =>
                            patch(i, "isAdvance", e.target.checked)
                          }
                        />
                        Advance payment item
                      </label>
                    </>
                  )}
                  {lines.length > 1 && (
                    <Button
                      secondary
                      type="button"
                      onClick={() =>
                        setLines(lines.filter((_, index) => index !== i))
                      }
                    >
                      Remove item
                    </Button>
                  )}
                </div>
              </fieldset>
            ))}
            <div className={ui.actions}>
              <Button
                secondary
                type="button"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      description: "",
                      quantity: "1",
                      rate: "",
                      date: "",
                      trigger: "DATE_ONLY",
                      stage: "",
                      isAdvance: false,
                    },
                  ])
                }
              >
                Add item
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : mode === "quote"
                    ? "Save quotation for acceptance"
                    : "Save schedule version"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
