"use client";
import { useEffect, useState } from "react";
import { CompanyAnnouncements } from "@/features/company-announcements";
import {
  PageHeader,
  Button,
  LoadingState,
  EmptyState,
  ErrorState,
  readResponse,
} from "@/components/ui";
import { TaskLink } from "@/components/workspace/task-panel";
import { formatBusinessTimestamp } from "@/shared/config";
import styles from "@/components/workspace/workspace.module.css";
export default function Inbox() {
  const [items, setItems] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("UNREAD"),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const d = await readResponse(await fetch("/api/notifications"));
      setItems(d.notifications || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function read(id: string) {
    setBusy(true);
    try {
      await readResponse(
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", notificationId: id }),
        }),
      );
      setItems((old) =>
        old.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((n) => filter === "ALL" || !n.is_read);
  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Inbox"
        description="Updates and reminders from your projects."
      />
      <div className={styles.tabs}>
        {["UNREAD", "ALL"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "ALL"
              ? "All activity"
              : `Unread (${items.filter((n) => !n.is_read).length})`}
          </button>
        ))}
      </div>
      {error && <ErrorState message={error} retry={load} />}
      {loading ? (
        <LoadingState label="Loading Inbox…" />
      ) : visible.length ? (
        visible.map((n) => (
          <article
            className={[styles.inboxItem, !n.is_read ? styles.unread : ""].join(
              " ",
            )}
            key={n.id}
          >
            <div>
              <h3>{n.title}</h3>
              <p>{n.body_text}</p>
              <small className={styles.muted}>
                {formatBusinessTimestamp(n.created_at)}
              </small>
            </div>
            <div className={styles.inline}>
              {n.target_url?.startsWith("/") &&
                !n.target_url.startsWith("//") && (
                  <TaskLink className="btn-secondary" href={n.target_url}>
                    Open item
                  </TaskLink>
                )}
              {!n.is_read && (
                <Button secondary disabled={busy} onClick={() => read(n.id)}>
                  Mark read
                </Button>
              )}
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          title="You're up to date"
          description="New project activity will appear here."
        />
      )}
      <details>
        <summary className={styles.summary}>Company announcements</summary>
        <CompanyAnnouncements />
      </details>
    </div>
  );
}
