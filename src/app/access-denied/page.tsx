import { BRAND_CONFIG } from "@/shared/config";

export default function AccessDeniedPage() {
  return (
    <div style={{ maxWidth: "540px", margin: "4rem auto", padding: "0 1rem" }}>
      <div className="card" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", color: "var(--merveille-danger)", marginBottom: "1rem" }}>
          Access Restricted
        </div>
        <h1 className="text-section" style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Permission Denied
        </h1>
        <p className="text-muted" style={{ marginBottom: "1.5rem", fontSize: "0.9375rem", lineHeight: 1.6 }}>
          You do not have authorization to view this resource. Project access is restricted to active assigned members, and sensitive management functions require administrator authorization.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <a href="/" className="btn-primary">
            Return to Allowed Work
          </a>
          <a href="/login" className="btn-secondary">
            Switch Account
          </a>
        </div>
      </div>
    </div>
  );
}
