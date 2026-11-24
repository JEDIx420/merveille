import { BRAND_CONFIG } from "@/shared/config";

export default function NotFound() {
  return (
    <div style={{ maxWidth: "480px", margin: "4rem auto", textAlign: "center" }}>
      <div className="card">
        <h1 className="text-section" style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Page Not Found (404)
        </h1>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          The requested operational resource does not exist or has been archived.
        </p>
        <a href="/" className="btn-primary">
          Return to Portal
        </a>
      </div>
    </div>
  );
}
