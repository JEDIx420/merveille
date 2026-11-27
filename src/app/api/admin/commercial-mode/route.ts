import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  getCommercialMode,
  setCommercialMode,
} from "@/server/domain/finance/external-clearance";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const mode = await getCommercialMode(env.DB, auth.principal.orgId);
    return NextResponse.json({ ok: true, commercialMode: mode });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err) },
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
    const result = await setCommercialMode(
      env.DB,
      auth.principal,
      auth.principal.orgId,
      body.commercialMode,
      body.reason
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "MODE_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
