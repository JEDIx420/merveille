import { publicError, errorStatus } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { UpdatesService } from "@/server/domain/updates/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const announcements = await UpdatesService.listCompanyAnnouncements(
      env.DB,
      auth.principal,
    );
    return NextResponse.json({ ok: true, announcements });
  } catch (err: any) {
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status: errorStatus(err) },
    );
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action || "CREATE";

    if (action === "CREATE") {
      const result = await UpdatesService.createCompanyAnnouncement(
        env.DB,
        auth.principal,
        {
          title: body.title,
          bodyText: body.bodyText,
          audienceType: body.audienceType,
          targetProjectIds: body.targetProjectIds,
          targetClientUserIds: body.targetClientUserIds,
        },
      );
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } else if (action === "PUBLISH") {
      const result = await UpdatesService.publishCompanyAnnouncement(
        env.DB,
        auth.principal,
        body.announcementId,
      );
      return NextResponse.json({ ok: true, ...result });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
