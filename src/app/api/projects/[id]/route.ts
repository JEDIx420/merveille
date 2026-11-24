import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getProject,
  activateProject,
  updateProjectStage,
  pauseProject,
  resumeProject,
} from "@/server/domain/projects/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getProject(auth.principal, id, env.DB);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: publicError(err), code: err.code },
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
  const { id } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "ACTIVATE": {
        const result = await activateProject(auth.principal, id, env.DB);
        return NextResponse.json({ ok: true, ...result });
      }
      case "UPDATE_STAGE": {
        const result = await updateProjectStage(
          auth.principal,
          id,
          {
            stageId: body.stageId,
            status: body.status,
            actualCompletionDate: body.actualCompletionDate,
            expectedRevision: body.expectedRevision,
          },
          env.DB,
        );
        return NextResponse.json({ ok: true, ...result });
      }
      case "PAUSE": {
        const result = await pauseProject(
          auth.principal,
          id,
          { reason: body.reason || "Project delivery paused by manager" },
          env.DB,
        );
        return NextResponse.json({ ok: true, ...result });
      }
      case "RESUME": {
        const result = await resumeProject(
          auth.principal,
          id,
          { reason: body.reason || "Project delivery resumed by manager" },
          env.DB,
        );
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json(
          { error: `Unknown project action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "CONCURRENCY_CONFLICT"
          ? 409
          : 403;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "OPERATION_FAILED" },
      { status },
    );
  }
}
