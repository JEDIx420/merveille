"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { Button, Badge, readResponse } from "@/components/ui";

export function ExternalClearancePanel({ projectId }: { projectId: string }) {
  const { principal } = useSession();
  const isAdmin = hasCapability(principal, "ADMIN");
  const [mode, setMode] = useState<string>("EXTERNAL");
  const [clearances, setClearances] = useState<any[]>([]);
  const [entityType, setEntityType] = useState<"QUOTATION" | "CHANGE_REQUEST">("QUOTATION");
  const [entityId, setEntityId] = useState("");
  const [versionNumber, setVersionNumber] = useState("1");
  const [clearanceType, setClearanceType] = useState<"ADVANCE_RECEIVED" | "PAYMENT_CLEARED" | "WAIVED">("ADVANCE_RECEIVED");
  const [externalReference, setExternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [clRes, modeRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/clearance`),
        fetch("/api/admin/commercial-mode"),
      ]);
      if (clRes.ok) {
        const clJson: any = await readResponse(clRes);
        setClearances(clJson.clearances || []);
      }
      if (modeRes.ok) {
        const modeJson: any = await readResponse(modeRes);
        if (modeJson.commercialMode) setMode(modeJson.commercialMode);
      }
    } catch {
      // Non-fatal if user lacks access to admin mode endpoint
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/clearance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId: entityId.trim(),
          versionNumber: Number(versionNumber) || 1,
          clearanceType,
          externalReference: externalReference.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not record clearance");
      setEntityId("");
      setExternalReference("");
      setNotes("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusAction(clearanceId: string, action: "CORRECTED" | "REVOKED") {
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/clearance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          clearanceId,
          reason: action === "REVOKED" ? "Revoked by administrator" : "Corrected by administrator",
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not update clearance");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section className="card" style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>External Commercial Clearance</h2>
          <p className="text-muted" style={{ fontSize: "0.82rem" }}>
            Billing &amp; payments are managed outside the portal. Historical records remain read-only; project activation and extra-work authorization require ADMIN-confirmed clearance tied to the accepted scope version.
          </p>
        </div>
        <Badge>{mode === "EXTERNAL" ? "External Billing Mode" : "Legacy Portal Mode"}</Badge>
      </div>

      {error && (
        <div role="alert" style={{ color: "var(--merveille-danger)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      {clearances.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {clearances.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", fontSize: "0.82rem" }}>
              <div>
                <strong>{c.entity_type}</strong> ({c.entity_id}) V{c.version_number} • {c.clearance_type} • Ref: <code>{c.external_reference}</code>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <Badge>{c.status}</Badge>
                {isAdmin && c.status === "CONFIRMED" && (
                  <>
                    <button type="button" className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleStatusAction(c.id, "CORRECTED")}>
                      Mark Corrected
                    </button>
                    <button type="button" className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleStatusAction(c.id, "REVOKED")}>
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <form onSubmit={handleRecord} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", alignItems: "end" }}>
          <select aria-label="Scope entity type" value={entityType} onChange={(e) => setEntityType(e.target.value as any)} style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}>
            <option value="QUOTATION">Quotation</option>
            <option value="CHANGE_REQUEST">Change Request</option>
          </select>
          <input type="text" required placeholder="Quote / CR ID *" value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }} />
          <input type="number" min={1} required placeholder="Version #" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }} />
          <select aria-label="Clearance type" value={clearanceType} onChange={(e) => setClearanceType(e.target.value as any)} style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}>
            <option value="ADVANCE_RECEIVED">Advance Received</option>
            <option value="PAYMENT_CLEARED">Payment Cleared</option>
            <option value="WAIVED">Waived</option>
          </select>
          <input type="text" required placeholder="External Ref # *" value={externalReference} onChange={(e) => setExternalReference(e.target.value)} style={{ padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }} />
          <Button type="submit" disabled={saving}>
            {saving ? "Recording…" : "Confirm Clearance"}
          </Button>
        </form>
      )}
    </section>
  );
}
