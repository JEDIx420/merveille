"use client";

import { useState, useEffect } from "react";
import { formatBusinessDate } from "@/shared/config";

interface Person {
  id: string;
  email: string;
  name: string;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  roles: string[];
  projectCount: number;
  createdAt: number;
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Invite form state
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("STAFF");
  const [projectId, setProjectId] = useState("");
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadPeople();
  }, []);

  async function loadPeople() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people");
      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load people register");
      }
      setPeople(data.people || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    setError("");

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName,
          role,
          projectId: projectId || undefined,
        }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue invitation");
      }

      setInviteResult(data);
      setEmail("");
      setDisplayName("");
      loadPeople();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">People & Access</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Administrate team memberships, consultant assignments, and client contractual access.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href="/login" className="btn-secondary">
            Switch Test Role
          </a>
        </div>
      </header>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FBEDEB", color: "var(--merveille-danger)", borderRadius: "8px" }}>
          {error}
        </div>
      )}

      {/* Main Grid: People Table + Invite Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem", alignItems: "start" }}>
        {/* People Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--merveille-divider)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="text-section" style={{ fontSize: "1.125rem" }}>
              Registered Identities ({people.length})
            </h2>
            <button onClick={loadPeople} className="btn-secondary" style={{ minHeight: "36px", padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}>
              Refresh
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--merveille-divider)", color: "var(--merveille-muted)", fontSize: "0.8125rem" }}>
                  <th style={{ padding: "0.875rem 1.5rem" }}>Name & Identity</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Roles</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Projects</th>
                  <th style={{ padding: "0.875rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.875rem 1.5rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--merveille-muted)" }}>
                      Loading directory...
                    </td>
                  </tr>
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--merveille-muted)" }}>
                      No users found. Use the form on the right to invite team members or clients.
                    </td>
                  </tr>
                ) : (
                  people.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--merveille-canvas)" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--merveille-ink)" }}>{p.name}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--merveille-muted)" }}>{p.email}</div>
                      </td>
                      <td style={{ padding: "1rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {p.roles.map((r) => (
                            <span
                              key={r}
                              className="badge"
                              style={{
                                backgroundColor: r === "ADMIN" ? "#FBEDEB" : r === "OWNER" ? "#FFF2D6" : "var(--merveille-selection)",
                                color: r === "ADMIN" ? "var(--merveille-danger)" : r === "OWNER" ? "var(--merveille-warning)" : "var(--merveille-gold-text)",
                                fontSize: "0.75rem",
                              }}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "1rem 1rem", color: "var(--merveille-muted)" }}>
                        {p.projectCount} assigned
                      </td>
                      <td style={{ padding: "1rem 1rem" }}>
                        <span
                          className={`badge ${
                            p.status === "ACTIVE"
                              ? "badge-success"
                              : p.status === "INVITED"
                              ? "badge-warning"
                              : "badge-danger"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                        <a
                          href={`/people/${p.id}`}
                          className="btn-secondary"
                          style={{ minHeight: "32px", padding: "0.25rem 0.625rem", fontSize: "0.8125rem" }}
                        >
                          Manage
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Form */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 className="text-section" style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
            Invite Person
          </h2>

          <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--merveille-control-border)",
                  borderRadius: "var(--merveille-radius-control)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ar. Rahul Menon"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--merveille-control-border)",
                  borderRadius: "var(--merveille-radius-control)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Intended Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--merveille-control-border)",
                  borderRadius: "var(--merveille-radius-control)",
                  fontSize: "0.875rem",
                  backgroundColor: "var(--merveille-surface)",
                }}
              >
                <option value="STAFF">Design Staff</option>
                <option value="MANAGER">Project Manager</option>
                <option value="CONSULTANT">Consultant (Structural/MEP)</option>
                <option value="MAIN_CLIENT">Main Client (Contractual)</option>
                <option value="CLIENT_REP">Client Representative</option>
                <option value="ADMIN">Administrator</option>
                <option value="OWNER">Practice Owner</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Project Scope (Optional ID)
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. prj_villa_alappuzha"
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
              type="submit"
              disabled={inviting}
              className="btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              {inviting ? "Issuing Invitation..." : "Send Invitation"}
            </button>
          </form>

          {inviteResult && (
            <div style={{ marginTop: "1.25rem", padding: "1rem", backgroundColor: "#E8F2E9", borderRadius: "8px", fontSize: "0.8125rem" }}>
              <div style={{ fontWeight: 600, color: "var(--merveille-success)", marginBottom: "0.25rem" }}>
                Invitation Created
              </div>
              <p style={{ color: "var(--merveille-muted)", marginBottom: "0.5rem" }}>
                Single-use link generated for {inviteResult.email}:
              </p>
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}${inviteResult.invitationUrl}`}
                style={{ width: "100%", fontSize: "0.75rem", padding: "0.375rem", border: "1px solid var(--merveille-divider)", borderRadius: "4px" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
