"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { buildPreparedWhatsAppMessage, type PreparedWhatsAppInput } from "@/shared/whatsapp-share";

export function ManualWhatsAppShare({
  input,
  isPublishedOrReleased,
}: {
  input: Omit<PreparedWhatsAppInput, "appOrigin">;
  isPublishedOrReleased: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [clipboardError, setClipboardError] = useState(false);

  if (!isPublishedOrReleased) {
    return null; // Only offered on client-released drawings and manager-published updates
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://portal.merveilledesigns.com";
  const messageText = buildPreparedWhatsAppMessage({ ...input, appOrigin: origin });

  async function handleCopy() {
    setClipboardError(false);
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
      setClipboardError(true);
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${input.projectName} — ${input.title}`,
          text: messageText,
        });
      } catch {
        // Cancellation preserves the preview without claiming delivery
      }
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.85rem" }}>Prepared WhatsApp Message</strong>
        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
          Copy, choose your project group in WhatsApp Web, and send manually.
        </span>
      </div>

      <textarea
        readOnly
        rows={6}
        value={messageText}
        aria-label="Prepared WhatsApp message text"
        onFocus={(e) => e.currentTarget.select()}
        style={{
          width: "100%",
          fontFamily: "inherit",
          fontSize: "0.82rem",
          padding: "0.55rem",
          borderRadius: "6px",
          border: "1px solid var(--merveille-border)",
          background: "var(--merveille-surface)",
          color: "var(--merveille-ink)",
          resize: "vertical",
        }}
      />

      {clipboardError && (
        <div style={{ fontSize: "0.78rem", color: "var(--merveille-warning)" }}>
          Clipboard permission was denied. Select the text above and copy manually (Ctrl/Cmd+C).
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <Button type="button" onClick={handleCopy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? "Copied" : "Copy update"}</span>
        </Button>

        <a
          href="https://web.whatsapp.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.8rem", fontSize: "0.82rem" }}
        >
          <ExternalLink size={14} aria-hidden="true" />
          <span>Open WhatsApp Web</span>
        </a>

        {canNativeShare && (
          <Button type="button" secondary onClick={handleNativeShare}>
            <Share2 size={14} aria-hidden="true" />
            <span>Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}
