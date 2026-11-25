"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  Button,
  Dialog,
  Field,
  ErrorState,
  ui,
  readResponse,
  useFeedback,
} from "@/components/ui";
export function AccountingForms({ onSaved }: { onSaved: () => void }) {
  const { principal } = useSession();
  const feedback = useFeedback();
  const [mode, setMode] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const admin = hasCapability(principal, "ADMIN");
  function value(key: string) {
    return values[key] || "";
  }
  function set(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }
  useEffect(() => {
    if (!mode) return;
    Promise.all([
      fetch("/api/projects").then(readResponse),
      fetch("/api/people").then(readResponse),
      fetch("/api/finance/periods").then(readResponse),
    ])
      .then(([p, u, r]) => {
        setProjects(p.projects || []);
        setPeople(u.people || []);
        setPeriods(r.periods || []);
      })
      .catch((e) => setError(e.message));
  }, [mode]);
  useEffect(() => {
    if (!value("projectId")) return;
    fetch(`/api/projects/${value("projectId")}/participants`)
      .then(readResponse)
      .then((d) => setParticipants(d.participants || []))
      .catch((e) => setError(e.message));
  }, [values.projectId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let path = "",
        payload: any = {};
      const amount = Math.round(Number(value("amount")) * 100);
      if (
        !["period", "close"].includes(mode) &&
        (!Number.isSafeInteger(amount) || amount <= 0)
      )
        throw new Error("Enter a positive amount.");
      if (mode === "expense") {
        path = "expenses";
        payload = {
          action: "SUBMIT",
          projectId: value("projectId") || undefined,
          description: value("description"),
          category: value("category"),
          supplierName: value("supplier"),
          amountMinor: amount,
          incurredDate: value("date"),
        };
      }
      if (mode === "consultant") {
        path = "consultants";
        payload = {
          action: "SUBMIT",
          projectId: value("projectId"),
          consultantUserId: value("userId"),
          billReference: value("reference"),
          discipline: value("discipline"),
          amountMinor: amount,
          billDate: value("date"),
        };
      }
      if (mode === "payroll") {
        path = "payroll";
        payload = {
          projectId: value("projectId") || undefined,
          userId: value("userId"),
          periodMonth: value("month"),
          grossSalaryMinor: amount,
        };
      }
      if (mode === "period") {
        path = "periods";
        payload = {
          action: "CREATE",
          periodLabel: value("label"),
          startDate: value("start"),
          endDate: value("end"),
        };
      }
      if (mode === "close") {
        if (
          !(await feedback.confirm(
            "Close this accounting period? Further postings within its dates will be blocked.",
          ))
        )
          return;
        path = "periods";
        payload = { action: "CLOSE", periodId: value("periodId") };
      }
      await readResponse(
        await fetch(`/api/finance/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setMode("");
      setValues({});
      setNotice("Record saved.");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!admin) return null;
  return (
    <>
      <div className={ui.actions}>
        {[
          ["expense", "Record expense"],
          ["consultant", "Record consultant bill"],
          ["payroll", "Record payroll"],
          ["period", "Create period"],
          ["close", "Close period"],
        ].map(([key, label]) => (
          <Button
            secondary={key !== "expense"}
            key={key}
            onClick={() => {
              setMode(key);
              setError("");
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {notice && (
        <p role="status" className="status-note">
          {notice}
        </p>
      )}
      {mode && (
        <Dialog
          title={
            {
              expense: "Record expense",
              consultant: "Record consultant bill",
              payroll: "Record payroll",
              period: "Accounting period",
              close: "Close accounting period",
            }[mode] || "Accounting record"
          }
          onClose={() => setMode("")}
        >
          <form className={ui.form} onSubmit={submit}>
            {error && <ErrorState message={error} />}{" "}
            {["expense", "consultant", "payroll"].includes(mode) && (
              <Field
                label={mode === "consultant" ? "Project" : "Project (optional)"}
              >
                <select
                  required={mode === "consultant"}
                  value={value("projectId")}
                  onChange={(e) => set("projectId", e.target.value)}
                >
                  <option value="">
                    {mode === "consultant"
                      ? "Select project"
                      : "Firm overhead / not project-specific"}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {mode === "expense" && (
              <>
                <Field label="Category">
                  <input
                    required
                    value={value("category")}
                    onChange={(e) => set("category", e.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    rows={3}
                    required
                    value={value("description")}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </Field>
                <Field label="Supplier (optional)">
                  <input
                    value={value("supplier")}
                    onChange={(e) => set("supplier", e.target.value)}
                  />
                </Field>
              </>
            )}
            {mode === "consultant" && (
              <>
                <Field label="Consultant">
                  <select
                    required
                    value={value("userId")}
                    onChange={(e) => set("userId", e.target.value)}
                  >
                    <option value="">Select assigned consultant</option>
                    {participants
                      .filter((p) => p.roles?.includes("CONSULTANT"))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Bill reference">
                  <input
                    required
                    value={value("reference")}
                    onChange={(e) => set("reference", e.target.value)}
                  />
                </Field>
                <Field label="Discipline">
                  <input
                    required
                    value={value("discipline")}
                    onChange={(e) => set("discipline", e.target.value)}
                  />
                </Field>
              </>
            )}
            {mode === "payroll" && (
              <>
                <Field label="Team member">
                  <select
                    required
                    value={value("userId")}
                    onChange={(e) => set("userId", e.target.value)}
                  >
                    <option value="">Select active team member</option>
                    {people
                      .filter(
                        (p) =>
                          p.status === "ACTIVE" &&
                          p.projects?.some((g: any) =>
                            ["TEAM_MEMBER", "STAFF", "MANAGER"].includes(
                              g.project_role,
                            ),
                          ),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Payroll month">
                  <input
                    type="month"
                    required
                    value={value("month")}
                    onChange={(e) => set("month", e.target.value)}
                  />
                </Field>
              </>
            )}
            {["expense", "consultant", "payroll"].includes(mode) && (
              <Field
                label={mode === "payroll" ? "Gross salary (₹)" : "Amount (₹)"}
              >
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={value("amount")}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </Field>
            )}
            {["expense", "consultant"].includes(mode) && (
              <Field label="Record date">
                <input
                  type="date"
                  required
                  value={value("date")}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
            )}
            {mode === "period" && (
              <>
                <Field label="Period label">
                  <input
                    required
                    value={value("label")}
                    onChange={(e) => set("label", e.target.value)}
                  />
                </Field>
                <Field label="Start date">
                  <input
                    required
                    type="date"
                    value={value("start")}
                    onChange={(e) => set("start", e.target.value)}
                  />
                </Field>
                <Field label="End date">
                  <input
                    required
                    type="date"
                    value={value("end")}
                    onChange={(e) => set("end", e.target.value)}
                  />
                </Field>
              </>
            )}
            {mode === "close" && (
              <Field label="Open accounting period">
                <select
                  required
                  value={value("periodId")}
                  onChange={(e) => set("periodId", e.target.value)}
                >
                  <option value="">Select period</option>
                  {periods
                    .filter((p) => !p.is_closed)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.period_label} · {p.start_date} to {p.end_date}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <div className={ui.actions}>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : mode === "close"
                    ? "Review period closure"
                    : "Save record"}
              </Button>
              <Button secondary type="button" onClick={() => setMode("")}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
