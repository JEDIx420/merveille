import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { getFileForDownload } from "@/server/files/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = request.headers.get("range");

  try {
    const res = await getFileForDownload(
      auth.principal,
      id,
      env.DB,
      env.PROJECT_FILES,
      range
    );

    return new NextResponse(res.body as any, {
      status: res.status,
      headers: res.headers,
    });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "DOWNLOAD_FAILED" },
      { status }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id } = await params;

  if (!auth.principal) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const res = await getFileForDownload(
      auth.principal,
      id,
      env.DB,
      env.PROJECT_FILES
    );

    return new NextResponse(null, {
      status: 200,
      headers: res.headers,
    });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return new NextResponse(null, { status });
  }
}
