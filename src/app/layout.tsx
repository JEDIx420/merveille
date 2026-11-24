import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND_CONFIG } from "@/shared/config";

export const metadata: Metadata = {
  title: `${BRAND_CONFIG.companyName} | ${BRAND_CONFIG.descriptor}`,
  description: "Operations and client portal for Merveille Designs architectural practice.",
  icons: {
    icon: BRAND_CONFIG.faviconPath,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#212528",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={BRAND_CONFIG.faviconPath} />
      </head>
      <body>
        <div className="app-container">
          {/* Navigation rail for the architectural practice */}
          <aside className="sidebar-rail" aria-label="Main Navigation">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Desktop full logo */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "0.5rem 0",
                }}
              >
                <img
                  src={BRAND_CONFIG.logoPath}
                  alt={BRAND_CONFIG.companyName}
                  style={{
                    width: "150px",
                    height: "150px",
                    objectFit: "contain",
                    borderRadius: "4px",
                  }}
                  className="desktop-logo"
                />
              </div>

              {/* Mobile identity banner */}
              <div
                className="mobile-header"
                style={{
                  display: "none",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <img
                  src={BRAND_CONFIG.profileLogoPath}
                  alt=""
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--merveille-gold)" }}>
                    {BRAND_CONFIG.companyName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
                    {BRAND_CONFIG.descriptor}
                  </div>
                </div>
              </div>

              {/* Navigation links */}
              <nav style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <a
                  href="/"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "6px",
                    color: "var(--merveille-foreground)",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <span>Overview</span>
                </a>
                <a
                  href="/projects"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "6px",
                    color: "var(--merveille-foreground)",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <span>Projects</span>
                </a>
                <a
                  href="/enquiries"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "6px",
                    color: "var(--merveille-foreground)",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <span>Enquiries & Pipeline</span>
                </a>
                <a
                  href="/people"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "6px",
                    color: "var(--merveille-foreground)",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <span>People & Access</span>
                </a>
                <a
                  href="/login"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "6px",
                    color: "var(--merveille-gold)",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    marginTop: "0.5rem",
                    border: "1px dashed rgba(197, 160, 89, 0.3)",
                  }}
                >
                  <span>Switch Role / User</span>
                </a>
              </nav>
            </div>

            <div style={{ marginTop: "auto", paddingTop: "1.5rem", fontSize: "0.75rem", color: "var(--merveille-muted)" }}>
              <div>{BRAND_CONFIG.companyName}</div>
              <div>{BRAND_CONFIG.timezone}</div>
            </div>
          </aside>

          {/* Main content body */}
          <main className="main-content" id="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
