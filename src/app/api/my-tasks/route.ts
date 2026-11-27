import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getMyTasksUnified,
  getTeamMemberProjectTasks,
  createPersonalTask,
  updatePersonalTask,
  promotePersonalTaskToProject,
} from "@/server/domain/tasks/personal-service";
import { query } from "@/server/db";
import { canReadInternalNotes } from "@/server/auth/policy";
import { hasCapability } from "@/server/auth/principal";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const teamUserId = request.nextUrl.searchParams.get("teamUserId")?.trim();
    if (teamUserId) {
      const data = await getTeamMemberProjectTasks(auth.principal, teamUserId, env.DB);
      return NextResponse.json({ ok: true, mode: "TEAM", ...data });
    }

    const data = await getMyTasksUnified(auth.principal, env.DB);
    const isInternal =
      hasCapability(auth.principal, "ADMIN") ||
      hasCapability(auth.principal, "OWNER") ||
      auth.principal.projectMemberships.some((m) =>
        (m.roles || [m.projectRole]).some((r) =>
          ["MANAGER", "PROJECT_MANAGER", "TEAM_MEMBER", "STAFF", "ARCHITECT", "DIRECTOR"].includes(r || ""),
        ),
      );

    let teamMembers: { id: string; name: string }[] = [];
    let internalProjects: { id: string; code: string; name: string }[] = [];

    if (isInternal) {
      teamMembers = await query<{ id: string; name: string }>(
        env.DB,
        `SELECT DISTINCT u.id, u.display_name as name
         FROM users u
         JOIN organization_memberships om ON om.user_id = u.id AND om.org_id = ? AND om.is_active = 1
         JOIN project_memberships pm ON pm.user_id = u.id AND pm.is_active = 1
           AND pm.project_role IN ('MANAGER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'STAFF', 'ARCHITECT', 'DIRECTOR')
         WHERE u.status = 'ACTIVE' AND u.id != ?
         ORDER BY u.display_name ASC`,
        [auth.principal.orgId, auth.principal.id],
      );

      const projects = await query<{ id: string; code: string; name: string }>(
        env.DB,
        `SELECT id, code, name FROM projects WHERE org_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 50`,
        [auth.principal.orgId],
      );
      internalProjects = projects.filter((p) => canReadInternalNotes(auth.principal!, p.id));
    }

    return NextResponse.json({
      ok: true,
      mode: "MY",
      ...data,
      teamMembers,
      internalProjects,
    });
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
