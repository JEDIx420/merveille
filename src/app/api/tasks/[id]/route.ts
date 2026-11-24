import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getTask,
  assignTask,
  changeTaskDeadline,
  startTask,
  completeTask,
  reopenTask,
  blockTask,
  cancelTask,
  addTaskComment,
} from "@/server/domain/tasks/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: taskId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getTask(auth.principal, taskId, env.DB);
    return NextResponse.json({ ok: true, ...data });
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
  const { id: taskId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const action = body.action;

    switch (action) {
      case "ASSIGN": {
        const result = await assignTask(
          auth.principal,
          taskId,
          {
            assigneeUserId: body.assigneeUserId,
            dueDate: body.dueDate,
            priority: body.priority,
            reason: body.reason,
            expectedRevision: body.expectedRevision,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "CHANGE_DEADLINE": {
        const result = await changeTaskDeadline(
          auth.principal,
          taskId,
          {
            dueDate: body.dueDate,
            reason: body.reason,
            expectedRevision: body.expectedRevision,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "START": {
        const result = await startTask(auth.principal, taskId, env.DB);
        return NextResponse.json({ ok: true, ...result });
      }

      case "COMPLETE": {
        const result = await completeTask(
          auth.principal,
          taskId,
          {
            completionNote: body.completionNote,
            expectedRevision: body.expectedRevision,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "REOPEN": {
        const result = await reopenTask(
          auth.principal,
          taskId,
          {
            reason: body.reason,
            category: body.category || "CORRECTION_DEFECT",
            newDueDate: body.newDueDate,
            expectedRevision: body.expectedRevision,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "BLOCK": {
        const result = await blockTask(
          auth.principal,
          taskId,
          {
            reason: body.reason,
            expectedRevision: body.expectedRevision,
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "CANCEL": {
        const result = await cancelTask(
          auth.principal,
          taskId,
          body.reason || "Cancelled by manager",
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "ADD_COMMENT": {
        const result = await addTaskComment(
          auth.principal,
          taskId,
          body.commentText,
          body.attachmentFileId,
          env.DB
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: `Unknown task action: ${action}` },
          { status: 400 }
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
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
