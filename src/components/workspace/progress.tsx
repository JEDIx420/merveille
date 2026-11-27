"use client";
import { useEffect, useState } from "react";
import { LoadingState, ErrorState, readResponse } from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";
import styles from "./workspace.module.css";
export function ProjectProgress({
  projectId,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(
        await readResponse(await fetch(`/api/projects/${projectId}/progress`)),
      );
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    window.addEventListener("workspace:changed", load);
    return () => window.removeEventListener("workspace:changed", load);
  }, [projectId]);
  if (error) return <ErrorState message={error} retry={load} />;
  if (!data) return <LoadingState label="Loading progress…" />;
  const max = Math.max(1, ...data.weeks.map((w: any) => w.count));
  return (
    <section className={styles.workspace} aria-label="Project progress">
      <div className={styles.toolbar}>
        {compact ? <h2>Project progress</h2> : <h1>Project progress</h1>}
        <span className={styles.muted}>{data.percent}% complete</span>
      </div>
      <div className={styles.metrics}>
        {[
          ["Completed", data.completed],
          ["Open", data.open],
          ["Overdue", data.overdue],
          ["Total tasks", data.total],
        ].map(([l, v]) => (
          <div className={styles.metric} key={l}>
            <span className={styles.muted}>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div>
        <h3>Weekly task completions</h3>
        <div
          className={styles.chart}
          role="img"
          aria-label={data.weeks
            .map((w: any) => `${w.date}: ${w.count} completions`)
            .join("; ")}
        >
          {data.weeks.map((w: any) => (
            <div className={styles.bar} key={w.date}>
              <span>{w.count}</span>
              <i style={{ height: `${(w.count / max) * 130}px` }} />
              <span>{formatBusinessDate(w.date).replace(/ 20\d\d/, "")}</span>
            </div>
          ))}
        </div>
        <p className={styles.muted}>
          {data.historyAvailable
            ? "Recorded completion events over eight weeks. Recompleted tasks count again in the week they were finished."
            : "No completion events recorded in this period. Earlier task history has not been estimated."}
        </p>
      </div>
    </section>
  );
}
