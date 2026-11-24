"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEnquiryPage() {
  const router = useRouter();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          siteLocation,
          requirementsText: requirementsText || undefined,
        }),
      });

      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record enquiry");

      router.push(`/enquiries/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/enquiries" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Enquiries
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>Record Intake</span>
      </nav>

      <div>
        <h1 className="text-display">Record Client Enquiry</h1>
        <p className="text-muted" style={{ marginTop: "0.25rem" }}>
          Capture prospective client brief, project location, and preliminary spatial requirements.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#fca5a5",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.35rem" }}>
            Prospect / Client Name *
          </label>
          <input
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Rahul Menon"
            style={{
              width: "100%",
              padding: "0.625rem",
              borderRadius: "4px",
              backgroundColor: "var(--merveille-charcoal)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.35rem" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="rahul@example.com"
              style={{
                width: "100%",
                padding: "0.625rem",
                borderRadius: "4px",
                backgroundColor: "var(--merveille-charcoal)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.35rem" }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98470 12345"
              style={{
                width: "100%",
                padding: "0.625rem",
                borderRadius: "4px",
                backgroundColor: "var(--merveille-charcoal)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: "0.875rem",
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.35rem" }}>
            Site Location *
          </label>
          <input
            type="text"
            required
            value={siteLocation}
            onChange={(e) => setSiteLocation(e.target.value)}
            placeholder="e.g. Aluva, Ernakulam, Kerala"
            style={{
              width: "100%",
              padding: "0.625rem",
              borderRadius: "4px",
              backgroundColor: "var(--merveille-charcoal)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.35rem" }}>
            Initial Project Brief & Spatial Requirements
          </label>
          <textarea
            rows={4}
            value={requirementsText}
            onChange={(e) => setRequirementsText(e.target.value)}
            placeholder="e.g. 4-bedroom contemporary tropical residence with central courtyard, approximately 4,200 sq.ft..."
            style={{
              width: "100%",
              padding: "0.625rem",
              borderRadius: "4px",
              backgroundColor: "var(--merveille-charcoal)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
          <a href="/enquiries" className="btn-secondary">
            Cancel
          </a>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Recording..." : "Record Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
