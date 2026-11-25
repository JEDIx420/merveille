"use client";
import Link from "next/link";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { cx } from "@/components/utilities";
import { readResponse } from "@/components/ui";
import layout from "./page.module.css";

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
  const { principal } = useSession();
  const canAdd = hasCapability(principal,"ADMIN") || hasCapability(principal,"OWNER") || principal?.intakeAccess;
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
      const data: any = await readResponse(res);
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
    <div className={cx(layout.block1)}>
      {/* Header */}
      <header className={cx(layout.block2)}>
        <div>
          <h1 className={cx("text-display")}>Projects</h1>
          <p className={cx(["text-muted", layout.block3].join(" "))}>
            Your commissions, current stages and project records.
          </p>
        </div>
        <div className={cx(layout.block4)}>
          {canAdd && <Link href="/projects/new" className={cx("btn-primary")}>Add project</Link>}
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className={cx(["card", layout.block5].join(" "))}>
        <form onSubmit={handleSearchSubmit} className={cx(layout.block6)}>
          <input
            aria-label="Search projects"
            type="search"
            placeholder="Search by code, title, or site location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cx(layout.block7)}
          />
          <button
            type="submit"
            className={cx(["btn-secondary", layout.block8].join(" "))}
          >
            Search
          </button>
        </form>

        <div className={cx(layout.block9)}>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className={cx(layout.block10)}
            aria-label="Project stage"
            id="stageFilter"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className={cx(layout.block11)} htmlFor="includeArchived">
            <input
              type="checkbox"
              id="includeArchived"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include Archived
          </label>
        </div>
      </div>

      {error && <div className={cx(layout.block12)}>{error}</div>}

      {/* Projects List */}
      {loading ? (
        <div className={cx(["card text-muted", layout.block13].join(" "))}>
          Loading active project portfolio...
        </div>
      ) : error ? null : projects.length === 0 ? (
        <div className={cx(["card text-muted", layout.block14].join(" "))}>
          <p className={cx(layout.block15)}>No matching projects found</p>
          <p className={cx(layout.block16)}>
            Add a new enquiry or onboard an existing project, or check your filters.
          </p>
        </div>
      ) : (
        <div className={cx(layout.block17)}>
          {projects.map((p) => {
            const hasCommercialGate =
              p.quote_accepted_at && p.advance_confirmed_at;

            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}/overview`}
                className={cx(["card", layout.block18].join(" "))}
              >
                <div>
                  <div className={cx(layout.block19)}>
                    <span className={cx(layout.block20)}>{p.code}</span>

                    <span
                      className={cx(
                        `badge badge-${
                          p.status === "ACTIVE"
                            ? "active"
                            : p.status === "PAUSED"
                              ? "paused"
                              : "draft"
                        }`,
                      )}
                    >
                      {p.status === "DRAFT" ? "Setup pending" : p.status}
                    </span>
                  </div>

                  <h2 className={cx(layout.block21)}>{p.name}</h2>
                  <p className={cx(layout.block22)}>
                    {p.site_location || "Location not recorded"}
                  </p>

                  <div className={cx(layout.block23)}>
                    <span className={cx("text-muted")}>Current Stage: </span>
                    <strong className={cx(layout.block24)}>{p.stage}</strong>
                  </div>
                </div>

                <div className={cx(layout.block25)}>
                  <div className={cx(layout.block26)}>
                    <span className={cx("text-muted")}>Main Client:</span>
                    <span>{p.main_client_name || "Unassigned"}</span>
                  </div>
                  <div className={cx(layout.block27)}>
                    <span className={cx("text-muted")}>Project Manager:</span>
                    <span>{p.manager_name || "Unassigned"}</span>
                  </div>
                  <div className={cx(layout.block28)}>
                    <span className={cx("text-muted")}>
                      Payment requirements:
                    </span>
                    <span
                      style={{
                        color: hasCommercialGate
                          ? "var(--ui-success)"
                          : "#fbbf24",
                      }}
                      className={cx(layout.block29)}
                    >
                      {hasCommercialGate
                        ? "Gate Cleared"
                        : p.quote_accepted_at
                          ? "Awaiting Advance"
                          : "Quote Pending"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
