"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  user_id: string;
  project_id?: string;
  source_entity_type: string;
  source_entity_id: string;
  channel: string;
  title: string;
  body_text: string;
  target_url?: string;
  is_read: number;
  read_at?: number;
  status: string;
  created_at: number;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "READ">("ALL");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to load notifications");
      }
      const data = (await res.json()) as any;
      setNotifications(data.notifications || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id }),
      });
      if (!res.ok) {
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to mark read");
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1, read_at: Date.now() } : n))
      );
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "ALL") return true;
    if (filter === "UNREAD") return n.is_read === 0;
    if (filter === "READ") return n.is_read === 1;
    return true;
  });

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-200 mb-8">
        <div>
          <span className="text-xs uppercase tracking-widest text-stone-500 font-sans">
            SCR-20 • Activity & Reminders
          </span>
          <h1 className="text-3xl font-serif text-stone-900 mt-1">
            Notifications
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Timely operational reminders for drawings, pending decisions, and scheduled payments.
          </p>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <span className="text-xs font-sans uppercase tracking-wider px-3 py-1 bg-stone-100 text-stone-700 font-semibold rounded-full">
            {unreadCount} Unread
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-stone-200 mb-6 gap-6 text-xs font-sans uppercase tracking-wider">
        <button
          onClick={() => setFilter("ALL")}
          className={`pb-2.5 transition ${
            filter === "ALL"
              ? "border-b-2 border-stone-900 text-stone-900 font-semibold"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("UNREAD")}
          className={`pb-2.5 transition ${
            filter === "UNREAD"
              ? "border-b-2 border-stone-900 text-stone-900 font-semibold"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter("READ")}
          className={`pb-2.5 transition ${
            filter === "READ"
              ? "border-b-2 border-stone-900 text-stone-900 font-semibold"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-stone-400 font-sans text-sm">
          Loading notifications...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-stone-300 text-stone-400 text-sm">
          No notifications in this category.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                item.is_read === 0
                  ? "bg-white border-stone-300 shadow-sm"
                  : "bg-stone-50/60 border-stone-200 text-stone-600"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-sans">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.is_read === 0 ? "bg-amber-600" : "bg-transparent"
                    }`}
                  />
                  <span className="font-semibold text-stone-800 uppercase tracking-wider text-[10px]">
                    {item.source_entity_type}
                  </span>
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-400">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <h3 className="text-sm font-medium text-stone-900 font-sans">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-600 font-sans">
                  {item.body_text}
                </p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                {item.target_url && (
                  <Link
                    href={item.target_url}
                    className="px-3 py-1.5 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800 transition"
                  >
                    View Details →
                  </Link>
                )}

                {item.is_read === 0 && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    className="px-3 py-1.5 border border-stone-300 text-stone-700 text-xs font-sans hover:bg-stone-100 transition"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
