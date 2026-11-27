import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  listLeads,
  createLead,
  updateLeadStage,
  reassignLeadOwner,
  addLeadFollowup,
  completeLeadFollowup,
  exportLeadsCsv,
} from "@/server/domain/enquiries/leads-service";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("format") === "csv") {
      const csv = await exportLeadsCsv(auth.principal, env.DB);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="merveille-leads.csv"',
          "Cache-Control": "no-store, private",
        },
      });
    }

    const filter = (searchParams.get("filter") as any) || "ALL";
    const stage = (searchParams.get("stage") as any) || undefined;
    const query = searchParams.get("q") || undefined;
    const leads = await listLeads(auth.principal, env.DB, { filter, stage, query });
    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "LEAD_ERROR" },
      { status: errorStatus(err) }
    );
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    if (body.action === "stage") {
      const result = await updateLeadStage(
        auth.principal,
        body.leadId,
        body.stage,
        body.reason,
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "reassign") {
      const result = await reassignLeadOwner(
        auth.principal,
        body.leadId,
        body.ownerId,
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "add_followup") {
      const result = await addLeadFollowup(
        auth.principal,
        body.leadId,
        {
          actionText: body.actionText,
          dueDate: body.dueDate,
          dueTime: body.dueTime,
        },
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "complete_followup") {
      const result = await completeLeadFollowup(
        auth.principal,
        body.followupId,
        {
          outcomeNote: body.outcomeNote,
          nextActionText: body.nextActionText,
          nextDueDate: body.nextDueDate,
          nextDueTime: body.nextDueTime,
        },
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    }

    const created = await createLead(auth.principal, body, env.DB);
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "LEAD_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
