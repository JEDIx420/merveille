"use client";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface TaskItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING_ASSIGNMENT" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  creator_name: string | null;
  assignee_name: string | null;
  assignee_user_id: string | null;
  stage_name: string | null;
  original_due_date: string | null;
  effective_due_date: string | null;
  isOverdue: boolean;
  reopen_count: number;
  revision: number;
  created_at: number;
}

export default function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Task Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [proposedDueDate, setProposedDueDate] = useState("");

  // Assign / Deadline Modal
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenCategory, setReopenCategory] = useState<"CORRECTION_DEFECT" | "CLIENT_SCOPE_CHANGE" | "EXTERNAL_DEPENDENCY" | "ADMINISTRATIVE">("CORRECTION_DEFECT");
  const [reopenDueDate, setReopenDueDate] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTasks();
    loadTeam();
  }, [projectId, statusFilter]);

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks?status=${statusFilter}`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load project tasks");
      setTasks(json.tasks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeam() {
    try {
      const res = await fetch("/api/people");
      const json: any = await res.json();
      if (res.ok) setUsersList(json.people || []);
    } catch {
      // Ignore
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          proposedDueDate: proposedDueDate || undefined,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create task");

      setActionSuccess("Task created and submitted to project worklist.");
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setProposedDueDate("");
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN",
          assigneeUserId: assigneeId,
          dueDate: assignDueDate,
          reason: assignReason,
          expectedRevision: selectedTask.revision,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign task");

      setActionSuccess("Task officially assigned with manager deadline.");
      setShowAssignModal(false);
      setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopenSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    setError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REOPEN",
          reason: reopenReason,
          category: reopenCategory,
          newDueDate: reopenDueDate || undefined,
          expectedRevision: selectedTask.revision,
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reopen task");

      setActionSuccess("Task reopened and returned to active delivery.");
      setShowReopenModal(false);
      setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartWork(task: TaskItem) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start task");
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCompleteTask(task: TaskItem) {
    const note = prompt("Enter completion notes or evidence summary:");
    if (note === null) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE", completionNote: note, expectedRevision: task.revision }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to complete task");
      setActionSuccess("Task marked as completed.");
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/projects" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Projects
        </a>
        <span>/</span>
        <a href={`/projects/${projectId}/overview`} style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Overview
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>Tasks</span>
      </nav>

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">Project Tasks & Deadlines</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Operational team deliverables, stage associations, and manager-controlled deadlines.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          + Propose Task
        </button>
      </header>

      {/* Confidentiality Notice (AC-015) */}
      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--merveille-gold)",
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          backgroundColor: "rgba(197, 160, 89, 0.05)",
        }}
      >
        <strong style={{ color: "var(--merveille-gold)", display: "block", marginBottom: "0.25rem" }}>
          Internal Practice Records Only
        </strong>
        <p style={{ color: "var(--merveille-foreground)", margin: 0, lineHeight: 1.5 }}>
          Tasks, discussions, blockers, and internal attachments are confidential practice records (REQ-TSK-005).
          Client progress is communicated exclusively through manager-approved published updates.
        </p>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#86efac",
            fontSize: "0.875rem",
          }}
        >
          {actionSuccess}
        </div>
      )}

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

      {/* Status Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.5rem" }}>
        {["ALL", "TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "4px",
              backgroundColor: statusFilter === tab ? "rgba(197, 160, 89, 0.2)" : "transparent",
              color: statusFilter === tab ? "var(--merveille-gold)" : "var(--merveille-muted)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {tab === "ALL" ? "All Tasks" : tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          No tasks found for this view.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "1.25rem",
                flexWrap: "wrap",
                gap: "1rem",
                borderLeft: task.isOverdue
                  ? "3px solid #ef4444"
                  : task.status === "COMPLETED"
                  ? "3px solid #4ade80"
                  : "3px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div style={{ flex: 1, minWidth: "280px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <span
                    className={`badge badge-${
                      task.status === "COMPLETED"
                        ? "active"
                        : task.status === "BLOCKED"
                        ? "paused"
                        : "draft"
                    }`}
                  >
                    {task.status}
                  </span>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "3px",
                      backgroundColor:
                        task.priority === "URGENT" || task.priority === "HIGH"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(255, 255, 255, 0.05)",
                      color:
                        task.priority === "URGENT" || task.priority === "HIGH"
                          ? "#f87171"
                          : "var(--merveille-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {task.priority}
                  </span>

                  {task.isOverdue && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "3px",
                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                        color: "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      OVERDUE
                    </span>
                  )}

                  {task.reopen_count > 0 && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "3px",
                        backgroundColor: "rgba(234, 179, 8, 0.2)",
                        color: "#facc15",
                      }}
                    >
                      Reopened {task.reopen_count}x
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "#fff", marginBottom: "0.25rem" }}>
                  {task.title}
                </h3>
                {task.description && (
                  <p style={{ fontSize: "0.875rem", color: "var(--merveille-foreground)", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                    {task.description}
                  </p>
                )}

                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "var(--merveille-muted)", flexWrap: "wrap" }}>
                  <div>
                    <span>Assignee: </span>
                    <strong style={{ color: "#fff" }}>{task.assignee_name || "Unassigned"}</strong>
                  </div>
                  <div>
                    <span>Official Deadline: </span>
                    <strong style={{ color: task.isOverdue ? "#f87171" : "#fff" }}>
                      {task.effective_due_date || "Not set by manager"}
                    </strong>
                  </div>
                  {task.stage_name && (
                    <div>
                      <span>Stage: </span>
                      <span style={{ color: "var(--merveille-gold)" }}>{task.stage_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {task.status === "TODO" && (
                  <button
                    onClick={() => handleStartWork(task)}
                    className="btn-secondary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                  >
                    Start Work
                  </button>
                )}

                {(task.status === "TODO" || task.status === "IN_PROGRESS") && (
                  <button
                    onClick={() => handleCompleteTask(task)}
                    className="btn-primary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                  >
                    Mark Complete
                  </button>
                )}

                {task.status === "COMPLETED" && (
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setShowReopenModal(true);
                    }}
                    className="btn-secondary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                  >
                    Reopen Work
                  </button>
                )}

                {/* Manager Assignment / Deadline setting */}
                <button
                  onClick={() => {
                    setSelectedTask(task);
                    setAssigneeId(task.assignee_user_id || "");
                    setAssignDueDate(task.effective_due_date || "");
                    setShowAssignModal(true);
                  }}
                  className="btn-secondary"
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                >
                  Manage Deadline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Propose Project Task
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Practice members can propose tasks. The project manager assigns and sets the official baseline deadline.
            </p>
            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Model structural columns for living room pavilion"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Description & Deliverable Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the technical specifications, reference drawings, or coordination notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      backgroundColor: "var(--merveille-charcoal)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                    Proposed Due Date
                  </label>
                  <input
                    type="date"
                    value={proposedDueDate}
                    onChange={(e) => setProposedDueDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      backgroundColor: "var(--merveille-charcoal)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Deadline Modal (Manager only) */}
      {showAssignModal && selectedTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Manager Assignment & Deadline Authority
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Official due dates and assignments are controlled by practice managers (REQ-TSK-002). Prior deadlines are recorded in the audit journal.
            </p>
            <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Assigned Team Member *
                </label>
                <select
                  required
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="">Select project member...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roles?.join(", ") || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Official Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Assignment / Change Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule baseline or client milestone alignment..."
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal (Manager only) */}
      {showReopenModal && selectedTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "520px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
              Reopen Completed Task
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
              Per REQ-TSK-004, manager reopening preserves original completion history and logs a structured rework category for quality reporting.
            </p>
            <form onSubmit={handleReopenSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Rework Category *
                </label>
                <select
                  value={reopenCategory}
                  onChange={(e) => setReopenCategory(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="CORRECTION_DEFECT">Correction / Quality Defect</option>
                  <option value="CLIENT_SCOPE_CHANGE">Client Scope Change</option>
                  <option value="EXTERNAL_DEPENDENCY">External Dependency / Regulatory Feedback</option>
                  <option value="ADMINISTRATIVE">Administrative Correction</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Detailed Reason for Reopening *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the corrections or additional drafting required..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                  Revised Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={reopenDueDate}
                  onChange={(e) => setReopenDueDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--merveille-charcoal)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Reopening..." : "Confirm Reopen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
