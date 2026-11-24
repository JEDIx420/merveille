import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BRAND_CONFIG, formatRupees, formatBusinessDate } from "@/shared/config";

export default async function HomePage() {
  let dbStatus = "Connecting...";
  let r2Status = "Connecting...";
  let appEnv = "local";

  try {
    const { env } = await getCloudflareContext({ async: true });
    appEnv = env.APP_ENV || "local";
    dbStatus = env.DB ? "Bound & Operational (D1)" : "Unbound";
    r2Status = env.PROJECT_FILES ? "Bound & Operational (Private R2)" : "Unbound";
  } catch (err) {
    dbStatus = "Development Fallback";
    r2Status = "Development Fallback";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header section */}
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="text-display">{BRAND_CONFIG.portalTitle}</h1>
            <p className="text-muted" style={{ marginTop: "0.25rem" }}>
              {BRAND_CONFIG.descriptor} &bull; Verified Workers Runtime Foundation
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span className="badge badge-success">
              <span>●</span> workerd active
            </span>
            <span className="badge" style={{ backgroundColor: "var(--merveille-selection)", color: "var(--merveille-gold-text)" }}>
              {appEnv}
            </span>
          </div>
        </div>
      </header>

      {/* Overview Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", marginBottom: "0.5rem" }}>
            Relational Persistence
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--merveille-ink)" }}>
            {dbStatus}
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--merveille-muted)" }}>
            Transactional schema, prepared operations & immutable audit logs.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", marginBottom: "0.5rem" }}>
            Private Object Storage
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--merveille-ink)" }}>
            {r2Status}
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--merveille-muted)" }}>
            Private buckets, authenticated gates & immutable version keys.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", marginBottom: "0.5rem" }}>
            Currency & Locale Standard
          </div>
          <div className="text-money" style={{ fontSize: "1.25rem", color: "var(--merveille-ink)" }}>
            {formatRupees(25000000)}
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--merveille-muted)" }}>
            {BRAND_CONFIG.currency.code} integer minor units &bull; {formatBusinessDate(new Date())}
          </p>
        </div>
      </div>

      {/* Runtime Verification Panel */}
      <section className="card" aria-labelledby="verification-heading">
        <h2 id="verification-heading" className="text-section" style={{ marginBottom: "1rem" }}>
          Phase 00: Runtime Verification Endpoint
        </h2>
        <p style={{ color: "var(--merveille-muted)", marginBottom: "1.5rem" }}>
          The runtime spike exercises real workerd SSR, server actions/mutations, D1 prepared batch statements, and R2 object streaming.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <a href="/api/runtime/spike" className="btn-primary" target="_blank" rel="noopener noreferrer">
            Execute Runtime Spike (GET)
          </a>
        </div>
      </section>
    </div>
  );
}
