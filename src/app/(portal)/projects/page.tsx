"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  readResponse,
} from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";
import styles from "@/components/workspace/workspace.module.css";
export default function Projects() {
  const { principal } = useSession();
  const [projects, setProjects] = useState<any[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [view, setView] = useState("LIST"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [archive, setArchive] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const canAdd =
    hasCapability(principal, "ADMIN") ||
    hasCapability(principal, "OWNER") ||
    principal?.intakeAccess;
  async function load() {
    setLoading(true);
    try {
      const [p, pref] = await Promise.all([
        fetch(`/api/projects?includeArchived=${archive}`).then(readResponse),
        fetch("/api/workspace").then(readResponse),
      ]);
      setProjects(p.projects || []);
      setFavorites(pref.favorites || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [archive]);
  async function favorite(id: string) {
    setSaving(true);
    try {
      const next = favorites.includes(id)
        ? favorites.filter((x) => x !== id)
        : [...favorites, id];
      const d = await readResponse(
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorites: next }),
        }),
      );
      setFavorites(d.favorites);
      window.dispatchEvent(new Event("workspace:preferences"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const filtered = projects.filter(
    (p) =>
      (status === "ALL" ||
        (status === "FAVORITES" && favorites.includes(p.id)) ||
        status === p.status) &&
      `${p.name} ${p.code} ${p.site_location || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function internal(p: any) {
    return (
      hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "OWNER") ||
      principal?.projectMemberships.some(
        (m) =>
          m.projectId === p.id &&
          (m.roles || [m.projectRole]).some((r) =>
            ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""),
          ),
      )
    );
  }
  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Projects"
        description="A clear view of your current work."
        actions={
          canAdd && (
            <Link className="btn-primary" href="/projects/new">
              Add project
            </Link>
          )
        }
      />
      <div className={styles.toolbar}>
        <div className={styles.inline}>
          <input
            aria-label="Search projects"
            type="search"
            placeholder="Find a project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Project status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["ALL", "FAVORITES", "DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].map(
              (s) => (
                <option value={s} key={s}>
                  {s === "ALL"
                    ? "All projects"
                    : s === "DRAFT"
                      ? "Setup pending"
                      : s[0] + s.slice(1).toLowerCase()}
                </option>
              ),
            )}
          </select>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
            />
            Include archived
          </label>
        </div>
        <div className={styles.tabs}>
          {["LIST", "CARDS"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "LIST" ? "List" : "Cards"}
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorState message={error} retry={load} />}
      {loading ? (
        <LoadingState label="Loading projects…" />
      ) : !filtered.length ? (
        <EmptyState
          title="No matching projects"
          description="Try another search or add a project."
        />
      ) : (
        <div className={view === "CARDS" ? styles.projects : styles.stack}>
          {filtered.map((p) => (
            <article
              key={p.id}
              className={styles.projectCard}
              style={
                view === "LIST"
                  ? {
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      padding: "16px 20px",
                    }
                  : undefined
              }
            >
              <div className={styles.toolbar}>
                <Link
                  href={`/projects/${p.id}/${internal(p) ? "tasks" : "overview"}`}
                >
                  <span className={styles.muted}>{p.code}</span>
                  <h2>{p.name}</h2>
                </Link>
                <button
                  disabled={saving}
                  aria-pressed={favorites.includes(p.id)}
                  aria-label={`${favorites.includes(p.id) ? "Unfavorite" : "Favorite"} ${p.name}`}
                  onClick={() => favorite(p.id)}
                >
                  <Star
                    aria-hidden="true"
                    size={18}
                    fill={favorites.includes(p.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <p className={styles.muted}>
                {p.member_names?.slice(0, 3).join(", ") ||
                  p.manager_name ||
                  "No manager"}{" "}
                · {p.stage?.replaceAll("_", " ")}
              </p>
              {p.task_count !== undefined && (
                <div>
                  <progress
                    aria-label={`${p.name} progress`}
                    className={styles.progress}
                    max={p.task_count || 1}
                    value={p.completed_count || 0}
                  />
                  <small className={styles.muted}>
                    {p.completed_count || 0} of {p.task_count} completed
                    {p.next_deadline
                      ? ` · Next due ${formatBusinessDate(p.next_deadline)}`
                      : ""}
                  </small>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
