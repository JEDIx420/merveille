import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { disableUser, updateGrants } from "@/server/domain/identity/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: any = await request.json().catch(() => ({}));
  const action = body.action || "DISABLE";

  if (action === "GRANTS") {
    try {
      return NextResponse.json(
        await updateGrants(auth.principal, id, body, env.DB),
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          error: err.code
            ? publicError(err)
            : "Access change failed. Refresh and retry.",
          code: err.code,
        },
        { status: errorStatus(err) },
      );
    }
  }
  if (action === "DISABLE") {
    try {
      const result = await disableUser(
        auth.principal,
        id,
        body.reason || "Administrative removal",
        env.DB,
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      return NextResponse.json(
        { error: publicError(err), code: err.code || "FORBIDDEN" },
        { status: errorStatus(err) },
      );
    }
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
