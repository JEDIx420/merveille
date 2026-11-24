import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { DashboardService } from "@/server/domain/dashboard/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodDays = parseInt(searchParams.get("periodDays") || "90", 10);
  const projectId = searchParams.get("projectId") || undefined;

  try {
    const metrics = await DashboardService.getOwnerPerformanceMetrics(
      env.DB,
      auth.principal,
      auth.principal.orgId,
      { periodDays, projectId },
    );
    return NextResponse.json({ ok: true, ...metrics });
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "INTERNAL_ERROR" },
      { status },
    );
  }
}
