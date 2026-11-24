import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { listPeople, inviteUser } from "@/server/domain/identity/service";
import { reconcileAccessAdmission } from "@/server/auth/admission";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const people = await listPeople(auth.principal, env.DB);
    const invitations = await env.DB.prepare(
      "SELECT id,display_name,email,status,expires_at,admission_status FROM invitations WHERE org_id=? ORDER BY created_at DESC",
    )
      .bind(auth.principal.orgId)
      .all();
    const projects = await env.DB.prepare(
      "SELECT id,name FROM projects WHERE org_id=? ORDER BY name",
    )
      .bind(auth.principal.orgId)
      .all();
    return NextResponse.json({
      ok: true,
      people,
      invitations: invitations.results,
      projects: projects.results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "FORBIDDEN" },
      { status: errorStatus(err) },
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
    const body: any = await request.json();
    const result = await inviteUser(
      auth.principal,
      {
        email: body.email,
        displayName: body.displayName || body.email.split("@")[0],
        roles: body.roles,
        projects: body.projects,
        confirmElevation: body.confirmElevation,
        role: body.role,
        projectId: body.projectId,
      },
      env.DB,
    );

    const admission = await reconcileAccessAdmission(env, auth.principal.orgId);
    return NextResponse.json({ ok: true, ...result, admissionStatus: admission.status }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "FORBIDDEN" },
      { status: errorStatus(err) },
    );
  }
}
