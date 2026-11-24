"use client";
import { cx } from "@/components/utilities";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Badge,
  ui,
  readResponse,
} from "@/components/ui";
import { formatBusinessDate, formatRupees } from "@/shared/config";
export default function OverviewPage() {
  const { principal } = useSession();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await readResponse(await fetch("/api/dashboard/overview")));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!principal) return;
    const internal =
      (principal.roles || []).some((r) => r === "ADMIN" || r === "OWNER") ||
      principal.projectMemberships.some((m) =>
        (m.roles || [m.projectRole]).some((r) =>
          ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""),
        ),
      );
    if (!internal && principal.projectMemberships.length === 1)
      router.replace(
        `/projects/${principal.projectMemberships[0].projectId}/overview`,
      );
  }, [principal, router]);
  if (loading) return <LoadingState label="Loading your priorities…" />;
  if (error) return <ErrorState message={error} retry={load} />;
  const items = data?.waitingItems || [];
  const groups = [
    {
      title: "Overdue tasks",
      description: "Work that needs your attention",
      items: items.filter((i: any) => i.isOverdue && /TASK/.test(i.entityType)),
    },
    {
      title: "Waiting for your approval",
      description: "Decisions assigned to you",
      items: items.filter((i: any) =>
        /REVIEW|RELEASE|APPROVAL|AUTHORIZATION|DECISION/.test(i.entityType),
      ),
    },
    {
      title: "Upcoming deadlines",
      description: "The next things to plan for",
      items: items.filter(
        (i: any) =>
          !i.isOverdue &&
          !/REVIEW|RELEASE|APPROVAL|AUTHORIZATION|DECISION/.test(i.entityType),
      ),
    },
  ];
  const projects = data?.activeProjects || [];
  return (
    <div className={ui.page}>
      <PageHeader
        title="Overview"
        description={formatBusinessDate(new Date())}
        actions={
          items[0] && (
            <Link className={cx("btn-primary")} href={items[0].link}>
              Review next item
            </Link>
          )
        }
      />
      <section className={ui.grid} aria-label="Your priorities">
        {groups.map((group) => (
          <div key={group.title} className={ui.panel}>
            <div className={ui.priorityTitle}>
              <h2>{group.title}</h2>
              <Badge>{group.items.length}</Badge>
            </div>
            <p className={ui.meta}>{group.description}</p>
            <div className={ui.priorityList}>
              {group.items.length ? (
                group.items.slice(0, 4).map((item: any) => (
                  <Link
                    href={item.link}
                    key={item.id}
                    className={ui.priorityLink}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.projectName || item.projectCode}
                      {item.dueDate
                        ? ` · ${formatBusinessDate(item.dueDate)}`
                        : ""}
                    </span>
                    <span>{item.requiredAction}</span>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="You're up to date"
                  description="Nothing is currently waiting in this list."
                />
              )}
            </div>
          </div>
        ))}
      </section>
      <section>
        <PageHeader
          section
          title="Active projects"
          description="Current work across your permitted projects"
          actions={
            <Link href="/projects" className={cx("btn-secondary")}>
              All projects
            </Link>
          }
        />
        <div className={ui.state} />
        {projects.length ? (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Next milestone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.id}/overview`}>{p.name}</Link>
                      <small>{p.code}</small>
                    </td>
                    <td>
                      {p.stage?.replaceAll("_", " ") || "Not yet recorded"}
                    </td>
                    <td>
                      {p.next_milestone ||
                        p.planned_completion_date ||
                        "Not yet scheduled"}
                    </td>
                    <td>
                      <Badge>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={ui.panel}>
            <EmptyState
              title="No active projects"
              description="Projects assigned to you will appear here. Archived records remain available in Archive."
              action={<Link href="/archive">Open archive</Link>}
            />
          </div>
        )}
      </section>
      {data?.firmFinance && (
        <section className={ui.panel}>
          <h2>Financial activity</h2>
          <dl className={ui.summary}>
            <div>
              <dt>Invoiced</dt>
              <dd>{formatRupees(data.firmFinance.totalInvoicedMinor)}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatRupees(data.firmFinance.totalReceivedMinor)}</dd>
            </div>
            {data.firmFinance.payrollAndProfit && (
              <>
                <div>
                  <dt>Payroll</dt>
                  <dd>
                    {formatRupees(
                      data.firmFinance.payrollAndProfit.totalPayrollMinor,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Net operating profit</dt>
                  <dd>
                    {formatRupees(
                      data.firmFinance.payrollAndProfit.netProfitMinor,
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
      <p className={ui.meta}>
        <Link href="/waiting">Open your full waiting list</Link>
      </p>
    </div>
  );
}
