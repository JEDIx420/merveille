"use client";
import { cx } from "@/components/utilities";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import InternalProjectOverview from "@/features/internal-project-overview";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  ui,
  readResponse,
  Badge,
} from "@/components/ui";
import { formatRupees, formatBusinessDate } from "@/shared/config";
function ClientHome({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [permits, setPermits] = useState<any[]>([]);
  async function load() {
    setError("");
    try {
      setData(
        await readResponse(
          await fetch(`/api/projects/${projectId}/client-overview`),
        ),
      );
      const p = await readResponse(
        await fetch(`/api/projects/${projectId}/permits`),
      );
      setPermits(p.milestones || []);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setData(null);
    load();
  }, [projectId]);
  if (error) return <ErrorState message={error} retry={load} />;
  if (!data) return <LoadingState label="Loading project progress…" />;
  const latest = data.publishedUpdates?.[0];
  const drawing = data.releasedDrawings?.[0];
  const billing = data.billingSummary;
  return (
    <div className={ui.page}>
      <PageHeader
        title="Project progress"
        description={
          data.project.currentStageName || "Your project updates and next steps"
        }
      />
      <section className={ui.row} aria-label="Next milestone">
        <div>
          <span className={ui.meta}>Next milestone</span>
          <h2>{data.project.nextMilestone?.name || "Not yet scheduled"}</h2>
        </div>
        <p>
          {data.project.nextMilestone?.targetDate
            ? formatBusinessDate(data.project.nextMilestone.targetDate)
            : "Your team will record the next target date here."}
        </p>
      </section>
      <div className={ui.twoColumns}>
        <section className={ui.panel}>
          <h2>Latest update</h2>
          {latest ? (
            <>
              <p className={ui.meta}>
                {formatBusinessDate(latest.publishedAt)}
              </p>
              <h3>{latest.title}</h3>
              <p>{latest.body}</p>
              {latest.attachments
                ?.filter(
                  (a: any) =>
                    a.mimeType?.startsWith("image/") ||
                    a.mime_type?.startsWith("image/"),
                )
                .map((a: any) => (
                  <img
                    key={a.fileId || a.file_id}
                    alt={a.caption || "Site progress"}
                    src={`/api/files/${a.fileId || a.file_id}/download`}
                  />
                ))}
              <p>
                <Link href={`/projects/${projectId}/updates`}>
                  All project updates
                </Link>
              </p>
            </>
          ) : (
            <EmptyState
              title="Updates are on their way"
              description="Your team's published project updates will appear here."
            />
          )}
        </section>
        <section className={ui.panel}>
          <h2>Current drawing</h2>
          {drawing ? (
            <>
              <Badge>RELEASED</Badge>
              <h3>{drawing.title}</h3>
              <p className={ui.meta}>
                {drawing.drawingNumber} · Revision {drawing.versionNumber}
              </p>
              <p className={ui.meta}>
                Released {formatBusinessDate(drawing.releasedAt)}
              </p>
              <a
                className={cx("btn-secondary")}
                href={`/api/files/${drawing.fileId}/download`}
              >
                Download drawing
              </a>
            </>
          ) : (
            <EmptyState
              title="No released drawing yet"
              description="Drawings appear here after consultant approval and manager release."
            />
          )}
        </section>
      </div>
      {billing && (
        <section className={ui.panel}>
          <h2>Payments</h2>
          <dl className={ui.summary}>
            <div>
              <dt>Invoiced</dt>
              <dd>{formatRupees(billing.totalInvoicedMinor)}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatRupees(billing.totalPaidMinor)}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{formatRupees(billing.outstandingBalanceMinor)}</dd>
            </div>
          </dl>
          {billing.nextDueInvoice && (
            <div className={ui.row}>
              <div>
                <strong>Next payment</strong>
                <p>
                  {billing.nextDueInvoice.invoiceNumber} ·{" "}
                  {billing.nextDueInvoice.dueDate
                    ? formatBusinessDate(billing.nextDueInvoice.dueDate)
                    : "Date not yet recorded"}
                </p>
              </div>
              <strong>
                {formatRupees(billing.nextDueInvoice.balanceMinor)}
              </strong>
            </div>
          )}
          <p>
            <Link href={`/projects/${projectId}/finance`}>
              View quotation and payment history
            </Link>
          </p>
        </section>
      )}
      <section className={ui.panel}>
        <h2>Permit records</h2>
        <p className={ui.meta}>
          Recorded by Merveille Designs. These are manually entered records, not
          a live government feed.
        </p>
        {permits.length ? (
          permits.map((p: any) => (
            <div className={ui.row} key={p.id}>
              <div>
                <strong>
                  {p.title || p.milestone_name || p.milestone_type}
                </strong>
                <p>
                  {p.latest_status || p.status || "No observation recorded"}
                </p>
              </div>
              <Link href={`/projects/${projectId}/permits`}>View evidence</Link>
            </div>
          ))
        ) : (
          <EmptyState
            title="No permit update recorded"
            description="The team will add status observations and supporting evidence when available."
          />
        )}
      </section>
      <section className={ui.panel}>
        <h2>Decisions and references</h2>
        <div className={ui.actions}>
          <Link
            className={cx("btn-secondary")}
            href={`/projects/${projectId}/selections`}
          >
            Materials & references
          </Link>
          <Link
            className={cx("btn-secondary")}
            href={`/projects/${projectId}/changes`}
          >
            Additional work
          </Link>
          <Link
            className={cx("btn-secondary")}
            href={`/projects/${projectId}/snags`}
          >
            Site issues
          </Link>
        </div>
      </section>
    </div>
  );
}
export default function ProjectOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { principal } = useSession();
  if (!principal) return null;
  const internal =
    hasCapability(principal, "ADMIN") ||
    hasCapability(principal, "OWNER") ||
    hasCapability(principal, "MANAGER", id) ||
    hasCapability(principal, "TEAM_MEMBER", id);
  return internal ? (
    <InternalProjectOverview params={params} />
  ) : (
    <ClientHome projectId={id} />
  );
}
