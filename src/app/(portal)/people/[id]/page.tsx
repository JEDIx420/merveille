"use client";
import { cx } from "@/components/utilities";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { AccessGrants, AccessProject } from "@/components/access-form";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  Field,
  Button,
  Badge,
  readResponse,
  useFeedback,
  ui,
} from "@/components/ui";
export default function Person({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const feedback = useFeedback();
  const [person, setPerson] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [projects, setProjects] = useState<AccessProject[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      const data = await readResponse(await fetch("/api/people"));
      const found = data.people.find((p: any) => p.id === id);
      if (!found) throw new Error("This account is unavailable.");
      setPerson(found);
      setOptions(data.projects || []);
      setRoles(found.roles);
      const grouped = new Map<string, AccessProject>();
      for (const p of found.projects || []) {
        let grant = grouped.get(p.project_id);
        if (!grant) {
          grant = {
            projectId: p.project_id,
            roles: [],
            financeAccess: !!p.finance_access,
            financeAuthor: !!p.finance_author,
            invoiceIssue: !!p.invoice_issue,
            contractualAuthority: !!p.contractual_authority,
          };
          grouped.set(p.project_id, grant);
        }
        grant.roles.push(p.project_role);
        grant.contractualAuthority ||= !!p.contractual_authority;
      }
      setProjects([...grouped.values()]);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  async function save(action: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readResponse(
        await fetch(`/api/people/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            roles,
            projects,
            reason,
            confirmElevation: confirm,
          }),
        }),
      );
      setNotice(
        action === "DISABLE"
          ? "Account disabled. Future portal access and downloads are denied."
          : "Access changes saved.",
      );
      setConfirm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!person)
    return error ? (
      <ErrorState message={error} retry={load} />
    ) : (
      <LoadingState label="Loading account permissions…" />
    );
  return (
    <div className={ui.page}>
      <Link href="/people">Back to people</Link>
      <PageHeader
        title={person.name}
        description={person.email}
        actions={<Badge>{person.status}</Badge>}
      />
      {error && <ErrorState message={error} />}{" "}
      {notice && (
        <p role="status" className={cx("status-note")}>
          {notice}
        </p>
      )}
      <form
        className={ui.form}
        onSubmit={(e) => {
          e.preventDefault();
          save("GRANTS");
        }}
      >
        <AccessGrants
          roles={roles}
          setRoles={setRoles}
          projects={projects}
          setProjects={setProjects}
          options={options}
          confirm={confirm}
          setConfirm={setConfirm}
        />
        <Field label="Reason for access change">
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className={ui.actions}>
          <Button disabled={busy || person.status === "DISABLED"} type="submit">
            {busy ? "Saving…" : "Save access changes"}
          </Button>
          {person.status !== "DISABLED" && (
            <Button
              secondary
              danger
              type="button"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                if (
                  await feedback.confirm(
                    `Disable ${person.name}'s account? They will lose future portal access and downloads. Historical work will be retained.`,
                  )
                )
                  save("DISABLE");
              }}
            >
              Disable account
            </Button>
          )}
        </div>
        <p className={ui.meta}>
          The last active administrator cannot be removed. Changes are audited
          and take effect on subsequent requests.
        </p>
      </form>
    </div>
  );
}
