import {getCloudflareContext} from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Application session resolution additionally checks the configured canonical origin.
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !request.nextUrl.pathname.startsWith("/api/webhooks/")
  ) {
    const origin = request.headers.get("origin");
    const {env}=await getCloudflareContext({async:true});
    if (!env.APP_ORIGIN || !origin || origin !== new URL(env.APP_ORIGIN).origin)
      return NextResponse.json(
        { error: "This request must come from the application." },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|fonts/|merveille-designs-logo.png|merveille-designs-profile.png|favicon.png).*)",
  ],
};
