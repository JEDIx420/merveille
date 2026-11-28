import { boundedJSON } from "@/server/http/bounded-json";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { listRules, saveRule } from "@/server/automations/service";
import { publicError, errorStatus } from "@/server/http/errors";
async function handle(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(req, env);
  if (!principal)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const enabled =
      (env as CloudflareEnv & { AUTOMATIONS_ENABLED?: string })
        .AUTOMATIONS_ENABLED === "true";
    const b = req.method === "POST" ? await boundedJSON(req) : null;
    if (b && JSON.stringify(b).length > 16000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const result = b
      ? await saveRule(env.DB, principal, b, enabled)
      : {
          ...(await listRules(
            env.DB,
            principal,
            req.nextUrl.searchParams.get("projectId"),
          )),
          executionEnabled: enabled,
        };
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
