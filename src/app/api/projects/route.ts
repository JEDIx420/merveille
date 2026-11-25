import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { listProjects } from "@/server/domain/projects/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("query") || undefined;
  const stage = searchParams.get("stage") || undefined;
  const includeArchived = searchParams.get("includeArchived") === "true";

  try {
    const projects = await listProjects(auth.principal, env.DB, {
      query: q,
      stage,
      includeArchived,
    });
    return NextResponse.json({ ok: true, projects });
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
  if (!auth.principal) return NextResponse.json({error: "Unauthorized"}, {status:401});
  try {
    const { onboardExistingProject } = await import("@/server/domain/projects/onboarding");
    const result = await onboardExistingProject(auth.principal, await request.json(), env.DB);
    return NextResponse.json({ok:true,...result}, {status: result.replayed ? 200 : 201});
  } catch (err: any) {
    return NextResponse.json({error:publicError(err),code:err.code}, {status:errorStatus(err)});
  }
}
