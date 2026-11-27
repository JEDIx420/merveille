"use client";

import { useState, useEffect } from "react";
import { Badge, readResponse } from "@/components/ui";

export function AdminQuotaPanel() {
  const [snapshot, setSnapshot] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/admin/quotas")
      .then(async (res) => (res.ok ? readResponse(res) : null))
      .then((data: any) => {
        if (data?.policy) setSnapshot(data);
      })
      .catch(() => {});
  }, []);

  if (!snapshot) return null;

  const { policy, storage, daily, seats } = snapshot;

  return (
    <section className="card" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Cloudflare Free-Tier Operational Envelope</h2>
          <p className="text-muted" style={{ fontSize: "0.8rem" }}>
            Live admission ceilings (no automatic paid fallback).
          </p>
        </div>
        <Badge>Free Plan</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem", fontSize: "0.82rem" }}>
        <div style={{ padding: "0.5rem", border: "1px solid var(--merveille-border)", borderRadius: "6px" }}>
          <div className="text-muted">Access Seats</div>
          <strong>{seats?.activeUsers ?? 0} active + {seats?.pendingInvites ?? 0} pending / {policy.maxAccessSeats}</strong>
        </div>
        <div style={{ padding: "0.5rem", border: "1px solid var(--merveille-border)", borderRadius: "6px" }}>
          <div className="text-muted">R2 Primary Storage</div>
          <strong>{Math.round((storage?.primaryBytesUsed || 0) / 1_000_000)} MB / {Math.round(policy.maxR2PrimaryBytes / 1_000_000)} MB</strong>
        </div>
        <div style={{ padding: "0.5rem", border: "1px solid var(--merveille-border)", borderRadius: "6px" }}>
          <div className="text-muted">Workers AI Today</div>
          <strong>{daily?.aiNeurons?.used ?? 0} / {policy.maxAiNeuronsDaily} neurons</strong>
        </div>
        <div style={{ padding: "0.5rem", border: "1px solid var(--merveille-border)", borderRadius: "6px" }}>
          <div className="text-muted">Queue Ops Today</div>
          <strong>{daily?.queueOps?.used ?? 0} / {policy.maxQueueOpsDaily}</strong>
        </div>
      </div>
    </section>
  );
}
