import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { listPeople, inviteUser } from "@/server/domain/identity/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const people = await listPeople(auth.principal, env.DB);
    return NextResponse.json({ ok: true, people });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "FORBIDDEN" },
      { status: err.code === "ADMIN_REQUIRED" ? 403 : 500 }
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
        role: body.role,
        projectId: body.projectId,
      },
      env.DB
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "FORBIDDEN" },
      { status: err.code === "ADMIN_REQUIRED" ? 403 : 400 }
    );
  }
}
