import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { SnagsService } from "@/server/domain/snags/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: snagId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const detail = await SnagsService.getSnag(env.DB, auth.principal, snagId);
    return NextResponse.json({ ok: true, snag: detail });
  } catch (err: any) {
    const status =
      err.code === "CROSS_PROJECT_DENIED" || err.code === "FORBIDDEN"
        ? 403
        : err.code === "NOT_FOUND"
          ? 404
          : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
