import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { uploadPart } from "@/server/files/service";

export async function PUT(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const partNumber = parseInt(searchParams.get("partNumber") || "0", 10);

  if (!sessionId || !partNumber) {
    return NextResponse.json(
      { error: "Missing sessionId or partNumber" },
      { status: 400 },
    );
  }

  try {
    const chunk = await request.arrayBuffer();
    const result = await uploadPart(
      auth.principal,
      {
        sessionId,
        partNumber,
        chunk,
      },
      env.DB,
      env.PROJECT_FILES,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "OPERATION_FAILED" },
      { status },
    );
  }
}
