"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface TaskItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status:
    | "PENDING_ASSIGNMENT"
    | "TODO"
    | "IN_PROGRESS"
    | "BLOCKED"
    | "COMPLETED"
    | "CANCELLED";
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
  const feedback = useFeedback();
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
  const [newPriority, setNewPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
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
  const [reopenCategory, setReopenCategory] = useState<
    | "CORRECTION_DEFECT"
    | "CLIENT_SCOPE_CHANGE"
    | "EXTERNAL_DEPENDENCY"
    | "ADMINISTRATIVE"
  >("CORRECTION_DEFECT");
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
      const res = await fetch(
        `/api/projects/${projectId}/tasks?status=${statusFilter}`,
      );
      const json: any = await readResponse(res);
      if (!res.ok)
        throw new Error(json.error || "Failed to load project tasks");
      setTasks(json.tasks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeam() {
    try {
      const res = await fetch(`/api/projects/${projectId}/participants`);
      const json: any = await readResponse(res);
      if (res.ok) setUsersList(json.participants || []);
    } catch (err: any) {
      setError(
        err.message || "Unable to load project participants. Try again.",
      );
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

      const json: any = await readResponse(res);
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

      const json: any = await readResponse(res);
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

      const json: any = await readResponse(res);
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
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to start task");
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCompleteTask(task: TaskItem) {
    const note = await feedback.prompt(
      "Enter completion notes or evidence summary:",
    );
    if (note === null) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "COMPLETE",
          completionNote: note,
          expectedRevision: task.revision,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to complete task");
      setActionSuccess("Task marked as completed.");
      loadTasks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className={cx(layout.block1)}>
      {/* Breadcrumb */}
      <nav className={cx(layout.block2)}>
        <a href="/projects" className={cx(layout.block3)}>
          Projects
        </a>
        <span>/</span>
        <a
          href={`/projects/${projectId}/overview`}
          className={cx(layout.block4)}
        >
          Overview
        </a>
        <span>/</span>
        <span className={cx(layout.block5)}>Tasks</span>
      </nav>

      {/* Header */}
      <header className={cx(layout.block6)}>
        <div>
          <h1 className={cx("text-display")}>Project Tasks & Deadlines</h1>
          <p className={cx(["text-muted", layout.block7].join(" "))}>
            Operational team deliverables, stage associations, and
            manager-controlled deadlines.
          </p>
        </div>
        <PermissionGate
          projectId={projectId}
          roles={["MANAGER", "TEAM_MEMBER"]}
        >
          <ProjectMutation>
            <button
              onClick={() => setShowCreateModal(true)}
              className={cx("btn-primary")}
            >
              + Propose Task
            </button>
          </ProjectMutation>
        </PermissionGate>
      </header>

      {/* Confidentiality Notice */}
      <div
        className={cx("card")}
        style={{
          borderLeft: "3px solid var(--ui-action)",
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          backgroundColor: "var(--ui-surface-subtle)",
        }}
      >
        <strong
          style={{
            color: "var(--ui-action)",
            display: "block",
            marginBottom: "0.25rem",
          }}
        >
          Internal Practice Records Only
        </strong>
        <p style={{ color: "var(--ui-text)", margin: 0, lineHeight: 1.5 }}>
          Tasks, discussions, blockers, and internal attachments are
          confidential practice records (). Client progress is communicated
          exclusively through manager-approved published updates.
        </p>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className={cx(layout.block8)}>{actionSuccess}</div>
      )}

      {error && <div className={cx(layout.block9)}>{error}</div>}

      {/* Status Filter Tabs */}
      <div className={cx(layout.block10)}>
        {["ALL", "TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              backgroundColor:
                statusFilter === tab
                  ? "var(--ui-surface-subtle)"
                  : "transparent",
              color:
                statusFilter === tab
                  ? "var(--ui-action)"
                  : "var(--ui-text-muted)",
            }}
            className={cx(layout.block11)}
          >
            {tab === "ALL" ? "All Tasks" : tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className={cx(["card text-muted", layout.block12].join(" "))}>
          Loading tasks...
        </div>
      ) : error ? null : tasks.length === 0 ? (
        <div className={cx(["card text-muted", layout.block13].join(" "))}>
          No tasks found for this view.
        </div>
      ) : (
        <div className={cx(layout.block14)}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cx(["card", layout.block15].join(" "))}
              style={{
                borderLeft: task.isOverdue
                  ? "3px solid var(--ui-danger)"
                  : task.status === "COMPLETED"
                    ? "3px solid var(--ui-success)"
                    : "3px solid var(--ui-divider)",
              }}
            >
              <div className={cx(layout.block16)}>
                <div className={cx(layout.block17)}>
                  <span
                    className={cx(
                      `badge badge-${
                        task.status === "COMPLETED"
                          ? "active"
                          : task.status === "BLOCKED"
                            ? "paused"
                            : "draft"
                      }`,
                    )}
                  >
                    {task.status}
                  </span>

                  <span
                    style={{
                      backgroundColor:
                        task.priority === "URGENT" || task.priority === "HIGH"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "var(--ui-divider)",
                      color:
                        task.priority === "URGENT" || task.priority === "HIGH"
                          ? "var(--ui-danger)"
                          : "var(--ui-text-muted)",
                    }}
                    className={cx(layout.block18)}
                  >
                    {task.priority}
                  </span>

                  {task.isOverdue && (
                    <span className={cx(layout.block19)}>OVERDUE</span>
                  )}

                  {task.reopen_count > 0 && (
                    <span className={cx(layout.block20)}>
                      Reopened {task.reopen_count}x
                    </span>
                  )}
                </div>

                <h3 className={cx(layout.block21)}>{task.title}</h3>
                {task.description && (
                  <p className={cx(layout.block22)}>{task.description}</p>
                )}

                <div className={cx(layout.block23)}>
                  <div>
                    <span>Assignee: </span>
                    <strong className={cx(layout.block24)}>
                      {task.assignee_name || "Unassigned"}
                    </strong>
                  </div>
                  <div>
                    <span>Official Deadline: </span>
                    <strong
                      style={{
                        color: task.isOverdue
                          ? "var(--ui-danger)"
                          : "var(--ui-text)",
                      }}
                    >
                      {task.effective_due_date || "Not set by manager"}
                    </strong>
                  </div>
                  {task.stage_name && (
                    <div>
                      <span>Stage: </span>
                      <span className={cx(layout.block25)}>
                        {task.stage_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className={cx(layout.block26)}>
                {task.status === "TODO" && (
                  <ProjectMutation>
                    <button
                      onClick={() => handleStartWork(task)}
                      className={cx(
                        ["btn-secondary", layout.block27].join(" "),
                      )}
                    >
                      Start Work
                    </button>
                  </ProjectMutation>
                )}

                {(task.status === "TODO" || task.status === "IN_PROGRESS") && (
                  <ProjectMutation>
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className={cx(["btn-primary", layout.block28].join(" "))}
                    >
                      Mark Complete
                    </button>
                  </ProjectMutation>
                )}

                {task.status === "COMPLETED" && (
                  <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                    <ProjectMutation>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowReopenModal(true);
                        }}
                        className={cx(
                          ["btn-secondary", layout.block29].join(" "),
                        )}
                      >
                        Reopen Work
                      </button>
                    </ProjectMutation>
                  </PermissionGate>
                )}

                {/* Manager Assignment / Deadline setting */}
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <ProjectMutation>
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setAssigneeId(task.assignee_user_id || "");
                        setAssignDueDate(task.effective_due_date || "");
                        setShowAssignModal(true);
                      }}
                      className={cx(
                        ["btn-secondary", layout.block30].join(" "),
                      )}
                    >
                      Manage Deadline
                    </button>
                  </ProjectMutation>
                </PermissionGate>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <Dialog
          title="Propose Project Task"
          onClose={() => setShowCreateModal(false)}
        >
          <div className={cx(["card", layout.block32].join(" "))}>
            <h3 className={cx(layout.block33)}>Propose Project Task</h3>
            <p className={cx(["text-muted", layout.block34].join(" "))}>
              Practice members can propose tasks. The project manager assigns
              and sets the official baseline deadline.
            </p>
            <form onSubmit={handleCreateSubmit} className={cx(layout.block35)}>
              <div>
                <label className={cx(layout.block36)} htmlFor="newTitle">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Model structural columns for living room pavilion"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={cx(layout.block37)}
                  id="newTitle"
                />
              </div>

              <div>
                <label className={cx(layout.block38)}>
                  Description & Deliverable Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the technical specifications, reference drawings, or coordination notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={cx(layout.block39)}
                />
              </div>

              <div className={cx(layout.block40)}>
                <div>
                  <label className={cx(layout.block41)} htmlFor="newPriority">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className={cx(layout.block42)}
                    id="newPriority"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label
                    className={cx(layout.block43)}
                    htmlFor="proposedDueDate"
                  >
                    Proposed Due Date
                  </label>
                  <input
                    type="date"
                    value={proposedDueDate}
                    onChange={(e) => setProposedDueDate(e.target.value)}
                    className={cx(layout.block44)}
                    id="proposedDueDate"
                  />
                </div>
              </div>

              <div className={cx(layout.block45)}>
                <PermissionGate
                  projectId={projectId}
                  roles={["MANAGER", "TEAM_MEMBER"]}
                >
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={cx("btn-secondary")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Assign / Deadline Modal (Manager only) */}
      {showAssignModal && selectedTask && (
        <Dialog
          title="Manager Assignment & Deadline Authority"
          onClose={() => setShowAssignModal(false)}
        >
          <div className={cx(["card", layout.block47].join(" "))}>
            <h3 className={cx(layout.block48)}>
              Manager Assignment & Deadline Authority
            </h3>
            <p className={cx(["text-muted", layout.block49].join(" "))}>
              Official due dates and assignments are controlled by practice
              managers (). Prior deadlines are recorded in the audit journal.
            </p>
            <form onSubmit={handleAssignSubmit} className={cx(layout.block50)}>
              <div>
                <label className={cx(layout.block51)} htmlFor="assigneeId">
                  Assigned Team Member *
                </label>
                <select
                  required
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={cx(layout.block52)}
                  id="assigneeId"
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
                <label className={cx(layout.block53)} htmlFor="assignDueDate">
                  Official Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className={cx(layout.block54)}
                  id="assignDueDate"
                />
              </div>

              <div>
                <label className={cx(layout.block55)} htmlFor="assignReason">
                  Assignment / Change Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule baseline or client milestone alignment..."
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className={cx(layout.block56)}
                  id="assignReason"
                />
              </div>

              <div className={cx(layout.block57)}>
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className={cx("btn-secondary")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Reopen Modal (Manager only) */}
      {showReopenModal && selectedTask && (
        <Dialog
          title="Reopen Completed Task"
          onClose={() => setShowReopenModal(false)}
        >
          <div className={cx(["card", layout.block59].join(" "))}>
            <h3 className={cx(layout.block60)}>Reopen Completed Task</h3>
            <p className={cx(["text-muted", layout.block61].join(" "))}>
              Per , manager reopening preserves original completion history and
              logs a structured rework category for quality reporting.
            </p>
            <form onSubmit={handleReopenSubmit} className={cx(layout.block62)}>
              <div>
                <label className={cx(layout.block63)} htmlFor="reopenCategory">
                  Rework Category *
                </label>
                <select
                  value={reopenCategory}
                  onChange={(e) => setReopenCategory(e.target.value as any)}
                  className={cx(layout.block64)}
                  id="reopenCategory"
                >
                  <option value="CORRECTION_DEFECT">
                    Correction / Quality Defect
                  </option>
                  <option value="CLIENT_SCOPE_CHANGE">
                    Client Scope Change
                  </option>
                  <option value="EXTERNAL_DEPENDENCY">
                    External Dependency / Regulatory Feedback
                  </option>
                  <option value="ADMINISTRATIVE">
                    Administrative Correction
                  </option>
                </select>
              </div>

              <div>
                <label className={cx(layout.block65)}>
                  Detailed Reason for Reopening *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the corrections or additional drafting required..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className={cx(layout.block66)}
                />
              </div>

              <div>
                <label className={cx(layout.block67)} htmlFor="reopenDueDate">
                  Revised Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={reopenDueDate}
                  onChange={(e) => setReopenDueDate(e.target.value)}
                  className={cx(layout.block68)}
                  id="reopenDueDate"
                />
              </div>

              <div className={cx(layout.block69)}>
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(false)}
                    className={cx("btn-secondary")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Reopening..." : "Confirm Reopen"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
