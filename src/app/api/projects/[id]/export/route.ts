import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { ArchiveService } from "@/server/domain/archive/service";
import { AuthorizationError } from "@/server/auth/policy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ArchiveService.exportProjectBackup(
      env.DB as any,
      env.PROJECT_FILES as any,
      auth.principal,
      id
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status =
      err instanceof AuthorizationError || err.code === "FORBIDDEN"
        ? 403
        : 500;
    return NextResponse.json(
      { error: err.message, code: err.code || "EXPORT_ERROR" },
      { status }
    );
  }
}
