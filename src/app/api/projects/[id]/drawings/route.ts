import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  listProjectDrawings,
  createDrawing,
} from "@/server/domain/drawings/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const discipline = searchParams.get("discipline") || undefined;

  try {
    const drawings = await listProjectDrawings(
      auth.principal,
      projectId,
      env.DB,
      discipline,
    );
    return NextResponse.json({ ok: true, drawings });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "FORBIDDEN" },
      { status },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const result = await createDrawing(
      auth.principal,
      {
        projectId,
        drawingNumber: body.drawingNumber,
        title: body.title,
        discipline: body.discipline,
      },
      env.DB,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "OPERATION_FAILED" },
      { status },
    );
  }
}
