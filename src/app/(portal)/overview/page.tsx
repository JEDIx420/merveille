"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  PageHeader,
  readResponse,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { TaskWorkspace } from "@/components/workspace/task-workspace";
import { TaskLink } from "@/components/workspace/task-panel";
import { ProjectProgress } from "@/components/workspace/progress";
import { formatBusinessDate } from "@/shared/config";
import styles from "@/components/workspace/workspace.module.css";
export default function Home() {
  const { principal } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]),
    [decisions, setDecisions] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const internal =
    principal &&
    (hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "OWNER") ||
      principal.projectMemberships.some((m) =>
        (m.roles || [m.projectRole]).some((r) =>
          ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""),
        ),
      ));
  async function load() {
    try {
      const [p, w] = await Promise.all([
        fetch("/api/projects").then(readResponse),
        fetch("/api/dashboard/waiting").then(readResponse),
      ]);
      setProjects(p.projects || []);
      setDecisions(
        (w.items || []).filter((x: any) => !/TASK/.test(x.entityType)),
      );
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (principal && !internal) {
      router.replace("/projects");
      return;
    }
    load();
  }, [principal?.id]);
  return (
    <div className={styles.workspace}>
      <PageHeader
        title={`Hello${principal?.name ? ", " + principal.name.split(" ")[0] : ""}`}
        description={formatBusinessDate(new Date())}
      />
      {error && <ErrorState message={error} retry={load} />}
      <TaskWorkspace compact />
      {decisions.length > 0 && (
        <section className={styles.stack}>
          <h2>Needs your decision</h2>
          {decisions.slice(0, 4).map((d) => (
            <TaskLink key={d.id} href={d.link}>
              {d.title} · {d.projectName || d.projectCode}
            </TaskLink>
          ))}
        </section>
      )}
      <section className={styles.stack}>
        <div className={styles.toolbar}>
          <h2>Recent projects</h2>
          <Link href="/projects">All projects</Link>
        </div>
        {loading ? (
          <LoadingState label="Loading projects…" />
        ) : !projects.length ? (
          <EmptyState
            title="Your projects will appear here"
            description="Open Projects to add a project or see your assigned work."
          />
        ) : (
          <div className={styles.projects}>
            {projects.slice(0, 4).map((p) => (
              <Link
                className={styles.projectCard}
                href={`/projects/${p.id}/tasks`}
                key={p.id}
              >
                <span className={styles.muted}>{p.code}</span>
                <h2>{p.name}</h2>
                <p className={styles.muted}>{p.stage?.replaceAll("_", " ")}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      {internal && projects[0] && (
        <section className={styles.stack}>
          <Link href={`/projects/${projects[0].id}/progress`}>
            {projects[0].name}
          </Link>
          <ProjectProgress projectId={projects[0].id} compact />
        </section>
      )}
    </div>
  );
}
