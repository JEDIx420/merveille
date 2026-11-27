import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  listProjectClearances,
  recordExternalClearance,
  updateExternalClearanceStatus,
} from "@/server/domain/finance/external-clearance";
import { publicError, errorStatus } from "@/server/http/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const clearances = await listProjectClearances(env.DB, auth.principal, id);
    return NextResponse.json({ ok: true, clearances });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "CLEARANCE_ERROR" },
      { status: errorStatus(err) }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as any;
    if (body.action === "CORRECTED" || body.action === "REVOKED") {
      const result = await updateExternalClearanceStatus(env.DB, auth.principal, {
        clearanceId: body.clearanceId,
        action: body.action,
        reason: body.reason,
        externalReference: body.externalReference,
        clearanceType: body.clearanceType,
      });
      return NextResponse.json({ ok: true, result });
    }
    const result = await recordExternalClearance(env.DB, auth.principal, {
      projectId: id,
      entityType: body.entityType,
      entityId: body.entityId,
      versionNumber: Number(body.versionNumber),
      clearanceType: body.clearanceType,
      externalReference: body.externalReference,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "CLEARANCE_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
