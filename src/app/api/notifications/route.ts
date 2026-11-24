import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { NotificationService } from "@/server/notifications/service";
import { SyntheticWhatsAppAdapter } from "@/server/notifications/whatsapp";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await NotificationService.listUserNotifications(env.DB, auth.principal);
    return NextResponse.json({ ok: true, notifications });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status: 400 }
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
    const action = body.action;

    switch (action) {
      case "mark_read": {
        const result = await NotificationService.markNotificationRead(
          env.DB,
          auth.principal,
          body.notificationId
        );
        return NextResponse.json({ ok: true, result });
      }

      case "scan": {
        if (auth.principal.role !== "ADMIN" && auth.principal.role !== "OWNER") {
          return NextResponse.json({ error: "Admin only" }, { status: 403 });
        }
        const result = await NotificationService.scanDueAndOverdueItems(env.DB, auth.principal.orgId);
        return NextResponse.json({ ok: true, result });
      }

      case "dispatch": {
        if (auth.principal.role !== "ADMIN" && auth.principal.role !== "OWNER") {
          return NextResponse.json({ error: "Admin only" }, { status: 403 });
        }
        const adapter = new SyntheticWhatsAppAdapter();
        const result = await NotificationService.dispatchQueuedNotifications(env.DB, adapter);
        return NextResponse.json({ ok: true, result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status: 400 }
    );
  }
}
