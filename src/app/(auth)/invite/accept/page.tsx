"use client";

import { useState, useEffect } from "react";
import { BRAND_CONFIG } from "@/shared/config";

export default function AcceptInvitationPage() {
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activatedRole, setActivatedRole] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  async function handleAccept() {
    if (!token) return;
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }
      setStatus("success");
      setActivatedRole(data.role);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message);
    }
  }

  return (
    <div style={{ maxWidth: "520px", margin: "4rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <img
          src={BRAND_CONFIG.profileLogoPath}
          alt={BRAND_CONFIG.companyName}
          style={{ width: "64px", height: "64px", margin: "0 auto 1.5rem", borderRadius: "8px" }}
        />
        <h1 className="text-section" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Invitation Acceptance
        </h1>
        <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "0.9375rem" }}>
          {BRAND_CONFIG.companyName} Architectural Portal
        </p>

        {status === "success" ? (
          <div style={{ padding: "1.5rem", backgroundColor: "#E8F2E9", borderRadius: "8px", color: "var(--merveille-success)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Invitation Accepted
            </h2>
            <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Your account has been activated with role <strong>{activatedRole}</strong>.
            </p>
            <a href="/" className="btn-primary" style={{ display: "inline-block" }}>
              Go to Portal Home
            </a>
          </div>
        ) : (
          <div>
            {status === "error" && (
              <div style={{ padding: "1rem", backgroundColor: "#FBEDEB", color: "var(--merveille-danger)", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
                {errorMessage}
              </div>
            )}

            <div style={{ marginBottom: "1.5rem", textAlign: "left" }}>
              <label htmlFor="token-input" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                Invitation Token
              </label>
              <input
                id="token-input"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token or follow link..."
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--merveille-control-border)",
                  borderRadius: "var(--merveille-radius-control)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <button
              onClick={handleAccept}
              disabled={status === "submitting" || !token}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {status === "submitting" ? "Activating..." : "Accept Invitation & Activate Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
