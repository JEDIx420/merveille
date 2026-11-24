"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import { useFeedback } from "@/components/ui";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface SnagAttachment {
  id: string;
  file_id: string;
  attachment_type: string;
  is_internal_only: number;
  caption?: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  uploader_name: string;
}

interface SnagComment {
  id: string;
  user_id: string;
  author_name: string;
  comment_text: string;
  is_internal_only: number;
  created_at: number;
}

interface SnagEvent {
  id: string;
  actor_name: string;
  event_type: string;
  from_status?: string;
  to_status?: string;
  notes?: string;
  resolution_evidence?: string;
  created_at: number;
}

interface SnagDetail {
  id: string;
  project_id: string;
  snag_number: string;
  title: string;
  description: string;
  location_area: string;
  severity: string;
  status: string;
  reported_by_user_id: string;
  reporter_name: string;
  reported_at: number;
  assigned_to_user_id?: string;
  assignee_name?: string;
  assigned_by_user_id?: string;
  manager_name?: string;
  target_date?: string;
  is_client_shared: number;
  is_charged_work: number;
  change_request_id?: string;
  internal_cost_minor?: number;
  internal_notes?: string;
  reopen_count: number;
  created_at: number;
  attachments: SnagAttachment[];
  comments: SnagComment[];
  events: SnagEvent[];
}

