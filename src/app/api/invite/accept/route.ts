import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { acceptInvitation } from "@/server/domain/identity/service";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const body: any = await request.json().catch(() => ({}));
  const token = body.token;
  const subjectId = body.subjectId || `sub_${Date.now()}`;

  if (!token) {
    return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
  }

  try {
    const result = await acceptInvitation(token, subjectId, env.DB);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "INVITATION_FAILED" },
      { status: 400 }
    );
  }
}
