import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NotificationService } from "@/server/notifications/service";
import { verifyMetaWebhookSignature } from "@/server/notifications/whatsapp";

/**
 * Meta WhatsApp Webhook Endpoint.
 * GET: Verifies subscription challenge (hub.mode, hub.verify_token).
 * POST: Verifies HMAC-SHA256 signature over raw request bytes (AC-050) and reconciles delivery status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "merveille_meta_verify_token";

  if (mode === "subscribe" && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const appSecret = process.env.META_APP_SECRET || "meta_secret_fallback";
  const signatureHeader = request.headers.get("x-hub-signature-256");

  // Read raw request bytes for HMAC-SHA256 verification (AC-050)
  const rawBytes = await request.arrayBuffer();

  const isValid = await verifyMetaWebhookSignature(rawBytes, signatureHeader, appSecret);
  if (!isValid && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const text = new TextDecoder().decode(rawBytes);
    const body = JSON.parse(text);

    // Process status updates
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            const val = change.value;
            if (val.statuses && Array.isArray(val.statuses)) {
              for (const statusObj of val.statuses) {
                const eventId = `wh_status_${statusObj.id}_${statusObj.status}`;
                const providerMsgId = statusObj.id;
                const status =
                  statusObj.status === "read"
                    ? "READ"
                    : statusObj.status === "delivered"
                    ? "DELIVERED"
                    : "FAILED";

                await NotificationService.reconcileWebhookStatus(
                  env.DB,
                  eventId,
                  providerMsgId,
                  status
                );
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
