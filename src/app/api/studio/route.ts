import { boundedJSON } from "@/server/http/bounded-json";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { studioPreferences, taskStudio } from "@/server/workspace/studio";
import { publicError, errorStatus } from "@/server/http/errors";
async function handle(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal: p } = await getSessionPrincipal(req, env);
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b: any = req.method === "POST" ? await boundedJSON(req) : undefined;
    if (
      req.headers.get("content-length") &&
      Number(req.headers.get("content-length")) > 20000
    )
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const id = b?.taskId || req.nextUrl.searchParams.get("taskId");
    const result = id
      ? await taskStudio(
          env.DB,
          p,
          id,
          b?.scope || req.nextUrl.searchParams.get("scope"),
          b,
        )
      : await studioPreferences(
          env.DB,
          p,
          b?.scope || req.nextUrl.searchParams.get("scope") || "personal",
          b?.settings,
        );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: publicError(e) },
      { status: errorStatus(e) },
    );
  }
}
export { handle as GET, handle as POST };
