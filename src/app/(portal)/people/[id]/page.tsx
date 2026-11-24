"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { formatBusinessDate } from "@/shared/config";

export default function PersonDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [disabledSuccess, setDisabledSuccess] = useState(false);

  useEffect(() => {
    loadPerson();
  }, [id]);

  async function loadPerson() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people");
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load directory");
      const found = (data.people || []).find((p: any) => p.id === id);
      if (!found) throw new Error("Person not found");
      setPerson(found);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!reason.trim()) {
      alert("Please provide an administrative reason for deactivation.");
      return;
    }
    setDisabling(true);
    setError("");

    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISABLE", reason }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable account");
      setDisabledSuccess(true);
      loadPerson();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDisabling(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "2rem", color: "var(--merveille-muted)" }}>Loading person details...</div>;
  }

  if (error || !person) {
    return (
      <div className="card" style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <h1 className="text-section" style={{ color: "var(--merveille-danger)", marginBottom: "0.5rem" }}>
          Error
        </h1>
        <p style={{ color: "var(--merveille-muted)", marginBottom: "1.5rem" }}>{error || "Person not found."}</p>
        <a href="/people" className="btn-secondary">Back to People Register</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <a href="/people" style={{ fontSize: "0.875rem", color: "var(--merveille-gold-text)", display: "inline-flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.5rem" }}>
          &larr; Back to People Register
        </a>
        <h1 className="text-display">{person.name}</h1>
        <p className="text-muted">{person.email} &bull; Joined {formatBusinessDate(person.createdAt)}</p>
      </div>

      <div className="card">
        <h2 className="text-section" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Account Status & Assigned Roles
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)", marginBottom: "0.25rem" }}>Account Status</div>
            <span className={`badge ${person.status === "ACTIVE" ? "badge-success" : person.status === "INVITED" ? "badge-warning" : "badge-danger"}`}>
              {person.status}
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)", marginBottom: "0.25rem" }}>Active Project Assignments</div>
            <div style={{ fontWeight: 600 }}>{person.projectCount} Projects</div>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)", marginBottom: "0.5rem" }}>Granted Capability Bundles</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {person.roles.map((r: string) => (
              <span key={r} className="badge" style={{ backgroundColor: "var(--merveille-selection)", color: "var(--merveille-gold-text)" }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone: Disable Account */}
      {person.status !== "DISABLED" && (
        <div className="card" style={{ borderColor: "#FBEDEB", backgroundColor: "#FFFAFA" }}>
          <h2 className="text-section" style={{ color: "var(--merveille-danger)", fontSize: "1.125rem", marginBottom: "0.5rem" }}>
            Deactivate User Access (AC-006)
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", marginBottom: "1rem" }}>
            Disabling immediately revokes portal access, active sessions, and file downloads while preserving historical drawings, reviews, and audit records with author attribution.
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
              Administrative Reason for Deactivation
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Project engagement concluded / access revocation"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid var(--merveille-control-border)",
                borderRadius: "var(--merveille-radius-control)",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <button
            onClick={handleDisable}
            disabled={disabling}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "0.5rem 1.25rem",
              backgroundColor: "var(--merveille-danger)",
              color: "#FFF",
              borderRadius: "var(--merveille-radius-control)",
              fontWeight: 500,
            }}
          >
            {disabling ? "Deactivating..." : "Confirm Account Deactivation"}
          </button>
        </div>
      )}

      {disabledSuccess && (
        <div style={{ padding: "1rem", backgroundColor: "#E8F2E9", color: "var(--merveille-success)", borderRadius: "8px" }}>
          Account deactivated successfully. Historical authorship and audit records retained.
        </div>
      )}
    </div>
  );
}
