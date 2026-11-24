import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { hasCapability } from "@/server/auth/principal";
import { reconcileAccessAdmission } from "@/server/auth/admission";
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(request, env);
  if (!principal || !hasCapability(principal, "ADMIN"))
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  return Response.json(await reconcileAccessAdmission(env, principal.orgId));
}
