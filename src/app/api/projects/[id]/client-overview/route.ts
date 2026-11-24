import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { DashboardService } from "@/server/domain/dashboard/service";
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
    const data = await DashboardService.getClientProjectOverview(
      env.DB,
      auth.principal,
      projectId
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" || err.code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: err.message, code: err.code || "INTERNAL_ERROR" },
      { status }
    );
  }
}
