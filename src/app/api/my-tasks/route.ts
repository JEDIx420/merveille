import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getMyTasksUnified,
  createPersonalTask,
  updatePersonalTask,
  promotePersonalTaskToProject,
} from "@/server/domain/tasks/personal-service";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getMyTasksUnified(auth.principal, env.DB);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err) },
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
    if (body.action === "promote") {
      const result = await promotePersonalTaskToProject(
        auth.principal,
        body.personalTaskId,
        { projectId: body.projectId, priority: body.priority },
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "update") {
      const task = await updatePersonalTask(
        auth.principal,
        body.personalTaskId,
        body.patch || {},
        env.DB
      );
      return NextResponse.json({ ok: true, task });
    }
    const task = await createPersonalTask(
      auth.principal,
      {
        title: body.title,
        description: body.description,
        priority: body.priority,
        dueDate: body.dueDate,
        sectionLabel: body.sectionLabel,
        parentTaskId: body.parentTaskId,
      },
      env.DB
    );
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "TASK_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
