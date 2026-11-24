import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { ChangesService } from "@/server/domain/changes/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: changeId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const detail = await ChangesService.getChangeRequest(
      env.DB,
      auth.principal,
      changeId,
    );
    return NextResponse.json({ ok: true, change: detail });
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
