import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { projectProgress } from "@/server/workspace/service";
import { publicError, errorStatus } from "@/server/http/errors";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(req, env);
  if (!principal)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(
      await projectProgress(env.DB, principal, (await params).id),
    );
  } catch (e) {
    return NextResponse.json(
      { error: publicError(e) },
      { status: errorStatus(e) },
    );
  }
}
