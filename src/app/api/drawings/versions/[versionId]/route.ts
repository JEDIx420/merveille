import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  submitDrawingForReview,
  submitConsultantReview,
  releaseDrawingVersion,
} from "@/server/domain/drawings/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { versionId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const action = body.action;

    switch (action) {
      case "SUBMIT_REVIEW": {
        const result = await submitDrawingForReview(auth.principal, versionId, env.DB);
        return NextResponse.json({ ok: true, ...result });
      }

      case "CONSULTANT_DECISION": {
        const result = await submitConsultantReview(
          auth.principal,
          {
            versionId,
            decision: body.decision,
            reason: body.reason,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "RELEASE": {
        const result = await releaseDrawingVersion(
          auth.principal,
          {
            versionId,
            expectedCurrentVersionId: body.expectedCurrentVersionId,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "CONCURRENCY_CONFLICT"
        ? 409
        : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