export default function SnagsPage() {
  const feedback = useFeedback();
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snagsList, setSnagsList] = useState<any[]>([]);
  const [selectedSnagId, setSelectedSnagId] = useState<string | null>(null);
  const [activeSnag, setActiveSnag] = useState<SnagDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Form states
  const [repTitle, setRepTitle] = useState("");
  const [repDesc, setRepDesc] = useState("");
  const [repLocation, setRepLocation] = useState("");
  const [repSeverity, setRepSeverity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");

  const [participants, setParticipants] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/participants`)
      .then(readResponse)
      .then((d) => setParticipants(d.participants || []))
      .catch((e) => setError(e.message));
  }, [projectId]);
  const [triageAssigneeId, setTriageAssigneeId] = useState("");
  const [triageTargetDate, setTriageTargetDate] = useState("");
  const [triageSeverity, setTriageSeverity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
  const [triageClientShared, setTriageClientShared] = useState(false);
  const [triageChargedWork, setTriageChargedWork] = useState(false);
  const [triageCost, setTriageCost] = useState("");
  const [triageNotes, setTriageNotes] = useState("");

  const [resEvidence, setResEvidence] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);

  const loadSnags = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/snags`);
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to load site issues");
      }
      const data = (await readResponse(res)) as any;
      setSnagsList(data.snags || []);
      if (data.snags?.length > 0 && !selectedSnagId) {
        setSelectedSnagId(data.snags[0].id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSnagDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/snags/${id}`);
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to load snag details");
      }
      const data = (await readResponse(res)) as any;
      setActiveSnag(data.snag);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (projectId) loadSnags();
  }, [projectId]);

  useEffect(() => {
    if (selectedSnagId) loadSnagDetail(selectedSnagId);
  }, [selectedSnagId]);

  const handleReportSnag = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          title: repTitle,
          description: repDesc,
          locationArea: repLocation,
          severity: repSeverity,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to report issue");
      }
      const data = (await readResponse(res)) as any;
      setShowReportModal(false);
      setRepTitle("");
      setRepDesc("");
      setRepLocation("");
      await loadSnags();
      if (data.result?.id) setSelectedSnagId(data.result.id);
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleTriageSnag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId) return;
    try {
      const costMinor = triageCost
        ? Math.round(parseFloat(triageCost) * 100)
        : undefined;
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triage",
          snagId: selectedSnagId,
          assignedToUserId: triageAssigneeId,
          targetDate: triageTargetDate || undefined,
          severity: triageSeverity,
          isClientShared: triageClientShared,
          isChargedWork: triageChargedWork,
          internalCostMinor: costMinor,
          internalNotes: triageNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to triage snag");
      }
      setShowTriageModal(false);
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleStartWork = async () => {
    if (!selectedSnagId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_work",
          snagId: selectedSnagId,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to start remediation work");
      }
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_resolution",
          snagId: selectedSnagId,
          resolutionEvidence: resEvidence,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to submit resolution");
      }
      setShowResolutionModal(false);
      setResEvidence("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleVerifyClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_close",
          snagId: selectedSnagId,
          notes: verifyNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to verify closure");
      }
      setShowVerifyModal(false);
      setVerifyNotes("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reopen",
          snagId: selectedSnagId,
          reason: reopenReason,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to reopen snag");
      }
      setShowReopenModal(false);
      setReopenReason("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId || !commentText.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/snags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          snagId: selectedSnagId,
          commentText,
          isInternalOnly: commentInternal,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to post comment");
      }
      setCommentText("");
      setCommentInternal(false);
      await loadSnagDetail(selectedSnagId);
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const filteredSnags = snagsList.filter((s) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "OPEN")
      return s.status === "OPEN" || s.status === "REPORTED";
    if (statusFilter === "IN_PROGRESS") return s.status === "IN_PROGRESS";
    if (statusFilter === "READY_FOR_VERIFICATION")
      return s.status === "READY_FOR_VERIFICATION";
    if (statusFilter === "CLOSED") return s.status === "CLOSED";
    return true;
  });

  const formatCurrency = (minor: number) => {
    return `₹${(minor / 100).toLocaleString("en-IN")}`;
  };

  return (
    <div className={cx("max-w-7xl mx-auto px-4 sm:px-6 py-8")}>
      {/* Header */}
      <div
        className={cx(
          "flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-stone-200 mb-8",
        )}
      >
        <div>
          <span
            className={cx(
              "text-xs uppercase tracking-widest text-stone-500 font-sans",
            )}
          >
            Site Quality & Execution
          </span>
          <h1 className={cx("text-3xl font-serif text-stone-900 mt-1")}>
            Site Issues & Snag Tracking
          </h1>
          <p className={cx("text-sm text-stone-600 mt-1")}>
            Capture observed defects, assign remediation, and enforce manager
            inspection verification before closure.
          </p>
        </div>
        <ProjectMutation>
          <button
            onClick={() => setShowReportModal(true)}
            className={cx(
              "mt-4 md:mt-0 px-4 py-2 bg-stone-900 text-stone-100 text-sm font-sans hover:bg-stone-800 transition",
            )}
          >
            + Report Site Issue
          </button>
        </ProjectMutation>
      </div>

      {error && (
        <div
          className={cx(
            "p-4 mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded",
          )}
        >
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div
        className={cx(
          "flex border-b border-stone-200 mb-6 gap-6 overflow-x-auto text-xs font-sans uppercase tracking-wider",
        )}
      >
        {["ALL", "OPEN", "IN_PROGRESS", "READY_FOR_VERIFICATION", "CLOSED"].map(
          (st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cx(
                `pb-2.5 transition whitespace-nowrap ${
                  statusFilter === st
                    ? "border-b-2 border-stone-900 text-stone-900 font-semibold"
                    : "text-stone-500 hover:text-stone-700"
                }`,
              )}
            >
              {st.replace(/_/g, " ")}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div
          className={cx("py-12 text-center text-stone-400 font-sans text-sm")}
        >
          Loading site snags...
        </div>
      ) : (
        <div className={cx("grid grid-cols-1 lg:grid-cols-3 gap-8")}>
          {/* Left: Issues List */}
          <div className={cx("lg:col-span-1 space-y-3")}>
            {filteredSnags.length === 0 ? (
              <div
                className={cx(
                  "p-8 text-center border border-dashed border-stone-300 text-stone-400 text-sm",
                )}
              >
                No issues matching selected filter.
              </div>
            ) : (
              filteredSnags.map((snag) => {
                const isSelected = selectedSnagId === snag.id;
                return (
                  <div
                    key={snag.id}
                    onClick={() => setSelectedSnagId(snag.id)}
                    className={cx(
                      `p-4 border cursor-pointer transition ${
                        isSelected
                          ? "border-stone-900 bg-stone-50 shadow-sm"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`,
                    )}
                  >
                    <div
                      className={cx(
                        "flex items-center justify-between text-xs font-sans mb-1",
                      )}
                    >
                      <span
                        className={cx("font-mono font-medium text-stone-800")}
                      >
                        {snag.snag_number}
                      </span>
                      <span
                        className={cx(
                          `px-2 py-0.5 uppercase tracking-wider text-[10px] font-medium ${
                            snag.status === "CLOSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : snag.status === "READY_FOR_VERIFICATION"
                                ? "bg-purple-100 text-purple-800"
                                : snag.status === "IN_PROGRESS"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                          }`,
                        )}
                      >
                        {snag.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3
                      className={cx(
                        "text-sm font-serif font-medium text-stone-900 line-clamp-1",
                      )}
                    >
                      {snag.title}
                    </h3>

                    <div
                      className={cx(
                        "flex items-center justify-between text-xs text-stone-500 font-sans mt-2",
                      )}
                    >
                      <span>{snag.location_area}</span>
                      <span
                        className={cx(
                          `font-semibold ${
                            snag.severity === "URGENT" ||
                            snag.severity === "HIGH"
                              ? "text-red-700"
                              : "text-stone-600"
                          }`,
                        )}
                      >
                        {snag.severity}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Snag Detail */}
          <div className={cx("lg:col-span-2")}>
            {!activeSnag ? (
              <div
                className={cx(
                  "p-12 text-center border border-stone-200 bg-stone-50 text-stone-400",
                )}
              >
                Select an issue to inspect evidence, assignments, and
                verification.
              </div>
            ) : (
              <div className={cx("space-y-6")}>
                {/* Snag Overview Card */}
                <div
                  className={cx(
                    "bg-white border border-stone-200 p-6 shadow-sm",
                  )}
                >
                  <div
                    className={cx(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100",
                    )}
                  >
                    <div>
                      <div className={cx("flex items-center gap-2")}>
                        <span
                          className={cx(
                            "font-mono text-sm font-bold text-stone-800",
                          )}
                        >
                          {activeSnag.snag_number}
                        </span>
                        <span
                          className={cx(
                            `text-xs uppercase px-2 py-0.5 font-sans font-semibold ${
                              activeSnag.severity === "URGENT" ||
                              activeSnag.severity === "HIGH"
                                ? "bg-red-50 text-red-800"
                                : "bg-stone-100 text-stone-700"
                            }`,
                          )}
                        >
                          {activeSnag.severity} Severity
                        </span>
                        {activeSnag.is_charged_work === 1 && (
                          <span
                            className={cx(
                              "text-xs uppercase px-2 py-0.5 bg-amber-100 text-amber-900 font-sans font-bold",
                            )}
                          >
                            Extra Paid Scope
                          </span>
                        )}
                      </div>
                      <h2
                        className={cx(
                          "text-xl font-serif text-stone-900 font-medium mt-1",
                        )}
                      >
                        {activeSnag.title}
                      </h2>
                    </div>

                    <div className={cx("flex flex-col items-end")}>
                      <span
                        className={cx(
                          `px-2.5 py-1 text-xs uppercase font-sans tracking-wider font-semibold ${
                            activeSnag.status === "CLOSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : activeSnag.status === "READY_FOR_VERIFICATION"
                                ? "bg-purple-100 text-purple-800"
                                : activeSnag.status === "IN_PROGRESS"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                          }`,
                        )}
                      >
                        {activeSnag.status.replace(/_/g, " ")}
                      </span>
                      {activeSnag.reopen_count > 0 && (
                        <span
                          className={cx(
                            "text-[10px] text-amber-800 font-sans mt-1",
                          )}
                        >
                          Reopened {activeSnag.reopen_count} time(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={cx("text-sm text-stone-700 font-sans mt-4")}>
                    {activeSnag.description}
                  </p>

                  <div
                    className={cx(
                      "mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans text-stone-600",
                    )}
                  >
                    <div>
                      <span
                        className={cx(
                          "text-stone-400 block uppercase text-[10px]",
                        )}
                      >
                        Location:
                      </span>
                      <span className={cx("font-semibold text-stone-800")}>
                        {activeSnag.location_area}
                      </span>
                    </div>
                    <div>
                      <span
                        className={cx(
                          "text-stone-400 block uppercase text-[10px]",
                        )}
                      >
                        Reported by:
                      </span>
                      <span className={cx("font-semibold text-stone-800")}>
                        {activeSnag.reporter_name}
                      </span>
                    </div>
                    <div>
                      <span
                        className={cx(
                          "text-stone-400 block uppercase text-[10px]",
                        )}
                      >
                        Assignee:
                      </span>
                      <span className={cx("font-semibold text-stone-800")}>
                        {activeSnag.assignee_name || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span
                        className={cx(
                          "text-stone-400 block uppercase text-[10px]",
                        )}
                      >
                        Target Due Date:
                      </span>
                      <span className={cx("font-semibold text-stone-800")}>
                        {activeSnag.target_date || "Not set"}
                      </span>
                    </div>
                  </div>

                  {/* Confidential Internal Remediation Notes (Stripped for clients, */}
                  {(activeSnag.internal_notes ||
                    activeSnag.internal_cost_minor !== undefined) && (
                    <div
                      className={cx(
                        "mt-4 p-3 bg-stone-50 border-l-2 border-amber-600 text-xs font-sans",
                      )}
                    >
                      <div
                        className={cx(
                          "flex items-center justify-between text-amber-900 font-semibold mb-1",
                        )}
                      >
                        <span>
                          PRACTICE CONFIDENTIAL REMEDIATION NOTE (HIDDEN FROM
                          CLIENT)
                        </span>
                        {activeSnag.internal_cost_minor !== undefined && (
                          <span>
                            Cost:{" "}
                            {formatCurrency(activeSnag.internal_cost_minor)}
                          </span>
                        )}
                      </div>
                      {activeSnag.internal_notes && (
                        <p className={cx("text-stone-700")}>
                          {activeSnag.internal_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Contextual Action Bar */}
                  <div
                    className={cx(
                      "mt-6 pt-4 border-t border-stone-200 flex flex-wrap gap-3 justify-end",
                    )}
                  >
                    {activeSnag.status === "REPORTED" && (
                      <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                        <ProjectMutation>
                          <button
                            onClick={() => {
                              setTriageSeverity(activeSnag.severity as any);
                              setTriageTargetDate(activeSnag.target_date || "");
                              setShowTriageModal(true);
                            }}
                            className={cx(
                              "px-4 py-2 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800 uppercase tracking-wider",
                            )}
                          >
                            Triage & Assign Remediation (Manager)
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}

                    {activeSnag.status === "OPEN" && (
                      <ProjectMutation>
                        <PermissionGate
                          projectId={projectId}
                          assigneeId={activeSnag.assigned_to_user_id || ""}
                        >
                          <button
                            onClick={handleStartWork}
                            className={cx(
                              "px-4 py-2 bg-blue-900 text-white text-xs font-sans hover:bg-blue-800 uppercase tracking-wider",
                            )}
                          >
                            Start Remediation Work
                          </button>
                        </PermissionGate>
                      </ProjectMutation>
                    )}

                    {activeSnag.status === "IN_PROGRESS" && (
                      <ProjectMutation>
                        <PermissionGate
                          projectId={projectId}
                          assigneeId={activeSnag.assigned_to_user_id || ""}
                        >
                          <button
                            onClick={() => setShowResolutionModal(true)}
                            className={cx(
                              "px-4 py-2 bg-purple-900 text-white text-xs font-sans hover:bg-purple-800 uppercase tracking-wider",
                            )}
                          >
                            Submit Resolution Evidence (Assignee)
                          </button>
                        </PermissionGate>
                      </ProjectMutation>
                    )}

                    {activeSnag.status === "READY_FOR_VERIFICATION" && (
                      <>
                        <PermissionGate
                          projectId={projectId}
                          roles={["MANAGER"]}
                        >
                          <ProjectMutation>
                            <button
                              onClick={() => setShowReopenModal(true)}
                              className={cx(
                                "px-4 py-2 border border-amber-600 text-amber-800 text-xs font-sans hover:bg-amber-50 uppercase tracking-wider",
                              )}
                            >
                              Reject / Reopen (Manager)
                            </button>
                          </ProjectMutation>
                        </PermissionGate>
                        <PermissionGate
                          projectId={projectId}
                          roles={["MANAGER"]}
                        >
                          <ProjectMutation>
                            <button
                              onClick={() => setShowVerifyModal(true)}
                              className={cx(
                                "px-4 py-2 bg-emerald-800 text-white text-xs font-sans hover:bg-emerald-700 uppercase tracking-wider",
                              )}
                            >
                              Verify & Close Issue (Manager)
                            </button>
                          </ProjectMutation>
                        </PermissionGate>
                      </>
                    )}

                    {activeSnag.status === "CLOSED" && (
                      <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                        <ProjectMutation>
                          <button
                            onClick={() => setShowReopenModal(true)}
                            className={cx(
                              "px-4 py-2 border border-stone-300 text-stone-700 text-xs font-sans hover:bg-stone-50 uppercase tracking-wider",
                            )}
                          >
                            Reopen Issue
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}
                  </div>
                </div>

                {/* Audit & Transition History */}
                <div
                  className={cx(
                    "bg-white border border-stone-200 p-6 shadow-sm",
                  )}
                >
                  <h3
                    className={cx(
                      "text-sm font-sans uppercase tracking-wider text-stone-900 font-semibold mb-4",
                    )}
                  >
                    Resolution & Audit Event History
                  </h3>

                  <div className={cx("space-y-3")}>
                    {activeSnag.events?.map((ev) => (
                      <div
                        key={ev.id}
                        className={cx(
                          "p-3 bg-stone-50 border border-stone-200 text-xs font-sans",
                        )}
                      >
                        <div
                          className={cx(
                            "flex justify-between items-center mb-1",
                          )}
                        >
                          <span className={cx("font-semibold text-stone-800")}>
                            {ev.event_type.replace(/_/g, " ")} by{" "}
                            {ev.actor_name}
                          </span>
                          <span className={cx("text-stone-400")}>
                            {new Date(ev.created_at).toLocaleString()}
                          </span>
                        </div>
                        {ev.notes && (
                          <p className={cx("text-stone-700")}>{ev.notes}</p>
                        )}
                        {ev.resolution_evidence && (
                          <div
                            className={cx(
                              "mt-2 p-2 bg-purple-50/50 border border-purple-200 rounded text-purple-900 font-medium",
                            )}
                          >
                            <span
                              className={cx(
                                "text-[10px] block uppercase text-purple-700",
                              )}
                            >
                              Resolution Evidence:
                            </span>
                            {ev.resolution_evidence}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments & Discussion */}
                <div
                  className={cx(
                    "bg-white border border-stone-200 p-6 shadow-sm",
                  )}
                >
                  <h3
                    className={cx(
                      "text-sm font-sans uppercase tracking-wider text-stone-900 font-semibold mb-4",
                    )}
                  >
                    Comments ({activeSnag.comments?.length || 0})
                  </h3>

                  <div className={cx("space-y-3 mb-6")}>
                    {activeSnag.comments?.length === 0 ? (
                      <p
                        className={cx(
                          "text-xs text-stone-400 font-sans italic",
                        )}
                      >
                        No comments recorded yet.
                      </p>
                    ) : (
                      activeSnag.comments.map((c) => (
                        <div
                          key={c.id}
                          className={cx(
                            `p-3 border text-xs font-sans ${
                              c.is_internal_only
                                ? "bg-amber-50/50 border-amber-200"
                                : "bg-stone-50 border-stone-200"
                            }`,
                          )}
                        >
                          <div
                            className={cx(
                              "flex justify-between font-medium text-stone-800 mb-1",
                            )}
                          >
                            <span>
                              {c.author_name}{" "}
                              {c.is_internal_only === 1 && (
                                <span
                                  className={cx(
                                    "text-[10px] text-amber-800 font-bold uppercase ml-2",
                                  )}
                                >
                                  [Internal]
                                </span>
                              )}
                            </span>
                            <span className={cx("text-stone-400 font-normal")}>
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={cx("text-stone-700")}>
                            {c.comment_text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} className={cx("space-y-2")}>
                    <input
                      type="text"
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add comment..."
                      className={cx(
                        "w-full px-3 py-2 border border-stone-300 text-xs font-sans",
                      )}
                    />
                    <div className={cx("flex items-center justify-between")}>
                      <label
                        className={cx(
                          "flex items-center gap-2 text-xs text-stone-600 font-sans cursor-pointer",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={commentInternal}
                          onChange={(e) => setCommentInternal(e.target.checked)}
                        />
                        Internal Practice Only (Hidden from client)
                      </label>
                      <button
                        type="submit"
                        className={cx(
                          "px-4 py-1.5 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800",
                        )}
                      >
                        Post Comment
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Snag Modal */}
      {showReportModal && (
        <Dialog
          title="Report Site Issue"
          onClose={() => setShowReportModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Report Site Issue
            </h3>
            <form onSubmit={handleReportSnag} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="repTitle"
                >
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Paint blister on balcony parapet"
                  id="repTitle"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="repLocation"
                >
                  Location / Room / Area *
                </label>
                <input
                  type="text"
                  required
                  value={repLocation}
                  onChange={(e) => setRepLocation(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. 1st Floor East Balcony"
                  id="repLocation"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="repSeverity"
                >
                  Severity
                </label>
                <select
                  value={repSeverity}
                  onChange={(e) => setRepSeverity(e.target.value as any)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  id="repSeverity"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={repDesc}
                  onChange={(e) => setRepDesc(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Describe observed defect clearly..."
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800",
                  )}
                >
                  Submit Issue Report
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Triage Modal (Manager) */}
      {showTriageModal && (
        <Dialog
          title="Triage & Assign Issue"
          onClose={() => setShowTriageModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Triage & Assign Issue
            </h3>
            <form onSubmit={handleTriageSnag} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="triageAssigneeId"
                >
                  Assignee *
                </label>
                <select
                  required
                  value={triageAssigneeId}
                  onChange={(e) => setTriageAssigneeId(e.target.value)}
                  aria-label="Assignee"
                >
                  <option value="">Select project member</option>
                  {participants
                    .filter((p) =>
                      p.roles?.some((r: string) =>
                        ["TEAM_MEMBER", "MANAGER"].includes(r),
                      ),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className={cx("grid grid-cols-2 gap-3")}>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="triageSeverity"
                  >
                    Severity
                  </label>
                  <select
                    value={triageSeverity}
                    onChange={(e) => setTriageSeverity(e.target.value as any)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="triageSeverity"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="triageTargetDate"
                  >
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    value={triageTargetDate}
                    onChange={(e) => setTriageTargetDate(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="triageTargetDate"
                  />
                </div>
              </div>

              <div className={cx("space-y-2 pt-2 border-t border-stone-100")}>
                <label
                  className={cx(
                    "flex items-center gap-2 text-xs font-sans text-stone-700 cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={triageClientShared}
                    onChange={(e) => setTriageClientShared(e.target.checked)}
                  />
                  Approve for Client / Consultant Viewing (Shared)
                </label>
                <label
                  className={cx(
                    "flex items-center gap-2 text-xs font-sans text-amber-900 font-semibold cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={triageChargedWork}
                    onChange={(e) => setTriageChargedWork(e.target.checked)}
                  />
                  Requires Work Outside Scope (Enforces Change Gates)
                </label>
              </div>

              <div
                className={cx(
                  "p-3 bg-stone-50 border border-stone-200 space-y-2",
                )}
              >
                <span
                  className={cx(
                    "text-[10px] uppercase font-bold text-stone-500 block",
                  )}
                >
                  Practice Confidential
                </span>
                <div>
                  <label
                    className={cx("block text-xs text-stone-600 mb-1")}
                    htmlFor="triageCost"
                  >
                    Estimated Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={triageCost}
                    onChange={(e) => setTriageCost(e.target.value)}
                    className={cx(
                      "w-full px-2 py-1.5 border border-stone-300 text-sm bg-white",
                    )}
                    id="triageCost"
                  />
                </div>
                <div>
                  <label
                    className={cx("block text-xs text-stone-600 mb-1")}
                    htmlFor="triageNotes"
                  >
                    Internal Remediation Notes
                  </label>
                  <input
                    type="text"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                    className={cx(
                      "w-full px-2 py-1.5 border border-stone-300 text-sm bg-white",
                    )}
                    placeholder="Backcharge or contractor defect notes..."
                    id="triageNotes"
                  />
                </div>
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowTriageModal(false)}
                    className={cx(
                      "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                    )}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800",
                  )}
                >
                  Confirm Triage & Assign
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Submit Resolution Modal */}
      {showResolutionModal && (
        <Dialog
          title="Submit Resolution Evidence"
          onClose={() => setShowResolutionModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Submit Resolution Evidence
            </h3>
            <form onSubmit={handleSubmitResolution} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Resolution Evidence & Remediation Details *
                </label>
                <textarea
                  required
                  rows={4}
                  value={resEvidence}
                  onChange={(e) => setResEvidence(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Detail work performed to resolve the defect..."
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowResolutionModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-purple-900 text-white text-sm font-sans hover:bg-purple-800",
                  )}
                >
                  Submit for Manager Review
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Verify & Close Modal (Manager) */}
      {showVerifyModal && (
        <Dialog
          title="Manager Verified Closure"
          onClose={() => setShowVerifyModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Manager Verified Closure
            </h3>
            <form onSubmit={handleVerifyClose} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Inspection Notes & Verification Confirmation
                </label>
                <textarea
                  rows={3}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Confirmed on site that remediation meets design specifications..."
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(false)}
                    className={cx(
                      "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                    )}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-emerald-800 text-white text-sm font-sans hover:bg-emerald-700",
                  )}
                >
                  Verify & Close Issue
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Reopen Modal (Manager) */}
      {showReopenModal && (
        <Dialog
          title="Reopen Issue with Reason"
          onClose={() => setShowReopenModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Reopen Issue with Reason
            </h3>
            <form onSubmit={handleReopen} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Mandatory Reopen Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Explain why the resolution was rejected and what rework is required..."
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(false)}
                    className={cx(
                      "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                    )}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-amber-800 text-white text-sm font-sans hover:bg-amber-700",
                  )}
                >
                  Confirm Reopen
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
