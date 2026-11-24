"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { AccessGrants, AccessProject } from "@/components/access-form";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Dialog,
  Field,
  Button,
  Badge,
  readResponse,
  useFeedback,
  ui,
} from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";
export default function People() {
  const feedback = useFeedback();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [projects, setProjects] = useState<AccessProject[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await readResponse(await fetch("/api/people")));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await readResponse(
        await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            displayName: name,
            roles,
            projects,
            confirmElevation: confirm,
          }),
        }),
      );
      setResult(res);
      setCopied(false);
      setShow(false);
      setEmail("");
      setName("");
      setRoles([]);
      setProjects([]);
      setConfirm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function manage(id: string, action: string) {
    if (
      !(await feedback.confirm(
        action === "READY"
          ? "Confirm that an operator has added this exact invited email to the dedicated Cloudflare Access allowlist?"
          : "Update this invitation? Old invitation links will be invalidated.",
      ))
    )
      return;
    setBusy(true);
    try {
      const res = await readResponse(
        await fetch(`/api/invitations/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }),
      );
      if (res.invitationUrl) { setResult(res); setCopied(false); }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function retryAdmission() {
    setBusy(true);
    setError("");
    try {
      const admission = await readResponse(await fetch("/api/people/admission", { method: "POST" }));
      await load();
      if (admission.status !== "READY") setError("Invitation access is not ready yet. Retry shortly, or contact the person who set up this workspace.");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div className={ui.page}>
      <PageHeader
        title="People & access"
        description="Invite people and assign the permissions they need for their work."
        actions={
          data && <Button onClick={() => setShow(true)}>Invite person</Button>
        }
      />
      {error && <ErrorState message={error} retry={load} />}{" "}
      {result && (
        <section className={ui.panel}>
          <h2>Invitation created</h2>
          <p>
            {result.admissionStatus === "READY" ? "Access is ready. Copy and privately share the invitation link." : "Your invitation is saved. Access is being prepared before the recipient can join."} No invitation email has been sent.
          </p>
          <p className={ui.meta}>
            Copy the invitation link and share it privately with the intended
            recipient. It can only be accepted using their invited email address.
          </p>
          <div className={ui.actions}>
            <Button
              secondary
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    new URL(result.invitationUrl, location.origin).href,
                  );
                  setCopied(true);
                } catch {
                  setError(
                    "Unable to copy automatically. Use a browser that permits clipboard access.",
                  );
                }
              }}
            >
              {copied ? "Link copied" : "Copy invitation link"}
            </Button>
            <Button secondary onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </section>
      )}
      {loading ? (
        <LoadingState label="Loading people…" />
      ) : (
        data && (
          <>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Capabilities</th>
                    <th>Projects</th>
                    <th>Status</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people?.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.email}</small>
                      </td>
                      <td>
                        {p.roles?.length
                          ? p.roles.map((r: string) => (
                              <Badge key={r}>{r}</Badge>
                            ))
                          : "Project permissions only"}
                      </td>
                      <td>
                        {
                          new Set(p.projects?.map((m: any) => m.project_id))
                            .size
                        }
                      </td>
                      <td>
                        <Badge>{p.status}</Badge>
                      </td>
                      <td>
                        <Link href={`/people/${p.id}`}>Manage access</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.people?.length && (
                <EmptyState
                  title="No people yet"
                  description="Invite a person to start assigning access."
                />
              )}
            </div>
            <section className={ui.panel}>
              <h2>Invitations</h2>
              {data.invitations?.some((inv: any) => inv.status === "PENDING" && inv.admission_status !== "READY") && <Button secondary disabled={busy} onClick={retryAdmission}>Retry invitation access</Button>}
              {data.invitations?.length ? (
                data.invitations.map((inv: any) => (
                  <div className={ui.row} key={inv.id}>
                    <div>
                      <strong>{inv.display_name}</strong>
                      <p>{inv.email}</p>
                      <p className={ui.meta}>
                        Expires {formatBusinessDate(inv.expires_at)}
                      </p>
                      <Badge>
                        {inv.status === "PENDING" &&
                        inv.admission_status !== "READY"
                          ? "Awaiting access setup"
                          : inv.status}
                      </Badge>
                    </div>
                    <div className={ui.actions}>
                      {inv.status === "PENDING" &&
                        inv.admission_status !== "READY" && (
                          <Button
                            secondary
                            disabled={busy}
                            onClick={() => manage(inv.id, "READY")}
                          >
                            Confirm access setup
                          </Button>
                        )}
                      {inv.status !== "ACCEPTED" && (
                        <Button
                          secondary
                          disabled={busy}
                          onClick={() => manage(inv.id, "REISSUE")}
                        >
                          Reissue
                        </Button>
                      )}
                      {inv.status === "PENDING" && (
                        <Button
                          secondary
                          disabled={busy}
                          onClick={() => manage(inv.id, "REVOKE")}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No pending invitations"
                  description="Invitations and their actual setup status will appear here."
                />
              )}
            </section>
          </>
        )
      )}
      {show && (
        <Dialog title="Invite person" onClose={() => setShow(false)}>
          <form onSubmit={invite} className={ui.form}>
            {error && <ErrorState message={error} />}
            <Field label="Full name">
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field
              label="Exact email address"
              help="Use the email address they will sign in with. Company and personal mailboxes are supported; aliases stay separate."
            >
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <AccessGrants
              roles={roles}
              setRoles={setRoles}
              projects={projects}
              setProjects={setProjects}
              options={data?.projects || []}
              confirm={confirm}
              setConfirm={setConfirm}
            />
            <p className={ui.meta}>
              Invitation expires in 72 hours. Access setup and invitation
              delivery are recorded separately.
            </p>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating invitation…" : "Create invitation"}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
