"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  Button,
  Dialog,
  Field,
  ErrorState,
  EmptyState,
  Badge,
  ui,
  readResponse,
  useFeedback,
} from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";
export function CompanyAnnouncements() {
  const { principal } = useSession();
  const feedback = useFeedback();
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const canPrepare =
    hasCapability(principal, "ADMIN") || hasCapability(principal, "MANAGER");
  const canPublish = hasCapability(principal, "MANAGER");
  async function load() {
    try {
      const d = await readResponse(await fetch("/api/announcements"));
      setItems(d.announcements || []);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function open() {
    setShow(true);
    try {
      const d = await readResponse(await fetch("/api/projects"));
      setProjects(d.projects || []);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await readResponse(
        await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CREATE",
            title,
            bodyText: body,
            audienceType: "SELECTED_PROJECTS",
            targetProjectIds: selected,
          }),
        }),
      );
      setShow(false);
      setTitle("");
      setBody("");
      setSelected([]);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function publish(id: string) {
    if (
      !(await feedback.confirm(
        "Publish this company announcement to its selected project audience?",
      ))
    )
      return;
    setBusy(true);
    try {
      await readResponse(
        await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "PUBLISH", announcementId: id }),
        }),
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={ui.panel}>
      <div className={ui.header}>
        <h2>Company announcements</h2>
        {canPrepare && (
          <Button secondary onClick={open}>
            Prepare announcement
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} retry={load} />}{" "}
      {items.length ? (
        items.map((item) => (
          <article className={ui.row} key={item.id}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body_text}</p>
              <p className={ui.meta}>
                {formatBusinessDate(item.published_at || item.created_at)}
              </p>
              {canPrepare && <Badge>{item.status}</Badge>}
            </div>
            {canPublish && item.status === "DRAFT" && (
              <Button disabled={busy} onClick={() => publish(item.id)}>
                Publish announcement
              </Button>
            )}
          </article>
        ))
      ) : (
        <EmptyState
          title="No announcements"
          description="Company notices shared with your audience will appear here."
        />
      )}
      {show && (
        <Dialog
          title="Prepare company announcement"
          onClose={() => setShow(false)}
        >
          <form className={ui.form} onSubmit={save}>
            {error && <ErrorState message={error} />}
            <Field label="Title">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Announcement">
              <textarea
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <fieldset>
              <legend>Project audience</legend>
              {projects.map((p) => (
                <label className={ui.checkbox} key={p.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
            </fieldset>
            <p className={ui.meta}>
              Saved as a draft. Publishing requires the separately granted
              company announcement capability.
            </p>
            <Button disabled={busy || !selected.length} type="submit">
              {busy ? "Saving…" : "Save draft"}
            </Button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
