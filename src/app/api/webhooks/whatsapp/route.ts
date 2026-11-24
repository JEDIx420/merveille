import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NotificationService } from "@/server/notifications/service";
import { verifyMetaWebhookSignature } from "@/server/notifications/whatsapp";
type HookEnv = CloudflareEnv & {
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
};
export async function GET(request: NextRequest) {
  const { env: bindings } = await getCloudflareContext({ async: true });
  const env = bindings as HookEnv;
  const q = new URL(request.url).searchParams;
  if (!env.WHATSAPP_VERIFY_TOKEN)
    return NextResponse.json(
      { error: "Webhook setup incomplete." },
      { status: 503 },
    );
  if (
    q.get("hub.mode") !== "subscribe" ||
    q.get("hub.verify_token") !== env.WHATSAPP_VERIFY_TOKEN
  )
    return NextResponse.json(
      { error: "Verification failed." },
      { status: 403 },
    );
  return new NextResponse(q.get("hub.challenge") || "", { status: 200 });
}
export async function POST(request: NextRequest) {
  const { env: bindings } = await getCloudflareContext({ async: true });
  const env = bindings as HookEnv;
  if (!env.WHATSAPP_APP_SECRET)
    return NextResponse.json(
      { error: "Webhook setup incomplete." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") || 0) > 1048576)
    return new NextResponse(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 1048576) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  if (
    !(await verifyMetaWebhookSignature(
      bytes,
      request.headers.get("x-hub-signature-256"),
      env.WHATSAPP_APP_SECRET,
    ))
  )
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    for (const entry of body.entry || [])
      for (const change of entry.changes || [])
        for (const s of change.value?.statuses || []) {
          const states: Record<
            string,
            "SENT" | "DELIVERED" | "READ" | "FAILED"
          > = {
            sent: "SENT",
            delivered: "DELIVERED",
            read: "READ",
            failed: "FAILED",
          };
          if (typeof s.id === "string" && states[s.status])
            await NotificationService.reconcileWebhookStatus(
              env.DB,
              `${s.id}:${s.status}:${s.timestamp || ""}`,
              s.id,
              states[s.status],
            );
        }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid status event." },
      { status: 400 },
    );
  }
}
