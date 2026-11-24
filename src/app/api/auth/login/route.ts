import { getCloudflareContext } from "@opennextjs/cloudflare";
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const issuer = env.ACCESS_ISSUER;
  if (
    !issuer ||
    !env.ACCESS_AUDIENCE ||
    env.ACCESS_AUDIENCE.includes("__REPLACE")
  )
    return Response.redirect(new URL('/login?setup=pending',env.APP_ORIGIN),303);
  const destination =
    new URL(request.url).searchParams.get("returnTo") ?? "/overview";
  const safe =
    destination.startsWith("/") &&
    !destination.startsWith("//") &&
    !destination.includes("\\")
      ? destination
      : "/overview";
  // Access owns the Google provider selection; no mailbox scopes are requested.
  return Response.redirect(`${env.APP_ORIGIN}${safe}`, 303);
}
