import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { ChangesService } from "@/server/domain/changes/service";
import { assertProjectAccess } from "@/server/auth/policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertProjectAccess(auth.principal, projectId);
    const changes = await ChangesService.listChangeRequests(env.DB, auth.principal, projectId);

    return NextResponse.json({
      ok: true,
      changes,
    });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" || err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertProjectAccess(auth.principal, projectId);
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "create": {
        const result = await ChangesService.createChangeRequest(env.DB, auth.principal, {
          projectId,
          title: body.title,
          description: body.description,
          sourceType: body.sourceType,
          sourceReferenceId: body.sourceReferenceId,
          affectedOriginalScope: body.affectedOriginalScope,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "start_estimating": {
        const result = await ChangesService.startEstimating(
          env.DB,
          auth.principal,
          body.changeRequestId
        );
        return NextResponse.json({ ok: true, result });
      }

      case "issue_estimate": {
        const result = await ChangesService.issueEstimate(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          scopeSummary: body.scopeSummary,
          exclusions: body.exclusions,
          priceMinor: body.priceMinor,
          taxMinor: body.taxMinor,
          requiredPreworkPaymentMinor: body.requiredPreworkPaymentMinor,
          scheduleImpactDays: body.scheduleImpactDays,
          currency: body.currency,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "accept": {
        const result = await ChangesService.acceptEstimate(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          versionNumber: body.versionNumber,
          notes: body.notes,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "decline": {
        const result = await ChangesService.declineEstimate(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          reason: body.reason,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "confirm_payment": {
        const result = await ChangesService.confirmChangePayment(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          receiptId: body.receiptId,
          amountMinor: body.amountMinor,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "authorize": {
        const result = await ChangesService.authorizeChangeWork(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          notes: body.notes,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "revise": {
        const result = await ChangesService.reviseEstimate(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          scopeSummary: body.scopeSummary,
          exclusions: body.exclusions,
          priceMinor: body.priceMinor,
          taxMinor: body.taxMinor,
          requiredPreworkPaymentMinor: body.requiredPreworkPaymentMinor,
          scheduleImpactDays: body.scheduleImpactDays,
          reason: body.reason,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "start_work": {
        const result = await ChangesService.startChangeWork(
          env.DB,
          auth.principal,
          body.changeRequestId
        );
        return NextResponse.json({ ok: true, result });
      }

      case "complete_work": {
        const result = await ChangesService.completeChangeWork(
          env.DB,
          auth.principal,
          body.changeRequestId
        );
        return NextResponse.json({ ok: true, result });
      }

      case "comment": {
        const result = await ChangesService.addComment(env.DB, auth.principal, {
          changeRequestId: body.changeRequestId,
          commentText: body.commentText,
        });
        return NextResponse.json({ ok: true, result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    const status =
      err.code === "CROSS_PROJECT_DENIED" ||
      err.code === "FORBIDDEN" ||
      err.code === "MAIN_CLIENT_ACCEPTANCE_REQUIRED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
