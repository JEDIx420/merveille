"use client";
import { CompanyAnnouncements } from "@/features/company-announcements";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PageHeader,
  Button,
  ErrorState,
  LoadingState,
  EmptyState,
  Field,
  Badge,
  ui,
  readResponse,
} from "@/components/ui";
import { formatBusinessTimestamp } from "@/shared/config";
export default function Notifications() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await readResponse(await fetch("/api/notifications"));
      setData(d);
      setEnabled(!!d.preferences?.whatsapp_enabled);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function update(payload: any) {
    setSaving(true);
    setError("");
    try {
      await readResponse(
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const items = (data?.notifications || []).filter(
    (n: any) =>
      filter === "ALL" ||
      (filter === "UNREAD" ? n.is_read === 0 : n.is_read === 1),
  );
  return (
    <div className={ui.page}>
      <PageHeader
        title="Notifications"
        description="Reminders and decisions across your permitted projects."
        actions={
          <a className="btn-secondary" href="#preferences">
            Notification preferences
          </a>
        }
      />
      {error && <ErrorState message={error} retry={load} />}
      <Field label="Show notifications">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All notifications</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
        </select>
      </Field>
      {loading ? (
        <LoadingState label="Loading notifications…" />
      ) : (
        data && (
          <section className={ui.panel}>
            {items.length ? (
              items.map((n: any) => (
                <div key={n.id} className={ui.row}>
                  <div>
                    <Badge>{n.is_read ? "Read" : "Unread"}</Badge>
                    <h3>{n.title}</h3>
                    <p>{n.body_text}</p>
                    <p className={ui.meta}>
                      {formatBusinessTimestamp(n.created_at)}
                    </p>
                  </div>
                  <div className={ui.actions}>
                    {n.target_url?.startsWith("/") &&
                      !n.target_url.startsWith("//") && (
                        <Link className="btn-primary" href={n.target_url}>
                          Open item
                        </Link>
                      )}
                    {!n.is_read && (
                      <Button
                        secondary
                        disabled={saving}
                        onClick={() =>
                          update({ action: "mark_read", notificationId: n.id })
                        }
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={
                  filter === "ALL"
                    ? "You're up to date"
                    : "No matching notifications"
                }
                description="New reminders appear here when there is something for you to do."
              />
            )}
          </section>
        )
      )}
      {data && (
        <section id="preferences" className={ui.panel}>
          <h2>Notification preferences</h2>
          <p>Portal reminders remain available in your workspace.</p>
          <p className={ui.meta}>
            {data.deliveryMode === "live"
              ? "WhatsApp delivery requires a verified contact and consent."
              : "WhatsApp delivery is unavailable until your administrator completes provider and contact setup. No messages are being sent."}
          </p>
          <form
            className={ui.form}
            onSubmit={(e) => {
              e.preventDefault();
              update({ action: "preferences", whatsappEnabled: enabled });
            }}
          >
            <label className={ui.checkbox}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              I consent to receive permitted project reminders through my
              verified WhatsApp contact.
            </label>
            <Button disabled={saving} type="submit">
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </form>
        </section>
      )}
      <CompanyAnnouncements />
    </div>
  );
}
