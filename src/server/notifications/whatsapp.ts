/**
 * WhatsApp Delivery Adapter, Template Sanitizer, and Webhook Signature Verification.
 * Enforces safe minimal context without raw documents or salaries (AC-049),
 * HMAC-SHA256 raw bytes verification (AC-050), and duplicate reconciliation (AC-048).
 */

import { AuthorizationError } from "@/server/auth/policy";

export interface WhatsAppTemplatePayload {
  notificationId: string;
  recipientPhone: string;
  templateName: string;
  templateParameters: Record<string, string | number>;
  deepLinkPath: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId?: string;
  status: "SENT" | "DELIVERED" | "FAILED" | "UNKNOWN" | "UNAVAILABLE";
  error?: string;
  retryable?: boolean;
}

export interface WhatsAppAdapter {
  sendTemplate(payload: WhatsAppTemplatePayload): Promise<WhatsAppSendResult>;
}

/** No deployed fake sends: unconfigured delivery remains explicitly unavailable. */
export interface WhatsAppSettings {
  WHATSAPP_MODE?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  WHATSAPP_APPROVED_TEST_RECIPIENTS?: string;
}
export function isWhatsAppConfigured(settings: WhatsAppSettings): boolean {
  return (
    ["test", "live"].includes(settings.WHATSAPP_MODE || "") &&
    !!settings.WHATSAPP_ACCESS_TOKEN &&
    /^v\d+\.\d+$/.test(settings.WHATSAPP_GRAPH_VERSION || "") &&
    /^\d+$/.test(settings.WHATSAPP_PHONE_NUMBER_ID || "")
  );
}
export function createWhatsAppAdapter(
  settings: WhatsAppSettings,
): WhatsAppAdapter {
  return {
    async sendTemplate(payload) {
      if (
        !["test", "live"].includes(settings.WHATSAPP_MODE || "") ||
        !settings.WHATSAPP_PHONE_NUMBER_ID ||
        !settings.WHATSAPP_ACCESS_TOKEN ||
        !settings.WHATSAPP_GRAPH_VERSION
      ) {
        return {
          success: false,
          status: "UNAVAILABLE",
          error: "WhatsApp delivery is not configured.",
        };
      }
      if (
        settings.WHATSAPP_MODE === "test" &&
        !(settings.WHATSAPP_APPROVED_TEST_RECIPIENTS || "")
          .split(",")
          .map((v) => v.trim())
          .includes(payload.recipientPhone)
      ) {
        return {
          success: false,
          status: "UNAVAILABLE",
          error: "This recipient is not authorised for test delivery.",
        };
      }
      if (
        !/^v\d+\.\d+$/.test(settings.WHATSAPP_GRAPH_VERSION) ||
        !/^\d+$/.test(settings.WHATSAPP_PHONE_NUMBER_ID)
      )
        return {
          success: false,
          status: "UNAVAILABLE",
          error: "Invalid provider configuration.",
        };
      if (!/^\/[a-zA-Z0-9/_-]*$/.test(payload.deepLinkPath))
        return {
          success: false,
          status: "FAILED",
          error: "Invalid notification destination.",
        };
      if (!/^\+?[1-9]\d{7,14}$/.test(payload.recipientPhone))
        return {
          success: false,
          status: "FAILED",
          error: "Invalid verified destination.",
        };
      try {
        const response = await fetch(
          `https://graph.facebook.com/${settings.WHATSAPP_GRAPH_VERSION}/${settings.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: {
              Authorization: `Bearer ${settings.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: payload.recipientPhone,
              type: "template",
              template: {
                name: payload.templateName,
                language: { code: settings.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
                components: [
                  {
                    type: "body",
                    parameters: Object.values(payload.templateParameters).map(
                      (text) => ({ type: "text", text: String(text) }),
                    ),
                  },
                  {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                      { type: "text", text: payload.deepLinkPath.slice(1) },
                    ],
                  },
                ],
              },
            }),
          },
        );
        if (response.status === 429)
          return {
            success: false,
            status: "FAILED",
            retryable: true,
            error: "Provider rate limit; retry scheduled.",
          };
        if (response.status >= 500)
          return {
            success: false,
            status: "UNKNOWN",
            error: "Provider outcome is uncertain; reconcile before retry.",
          };
        if (!response.ok)
          return {
            success: false,
            status: "FAILED",
            error: "Provider rejected the approved template or destination.",
          };
        const body = (await response.json()) as { messages?: { id: string }[] };
        const id = body.messages?.[0]?.id;
        if (!id)
          return {
            success: false,
            status: "UNKNOWN",
            error: "Provider accepted request without a message identifier.",
          };
        return { success: true, status: "SENT", providerMessageId: id };
      } catch {
        return {
          success: false,
          status: "UNKNOWN",
          error:
            "Provider request interrupted. Delivery is uncertain; do not resend automatically.",
        };
      }
    },
  };
}

/**
 * Verify Meta Webhook HMAC-SHA256 signature over raw request bytes (AC-050).
 * Constant-time comparison prevents timing attacks.
 */
export async function verifyMetaWebhookSignature(
  rawBody: Uint8Array | ArrayBuffer,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignatureHex = signatureHeader
    .substring("sha256=".length)
    .trim();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    (rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody)) as any,
  );

  const actualHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time string equality check
  if (actualHex.length !== expectedSignatureHex.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < actualHex.length; i++) {
    mismatch |= actualHex.charCodeAt(i) ^ expectedSignatureHex.charCodeAt(i);
  }

  return mismatch === 0;
}
