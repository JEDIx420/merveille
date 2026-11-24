import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { PermitsService } from "@/server/domain/permits/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const permits = await PermitsService.getProjectPermits(
      env.DB,
      auth.principal,
      projectId,
    );
    return NextResponse.json({ ok: true, permits });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" ? 403 : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "UPDATE_MILESTONE": {
        const result = await PermitsService.updateMilestone(
          env.DB,
          auth.principal,
          {
            milestoneId: body.milestoneId,
            applicationReference: body.applicationReference,
            trackingLabel: body.trackingLabel,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "RECORD_OBSERVATION": {
        const result = await PermitsService.recordObservation(
          env.DB,
          auth.principal,
          {
            milestoneId: body.milestoneId,
            observedStatusText: body.observedStatusText,
            decisionDate: body.decisionDate,
            lastCheckedDate: body.lastCheckedDate,
            sourceDescription: body.sourceDescription,
            referenceUrl: body.referenceUrl,
            staffNotes: body.staffNotes,
            files: body.files,
          },
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      case "SUBMIT_SHARING": {
        const result = await PermitsService.submitObservationForSharing(
          env.DB,
          auth.principal,
          body.observationId,
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "REVIEW_SHARING": {
        const result = await PermitsService.reviewObservationSharing(
          env.DB,
          auth.principal,
          {
            observationId: body.observationId,
            decision: body.decision,
            feedback: body.feedback,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    const status =
      err.code === "FORBIDDEN" || err.code === "CROSS_PROJECT_DENIED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
