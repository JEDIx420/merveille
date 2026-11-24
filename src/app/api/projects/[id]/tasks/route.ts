import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { listProjectTasks, createTask } from "@/server/domain/tasks/service";

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const assigneeId = searchParams.get("assigneeId") || undefined;

  try {
    const tasks = await listProjectTasks(auth.principal, projectId, env.DB, {
      status,
      assigneeId,
    });
    return NextResponse.json({ ok: true, tasks });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "FORBIDDEN" },
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
    const body = await request.json() as any;
    const result = await createTask(
      auth.principal,
      {
        projectId,
        stageId: body.stageId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        proposedAssigneeId: body.proposedAssigneeId,
        proposedDueDate: body.proposedDueDate,
      },
      env.DB
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
