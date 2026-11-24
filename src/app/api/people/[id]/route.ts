import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { disableUser } from "@/server/domain/identity/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: any = await request.json().catch(() => ({}));
  const action = body.action || "DISABLE";

  if (action === "DISABLE") {
    try {
      const result = await disableUser(
        auth.principal,
        id,
        body.reason || "Administrative removal",
        env.DB
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message, code: err.code || "FORBIDDEN" },
        { status: err.code === "ADMIN_REQUIRED" ? 403 : 400 }
      );
    }
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
