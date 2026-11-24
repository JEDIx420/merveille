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

  try {
    const data = await DashboardService.getRoleOverview(
      env.DB,
      auth.principal,
      auth.principal.orgId
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: err.message, code: err.code || "INTERNAL_ERROR" },
      { status }
    );
  }
}
