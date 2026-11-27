import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { QuotaService } from "@/server/quota/service";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const snapshot = await QuotaService.getQuotaSnapshot(
      env.DB,
      auth.principal,
      auth.principal.orgId
    );
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "QUOTA_ERROR" },
      { status: errorStatus(err) }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as any;
    const policy = await QuotaService.updateQuotaPolicy(
      env.DB,
      auth.principal,
      auth.principal.orgId,
      body
    );
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "QUOTA_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
