import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  isWhatsAppConfigured,
  type WhatsAppSettings,
} from "@/server/notifications/whatsapp";
import { NotificationService } from "@/server/notifications/service";
export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  const [notifications, preferences] = await Promise.all([
    NotificationService.listUserNotifications(env.DB, auth.principal),
    NotificationService.getPreferences(env.DB, auth.principal),
  ]);
  return NextResponse.json({
    ok: true,
    notifications,
    preferences,
    deliveryMode: isWhatsAppConfigured(env as WhatsAppSettings)
      ? env.WHATSAPP_MODE
      : "unavailable",
  });
}
export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  try {
    const body = (await request.json()) as any;
    if (body.action === "mark_read")
      return NextResponse.json({
        ok: true,
        result: await NotificationService.markNotificationRead(
          env.DB,
          auth.principal,
          body.notificationId,
        ),
      });
    if (
      body.action === "preferences" &&
      typeof body.whatsappEnabled === "boolean"
    )
      return NextResponse.json({
        ok: true,
        preferences: await NotificationService.setPreferences(
          env.DB,
          auth.principal,
          body.whatsappEnabled,
        ),
      });
    return NextResponse.json(
      { error: "This action is unavailable." },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "The notification could not be updated." },
      { status: 400 },
    );
  }
}
