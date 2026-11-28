"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, UserRound, FolderOpen, ChevronRight } from "lucide-react";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { canReadInternalNotes } from "@/server/auth/policy";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  readResponse,
} from "@/components/ui";
import styles from "@/components/workspace/workspace.module.css";
export default function AutomationHub() {
  const { principal } = useSession();
  const [projects, setProjects] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const internal =
    !!principal &&
    (hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "OWNER") ||
      principal.projectMemberships.some((m) =>
        (m.roles || [m.projectRole]).some((r) =>
          ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""),
        ),
      ));
  async function load() {
    setLoading(true);
    try {
      const d = await readResponse(await fetch("/api/projects"));
      setProjects(d.projects || []);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (internal) load();
    else setLoading(false);
  }, [internal]);
  if (!internal)
    return (
      <div className={styles.workspace}>
        <PageHeader title="Automations" />
        <p>Automations are available to internal workspace members.</p>
      </div>
    );
  const permitted = projects.filter(
    (p) => !p.is_archived && canReadInternalNotes(principal, p.id),
  );
  return (
    <div className={styles.workspace}>
      <PageHeader
        title="Automations"
        description="Give recurring work a reliable routine."
      />
      <div className={styles.automationIntro}>
        <Zap size={22} aria-hidden="true" />
        <div>
          <strong>Start with a template or build your own</strong>
          <p>
            Choose where your rule belongs. Test it before publishing. Live
            execution and AI drafting remain unavailable in this Preview.
          </p>
        </div>
      </div>
      <Link className={styles.automationScope} href="/waiting/automations">
        <UserRound size={20} aria-hidden="true" />
        <div>
          <h2>My routines</h2>
          <p>Private rules for your own tasks and reminders.</p>
        </div>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
      <h2 className={styles.sectionTitle}>Project rules</h2>
      <p className={styles.muted}>
        Shared rules are drafted by the team and published by the assigned
        manager.
      </p>
      {loading ? (
        <LoadingState label="Loading project scopes…" />
      ) : error ? (
        <ErrorState message={error} retry={load} />
      ) : permitted.length ? (
        <div className={styles.automationScopes}>
          {permitted.map((p) => (
            <Link
              key={p.id}
              className={styles.automationScope}
              href={`/projects/${p.id}/automations`}
            >
              <FolderOpen size={20} aria-hidden="true" />
              <div>
                <span className={styles.muted}>{p.code}</span>
                <h2>{p.name}</h2>
                <p>{p.stage}</p>
              </div>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>
          Project rules appear here when you have an internal project
          assignment. You can start with a private routine.
        </p>
      )}
    </div>
  );
}
