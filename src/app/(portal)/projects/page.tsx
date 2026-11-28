"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ProjectMark } from "@/components/workspace/studio-controls";
import { Star, Columns3, List, LayoutGrid, Search } from "lucide-react";
import { PROJECT_STAGES } from "@/shared/project-onboarding";
import {
  StudioSelect,
  ToolPopover,
} from "@/components/workspace/view-controls";
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
    [view, setView] = useState("BOARD"),
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
  useEffect(() => {
    try {
      const saved = localStorage.getItem("merveille-project-view");
      if (["BOARD", "LIST", "CARDS"].includes(saved || "")) setView(saved!);
    } catch {}
  }, []);
  function changeView(next: string) {
    setView(next);
    try {
      localStorage.setItem("merveille-project-view", next);
    } catch {}
  }
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
  function stageName(p: any): string {
    return (
      PROJECT_STAGES.find(
        (s) =>
          s.toUpperCase().replaceAll(" ", "_") ===
          p.stage?.toUpperCase().replaceAll(" ", "_"),
      ) ||
      p.stage ||
      "Stage not set"
    );
  }
  function projectCard(p: any) {
    const stageIndex = PROJECT_STAGES.indexOf(
      stageName(p) as (typeof PROJECT_STAGES)[number],
    );
    return (
      <article
        key={p.id}
        className={view === "LIST" ? styles.portfolioRow : styles.portfolioCard}
      >
        <div className={styles.projectIdentity}>
          <ProjectMark name={p.id} />
          <div className={styles.projectHeading}>
            <span className={styles.muted}>{p.code}</span>
            <Link
              href={`/projects/${p.id}/${internal(p) ? "tasks" : "overview"}`}
            >
              <h2>{p.name}</h2>
            </Link>
          </div>
          <button
            className={styles.favoriteButton}
            disabled={saving}
            aria-pressed={favorites.includes(p.id)}
            aria-label={`${favorites.includes(p.id) ? "Unfavorite" : "Favorite"} ${p.name}`}
            onClick={() => favorite(p.id)}
          >
            <Star
              size={17}
              aria-hidden="true"
              fill={favorites.includes(p.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <div className={styles.projectBadges}>
          <span className={styles.stageBadge}>{stageName(p)}</span>
          <span className={styles.statusBadge} data-status={p.status}>
            {p.is_archived
              ? "Archived"
              : p.status === "DRAFT"
                ? "Setup pending"
                : p.status?.toLowerCase()}
          </span>
        </div>
        <div className={styles.projectManager}>
          <span className={styles.muted}>Manager</span>
          <span>{p.manager_name || "Unassigned"}</span>
        </div>
        {p.task_count !== undefined && (
          <div className={styles.projectProgress}>
            <div className={styles.progressCaption}>
              <span>
                {p.completed_count || 0} of {p.task_count} tasks
              </span>
              <span>
                {Math.round(
                  (100 * (p.completed_count || 0)) / Math.max(1, p.task_count),
                )}
                %
              </span>
            </div>
            <progress
              aria-label={`${p.name} progress`}
              className={styles.progress}
              max={p.task_count || 1}
              value={p.completed_count || 0}
            />
            <small className={styles.muted}>
              {p.next_deadline
                ? `Next due ${formatBusinessDate(p.next_deadline)}`
                : "No upcoming deadline"}
            </small>
          </div>
        )}
        {hasCapability(principal, "MANAGER", p.id) &&
          !p.is_archived &&
          stageIndex >= 0 && (
            <Link
              className={styles.reviewStage}
              href={`/projects/${p.id}/overview#project-stages`}
            >
              Review stage
            </Link>
          )}
      </article>
    );
  }
  const knownStages: readonly string[] = PROJECT_STAGES;
  const stages = [
    ...knownStages,
    ...Array.from(new Set(filtered.map(stageName))).filter(
      (s) => !knownStages.includes(s),
    ),
  ];
  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Projects"
        description="From first sketch to final handover."
        actions={
          canAdd && (
            <Link className="btn-primary" href="/projects/new">
              Add project
            </Link>
          )
        }
      />
      <div className={styles.portfolioToolbar}>
        <label className={styles.searchControl}>
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search projects"
            type="search"
            placeholder="Find a project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <ToolPopover
          label={`Filters${status !== "ALL" || archive ? ` (${Number(status !== "ALL") + Number(archive)})` : ""}`}
        >
          <StudioSelect
            aria-label="Project status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["ALL", "FAVORITES", "DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].map(
              (s) => (
                <option key={s} value={s}>
                  {s === "ALL"
                    ? "All projects"
                    : s === "DRAFT"
                      ? "Setup pending"
                      : s[0] + s.slice(1).toLowerCase()}
                </option>
              ),
            )}
          </StudioSelect>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
            />
            Include archived
          </label>
        </ToolPopover>
        <div className={styles.viewSwitcher} aria-label="Project views">
          {[
            ["BOARD", "Board", Columns3],
            ["LIST", "List", List],
            ["CARDS", "Cards", LayoutGrid],
          ].map(([v, label, Icon]: any) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => changeView(v)}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {(status !== "ALL" || archive) && (
        <div className={styles.activeFilters}>
          <span>
            {status !== "ALL"
              ? status === "DRAFT"
                ? "Setup pending"
                : status.toLowerCase()
              : "All statuses"}
            {archive ? " · Including archived" : ""}
          </span>
          <button
            onClick={() => {
              setStatus("ALL");
              setArchive(false);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {error && <ErrorState message={error} retry={load} />}
      {loading ? (
        <LoadingState label="Loading projects…" />
      ) : view === "BOARD" ? (
        <>
          <p className={styles.boardHint}>
            Architectural stages{" "}
            <span>Stage changes are reviewed in the project.</span>
          </p>
          <div
            className={styles.portfolioBoard}
            role="region"
            aria-label="Projects by architectural stage"
            tabIndex={0}
          >
            {stages.map((stage, i) => {
              const rows = filtered.filter((p) => stageName(p) === stage);
              return (
                <section
                  className={styles.stageColumn}
                  key={stage}
                  aria-label={stage}
                >
                  <header>
                    <span className={styles.stageNumber}>{i + 1}</span>
                    <h2>{stage}</h2>
                    <span className={styles.stageCount}>{rows.length}</span>
                  </header>
                  <div className={styles.stageContents}>
                    {rows.map(projectCard)}
                    {!rows.length && (
                      <div className={styles.stageEmpty}>
                        No projects at this stage
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : !filtered.length ? (
        <EmptyState
          title="No matching projects"
          description="Try another search or clear your filters."
        />
      ) : (
        <div
          className={
            view === "CARDS" ? styles.portfolioGrid : styles.portfolioList
          }
        >
          {filtered.map(projectCard)}
        </div>
      )}
    </div>
  );
}
