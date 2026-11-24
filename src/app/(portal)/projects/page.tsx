"use client";

import { useState, useEffect } from "react";
import { formatBusinessDate } from "@/shared/config";

interface ProjectItem {
  id: string;
  code: string;
  name: string;
  site_location: string;
  stage: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  quote_accepted_at: number | null;
  advance_confirmed_at: number | null;
  manager_name: string | null;
  main_client_name: string | null;
  created_at: number;
}

const STAGES = [
  "All Stages",
  "Schematic Design",
  "Design Development",
  "Statutory & Permit Drawings",
  "Tender Documentation & GFC",
  "Site Execution & Supervision",
  "Handover & Project Closeout",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All Stages");
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [stageFilter, includeArchived]);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (stageFilter !== "All Stages") params.set("stage", stageFilter);
      if (search.trim()) params.set("query", search.trim());
      if (includeArchived) params.set("includeArchived", "true");

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load projects");
      }
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadProjects();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 className="text-display">Project Portfolio</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Active architectural commissions, stage timelines, and contractual status.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <a href="/enquiries/new" className="btn-secondary">
            + New Intake
          </a>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "260px" }}
        >
          <input
            type="search"
            placeholder="Search by code, title, or site location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "4px",
              backgroundColor: "var(--merveille-charcoal)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.875rem",
            }}
          />
          <button type="submit" className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>
            Search
          </button>
        </form>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "4px",
              backgroundColor: "var(--merveille-charcoal)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#fff",
              fontSize: "0.875rem",
            }}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8125rem",
              color: "var(--merveille-muted)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include Archived
          </label>
        </div>
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

      {/* Projects List */}
      {loading ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          Loading active project portfolio...
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem", color: "#fff" }}>
            No matching projects found
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            Convert an accepted enquiry or check your stage filters.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {projects.map((p) => {
            const hasCommercialGate = p.quote_accepted_at && p.advance_confirmed_at;

            return (
              <a
                key={p.id}
                href={`/projects/${p.id}/overview`}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  padding: "1.25rem",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        padding: "0.2rem 0.4rem",
                        borderRadius: "3px",
                        backgroundColor: "rgba(197, 160, 89, 0.15)",
                        color: "var(--merveille-gold)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {p.code}
                    </span>

                    <span
                      className={`badge badge-${
                        p.status === "ACTIVE"
                          ? "active"
                          : p.status === "PAUSED"
                          ? "paused"
                          : "draft"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "#fff",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {p.name}
                  </h2>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--merveille-muted)",
                      marginBottom: "1rem",
                    }}
                  >
                    {p.site_location || "Location not recorded"}
                  </p>

                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      fontSize: "0.8125rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <span className="text-muted">Current Stage: </span>
                    <strong style={{ color: "var(--merveille-gold)" }}>{p.stage}</strong>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    paddingTop: "0.75rem",
                    fontSize: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-muted">Main Client:</span>
                    <span>{p.main_client_name || "Unassigned"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-muted">Project Manager:</span>
                    <span>{p.manager_name || "Unassigned"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-muted">Commercial Gates:</span>
                    <span
                      style={{
                        color: hasCommercialGate ? "#4ade80" : "#fbbf24",
                        fontWeight: 500,
                      }}
                    >
                      {hasCommercialGate
                        ? "Gate Cleared"
                        : p.quote_accepted_at
                        ? "Awaiting Advance"
                        : "Quote Pending"}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
