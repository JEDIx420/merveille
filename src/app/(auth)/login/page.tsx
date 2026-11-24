"use client";

import { BRAND_CONFIG } from "@/shared/config";

export default function LoginPage() {
  return (
    <div style={{ maxWidth: "480px", margin: "4rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <img
          src={BRAND_CONFIG.profileLogoPath}
          alt={BRAND_CONFIG.companyName}
          style={{ width: "64px", height: "64px", margin: "0 auto 1.5rem", borderRadius: "8px" }}
        />
        <h1 className="text-section" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          {BRAND_CONFIG.companyName}
        </h1>
        <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "0.9375rem" }}>
          Protected Operations & Client Portal
        </p>

        <div style={{ padding: "1rem", backgroundColor: "var(--merveille-canvas)", borderRadius: "8px", marginBottom: "1.5rem", textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            Authentication Gate
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)" }}>
            Access is invitation-based and verified by Cloudflare Access OTP or enterprise identity.
          </p>
        </div>

        {/* Local Development Quick Role Switcher */}
        <div style={{ borderTop: "1px solid var(--merveille-divider)", paddingTop: "1.5rem", textAlign: "left" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--merveille-gold-text)", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Local Test Identities (workerd)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {[
              { label: "Admin", role: "admin" },
              { label: "Practice Owner", role: "owner" },
              { label: "Design Staff", role: "staff" },
              { label: "Consultant", role: "consultant" },
              { label: "Main Client", role: "client" },
              { label: "Client Rep", role: "rep" },
            ].map(({ label, role }) => (
              <button
                key={role}
                onClick={undefined}
                className="btn-secondary"
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.5rem 0.75rem",
                  minHeight: "40px",
                  justifyContent: "flex-start",
                }}
                // Client-side cookie setter for testing
                // @ts-ignore
                onClickCapture={() => {
                  document.cookie = `merveille_synthetic_principal=${role}; path=/; max-age=86400`;
                  window.location.href = role === "admin" ? "/people" : "/";
                }}
              >
                <span>●</span> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
