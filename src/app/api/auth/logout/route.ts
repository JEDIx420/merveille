import { getCloudflareContext } from "@opennextjs/cloudflare";
export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.APP_ORIGIN)
    return new Response("Sign-out setup pending", { status: 503 });
  return Response.redirect(`${env.APP_ORIGIN}/cdn-cgi/access/logout`, 303);
}
