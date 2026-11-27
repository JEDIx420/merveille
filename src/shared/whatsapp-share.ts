/**
 * Deterministic Manual WhatsApp Message Preparation (Stage N04, NAC-011).
 * Only for client-released drawings and manager-published updates.
 * Never enqueues outbound delivery, never exposes internal text or public R2 URLs.
 */

import { formatBusinessDate } from "@/shared/config";

export interface PreparedWhatsAppInput {
  kind: "DRAWING_RELEASE" | "PUBLISHED_UPDATE";
  projectName: string;
  title: string;
  revisionLabel: string;
  releasedAt: number | string;
  approvedSummary?: string | null;
  authenticatedPath: string;
  appOrigin: string;
}

export function buildPreparedWhatsAppMessage(input: PreparedWhatsAppInput): string {
  const cleanOrigin = input.appOrigin.replace(/\/+$/, "");
  const fullLink = `${cleanOrigin}${input.authenticatedPath.startsWith("/") ? "" : "/"}${input.authenticatedPath}`;
  const dateStr = formatBusinessDate(input.releasedAt);
  const summary = input.approvedSummary?.trim()
    ? ` ${input.approvedSummary.trim()}`
    : "";

  const actionLine =
    input.kind === "DRAWING_RELEASE"
      ? `View drawing: ${fullLink}`
      : `View update: ${fullLink}`;

  return [
    `Merveille Designs — ${input.projectName}`,
    "",
    `${input.title} — Revision ${input.revisionLabel}`,
    "",
    `Released ${dateStr}.${summary}`,
    "",
    actionLine,
  ].join("\n");
}
