import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  return Response.json(
    { principal: auth.principal, status: auth.status },
    {
      status: auth.principal ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
