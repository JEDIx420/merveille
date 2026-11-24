import { AuthorizationError } from "@/server/auth/policy";
import type {
  WhatsAppAdapter,
  WhatsAppTemplatePayload,
  WhatsAppSendResult,
} from "@/server/notifications/whatsapp";
/**
 * Synthetic WhatsApp Adapter for local development and deterministic acceptance testing.
 * Enforces AC-049: Rejects any attempt to send sensitive unredacted data, raw files, or salaries.
 */
export class SyntheticWhatsAppAdapter implements WhatsAppAdapter {
  public sentMessages: Array<{
    payload: WhatsAppTemplatePayload;
    result: WhatsAppSendResult;
    timestamp: number;
  }> = [];

  public simulateTimeout = false;
  public simulateFailure = false;

  async sendTemplate(
    payload: WhatsAppTemplatePayload,
  ): Promise<WhatsAppSendResult> {
    // AC-049: Validate safety and privacy - no raw documents or salaries allowed in payload
    for (const [key, value] of Object.entries(payload.templateParameters)) {
      const lowerKey = key.toLowerCase();
      const stringVal = String(value).toLowerCase();

      if (
        lowerKey.includes("salary") ||
        lowerKey.includes("payroll") ||
        lowerKey.includes("raw_document") ||
        stringVal.includes("salary") ||
        stringVal.includes("margin")
      ) {
        throw new AuthorizationError(
          "WhatsApp payload contains prohibited sensitive data (salaries or raw documents).",
          "SENSITIVE_PAYLOAD_DETECTED",
        );
      }
    }

    if (this.simulateTimeout) {
      const result: WhatsAppSendResult = {
        success: false,
        status: "UNKNOWN",
        error: "Provider request timed out. Delivery outcome uncertain.",
      };
      this.sentMessages.push({ payload, result, timestamp: Date.now() });
      return result;
    }

    if (this.simulateFailure) {
      const result: WhatsAppSendResult = {
        success: false,
        status: "FAILED",
        error: "Template not approved or recipient opted out.",
      };
      this.sentMessages.push({ payload, result, timestamp: Date.now() });
      return result;
    }

    const providerMessageId = `wamid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const result: WhatsAppSendResult = {
      success: true,
      providerMessageId,
      status: "DELIVERED",
    };

    this.sentMessages.push({ payload, result, timestamp: Date.now() });
    return result;
  }
}
