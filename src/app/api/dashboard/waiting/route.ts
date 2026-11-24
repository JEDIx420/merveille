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
  const projectId = searchParams.get("projectId") || undefined;

  try {
    const items = await DashboardService.getWaitingOnYou(
      env.DB,
      auth.principal,
      {
        projectId,
      },
    );
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    const status =
      err.code === "FORBIDDEN" || err.code === "CROSS_PROJECT_DENIED"
        ? 403
        : 500;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "INTERNAL_ERROR" },
      { status },
    );
  }
}
