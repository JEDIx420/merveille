"use client";

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
  const [repSeverity, setRepSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  const [triageAssigneeId, setTriageAssigneeId] = useState("");
  const [triageTargetDate, setTriageTargetDate] = useState("");
  const [triageSeverity, setTriageSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to load site issues");
      }
      const data = (await res.json()) as any;
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to load snag details");
      }
      const data = (await res.json()) as any;
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to report issue");
      }
      const data = (await res.json()) as any;
      setShowReportModal(false);
      setRepTitle("");
      setRepDesc("");
      setRepLocation("");
      await loadSnags();
      if (data.result?.id) setSelectedSnagId(data.result.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleTriageSnag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSnagId) return;
    try {
      const costMinor = triageCost ? Math.round(parseFloat(triageCost) * 100) : undefined;
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to triage snag");
      }
      setShowTriageModal(false);
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      alert(e.message);
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to start remediation work");
      }
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      alert(e.message);
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to submit resolution");
      }
      setShowResolutionModal(false);
      setResEvidence("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      alert(e.message);
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to verify closure");
      }
      setShowVerifyModal(false);
      setVerifyNotes("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      alert(e.message);
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to reopen snag");
      }
      setShowReopenModal(false);
      setReopenReason("");
      await loadSnagDetail(selectedSnagId);
      await loadSnags();
    } catch (e: any) {
      alert(e.message);
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
        const err = (await res.json()) as any;
        throw new Error(err.error || "Failed to post comment");
      }
      setCommentText("");
      setCommentInternal(false);
      await loadSnagDetail(selectedSnagId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredSnags = snagsList.filter((s) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "OPEN") return s.status === "OPEN" || s.status === "REPORTED";
    if (statusFilter === "IN_PROGRESS") return s.status === "IN_PROGRESS";
    if (statusFilter === "READY_FOR_VERIFICATION") return s.status === "READY_FOR_VERIFICATION";
    if (statusFilter === "CLOSED") return s.status === "CLOSED";
    return true;
  });

  const formatCurrency = (minor: number) => {
    return `₹${(minor / 100).toLocaleString("en-IN")}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-stone-200 mb-8">
        <div>
          <span className="text-xs uppercase tracking-widest text-stone-500 font-sans">
            SCR-17 • Site Quality & Execution
          </span>
          <h1 className="text-3xl font-serif text-stone-900 mt-1">
            Site Issues & Snag Tracking
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Capture observed defects, assign remediation, and enforce manager inspection verification before closure.
          </p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="mt-4 md:mt-0 px-4 py-2 bg-stone-900 text-stone-100 text-sm font-sans hover:bg-stone-800 transition"
        >
          + Report Site Issue
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-stone-200 mb-6 gap-6 overflow-x-auto text-xs font-sans uppercase tracking-wider">
        {["ALL", "OPEN", "IN_PROGRESS", "READY_FOR_VERIFICATION", "CLOSED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`pb-2.5 transition whitespace-nowrap ${
              statusFilter === st
                ? "border-b-2 border-stone-900 text-stone-900 font-semibold"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {st.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-stone-400 font-sans text-sm">
          Loading site snags...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Issues List */}
          <div className="lg:col-span-1 space-y-3">
            {filteredSnags.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-stone-300 text-stone-400 text-sm">
                No issues matching selected filter.
              </div>
            ) : (
              filteredSnags.map((snag) => {
                const isSelected = selectedSnagId === snag.id;
                return (
                  <div
                    key={snag.id}
                    onClick={() => setSelectedSnagId(snag.id)}
                    className={`p-4 border cursor-pointer transition ${
                      isSelected
                        ? "border-stone-900 bg-stone-50 shadow-sm"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-sans mb-1">
                      <span className="font-mono font-medium text-stone-800">
                        {snag.snag_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 uppercase tracking-wider text-[10px] font-medium ${
                          snag.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-800"
                            : snag.status === "READY_FOR_VERIFICATION"
                            ? "bg-purple-100 text-purple-800"
                            : snag.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {snag.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3 className="text-sm font-serif font-medium text-stone-900 line-clamp-1">
                      {snag.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-stone-500 font-sans mt-2">
                      <span>{snag.location_area}</span>
                      <span
                        className={`font-semibold ${
                          snag.severity === "URGENT" || snag.severity === "HIGH"
                            ? "text-red-700"
                            : "text-stone-600"
                        }`}
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
          <div className="lg:col-span-2">
            {!activeSnag ? (
              <div className="p-12 text-center border border-stone-200 bg-stone-50 text-stone-400">
                Select an issue to inspect evidence, assignments, and verification.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Snag Overview Card */}
                <div className="bg-white border border-stone-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-stone-800">
                          {activeSnag.snag_number}
                        </span>
                        <span
                          className={`text-xs uppercase px-2 py-0.5 font-sans font-semibold ${
                            activeSnag.severity === "URGENT" || activeSnag.severity === "HIGH"
                              ? "bg-red-50 text-red-800"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {activeSnag.severity} Severity
                        </span>
                        {activeSnag.is_charged_work === 1 && (
                          <span className="text-xs uppercase px-2 py-0.5 bg-amber-100 text-amber-900 font-sans font-bold">
                            Extra Paid Scope
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-serif text-stone-900 font-medium mt-1">
                        {activeSnag.title}
                      </h2>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className={`px-2.5 py-1 text-xs uppercase font-sans tracking-wider font-semibold ${
                          activeSnag.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-800"
                            : activeSnag.status === "READY_FOR_VERIFICATION"
                            ? "bg-purple-100 text-purple-800"
                            : activeSnag.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {activeSnag.status.replace(/_/g, " ")}
                      </span>
                      {activeSnag.reopen_count > 0 && (
                        <span className="text-[10px] text-amber-800 font-sans mt-1">
                          Reopened {activeSnag.reopen_count} time(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-stone-700 font-sans mt-4">
                    {activeSnag.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans text-stone-600">
                    <div>
                      <span className="text-stone-400 block uppercase text-[10px]">Location:</span>
                      <span className="font-semibold text-stone-800">{activeSnag.location_area}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block uppercase text-[10px]">Reported by:</span>
                      <span className="font-semibold text-stone-800">{activeSnag.reporter_name}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block uppercase text-[10px]">Assignee:</span>
                      <span className="font-semibold text-stone-800">
                        {activeSnag.assignee_name || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block uppercase text-[10px]">Target Due Date:</span>
                      <span className="font-semibold text-stone-800">
                        {activeSnag.target_date || "Not set"}
                      </span>
                    </div>
                  </div>

                  {/* Confidential Internal Remediation Notes (Stripped for clients, AC-045) */}
                  {(activeSnag.internal_notes || activeSnag.internal_cost_minor !== undefined) && (
                    <div className="mt-4 p-3 bg-stone-50 border-l-2 border-amber-600 text-xs font-sans">
                      <div className="flex items-center justify-between text-amber-900 font-semibold mb-1">
                        <span>PRACTICE CONFIDENTIAL REMEDIATION NOTE (HIDDEN FROM CLIENT)</span>
                        {activeSnag.internal_cost_minor !== undefined && (
                          <span>Cost: {formatCurrency(activeSnag.internal_cost_minor)}</span>
                        )}
                      </div>
                      {activeSnag.internal_notes && <p className="text-stone-700">{activeSnag.internal_notes}</p>}
                    </div>
                  )}

                  {/* Contextual Action Bar */}
                  <div className="mt-6 pt-4 border-t border-stone-200 flex flex-wrap gap-3 justify-end">
                    {activeSnag.status === "REPORTED" && (
                      <button
                        onClick={() => {
                          setTriageSeverity(activeSnag.severity as any);
                          setTriageTargetDate(activeSnag.target_date || "");
                          setShowTriageModal(true);
                        }}
                        className="px-4 py-2 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800 uppercase tracking-wider"
                      >
                        Triage & Assign Remediation (Manager)
                      </button>
                    )}

                    {activeSnag.status === "OPEN" && (
                      <button
                        onClick={handleStartWork}
                        className="px-4 py-2 bg-blue-900 text-white text-xs font-sans hover:bg-blue-800 uppercase tracking-wider"
                      >
                        Start Remediation Work
                      </button>
                    )}

                    {activeSnag.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => setShowResolutionModal(true)}
                        className="px-4 py-2 bg-purple-900 text-white text-xs font-sans hover:bg-purple-800 uppercase tracking-wider"
                      >
                        Submit Resolution Evidence (Assignee)
                      </button>
                    )}

                    {activeSnag.status === "READY_FOR_VERIFICATION" && (
                      <>
                        <button
                          onClick={() => setShowReopenModal(true)}
                          className="px-4 py-2 border border-amber-600 text-amber-800 text-xs font-sans hover:bg-amber-50 uppercase tracking-wider"
                        >
                          Reject / Reopen (Manager)
                        </button>
                        <button
                          onClick={() => setShowVerifyModal(true)}
                          className="px-4 py-2 bg-emerald-800 text-white text-xs font-sans hover:bg-emerald-700 uppercase tracking-wider"
                        >
                          Verify & Close Issue (Manager)
                        </button>
                      </>
                    )}

                    {activeSnag.status === "CLOSED" && (
                      <button
                        onClick={() => setShowReopenModal(true)}
                        className="px-4 py-2 border border-stone-300 text-stone-700 text-xs font-sans hover:bg-stone-50 uppercase tracking-wider"
                      >
                        Reopen Issue
                      </button>
                    )}
                  </div>
                </div>

                {/* Audit & Transition History (AC-044) */}
                <div className="bg-white border border-stone-200 p-6 shadow-sm">
                  <h3 className="text-sm font-sans uppercase tracking-wider text-stone-900 font-semibold mb-4">
                    Resolution & Audit Event History
                  </h3>

                  <div className="space-y-3">
                    {activeSnag.events?.map((ev) => (
                      <div key={ev.id} className="p-3 bg-stone-50 border border-stone-200 text-xs font-sans">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-stone-800">
                            {ev.event_type.replace(/_/g, " ")} by {ev.actor_name}
                          </span>
                          <span className="text-stone-400">
                            {new Date(ev.created_at).toLocaleString()}
                          </span>
                        </div>
                        {ev.notes && <p className="text-stone-700">{ev.notes}</p>}
                        {ev.resolution_evidence && (
                          <div className="mt-2 p-2 bg-purple-50/50 border border-purple-200 rounded text-purple-900 font-medium">
                            <span className="text-[10px] block uppercase text-purple-700">
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
                <div className="bg-white border border-stone-200 p-6 shadow-sm">
                  <h3 className="text-sm font-sans uppercase tracking-wider text-stone-900 font-semibold mb-4">
                    Comments ({activeSnag.comments?.length || 0})
                  </h3>

                  <div className="space-y-3 mb-6">
                    {activeSnag.comments?.length === 0 ? (
                      <p className="text-xs text-stone-400 font-sans italic">
                        No comments recorded yet.
                      </p>
                    ) : (
                      activeSnag.comments.map((c) => (
                        <div
                          key={c.id}
                          className={`p-3 border text-xs font-sans ${
                            c.is_internal_only
                              ? "bg-amber-50/50 border-amber-200"
                              : "bg-stone-50 border-stone-200"
                          }`}
                        >
                          <div className="flex justify-between font-medium text-stone-800 mb-1">
                            <span>
                              {c.author_name}{" "}
                              {c.is_internal_only === 1 && (
                                <span className="text-[10px] text-amber-800 font-bold uppercase ml-2">
                                  [Internal]
                                </span>
                              )}
                            </span>
                            <span className="text-stone-400 font-normal">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-stone-700">{c.comment_text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} className="space-y-2">
                    <input
                      type="text"
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add comment..."
                      className="w-full px-3 py-2 border border-stone-300 text-xs font-sans"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-stone-600 font-sans cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commentInternal}
                          onChange={(e) => setCommentInternal(e.target.checked)}
                        />
                        Internal Practice Only (Hidden from client)
                      </label>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif text-stone-900 mb-4">Report Site Issue</h3>
            <form onSubmit={handleReportSnag} className="space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="e.g. Paint blister on balcony parapet"
                />
              </div>

              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">
                  Location / Room / Area *
                </label>
                <input
                  type="text"
                  required
                  value={repLocation}
                  onChange={(e) => setRepLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="e.g. 1st Floor East Balcony"
                />
              </div>

              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Severity</label>
                <select
                  value={repSeverity}
                  onChange={(e) => setRepSeverity(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={repDesc}
                  onChange={(e) => setRepDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="Describe observed defect clearly..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800"
                >
                  Submit Issue Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage Modal (Manager) */}
      {showTriageModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif text-stone-900 mb-4">Triage & Assign Issue</h3>
            <form onSubmit={handleTriageSnag} className="space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Assignee User ID *</label>
                <input
                  type="text"
                  required
                  value={triageAssigneeId}
                  onChange={(e) => setTriageAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="usr_stf_..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Severity</label>
                  <select
                    value={triageSeverity}
                    onChange={(e) => setTriageSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-sans uppercase text-stone-600 mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={triageTargetDate}
                    onChange={(e) => setTriageTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="flex items-center gap-2 text-xs font-sans text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triageClientShared}
                    onChange={(e) => setTriageClientShared(e.target.checked)}
                  />
                  Approve for Client / Consultant Viewing (Shared)
                </label>
                <label className="flex items-center gap-2 text-xs font-sans text-amber-900 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triageChargedWork}
                    onChange={(e) => setTriageChargedWork(e.target.checked)}
                  />
                  Requires Work Outside Scope (Enforces Change Gates)
                </label>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Practice Confidential
                </span>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    value={triageCost}
                    onChange={(e) => setTriageCost(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1">Internal Remediation Notes</label>
                  <input
                    type="text"
                    value={triageNotes}
                    onChange={(e) => setTriageNotes(e.target.value)}
                    className="w-full px-2 py-1.5 border border-stone-300 text-sm bg-white"
                    placeholder="Backcharge or contractor defect notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowTriageModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800"
                >
                  Confirm Triage & Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif text-stone-900 mb-4">Submit Resolution Evidence</h3>
            <form onSubmit={handleSubmitResolution} className="space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">
                  Resolution Evidence & Remediation Details *
                </label>
                <textarea
                  required
                  rows={4}
                  value={resEvidence}
                  onChange={(e) => setResEvidence(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="Detail work performed to resolve the defect..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowResolutionModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-900 text-white text-sm font-sans hover:bg-purple-800"
                >
                  Submit for Manager Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify & Close Modal (Manager) */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif text-stone-900 mb-4">Manager Verified Closure</h3>
            <form onSubmit={handleVerifyClose} className="space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">
                  Inspection Notes & Verification Confirmation
                </label>
                <textarea
                  rows={3}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="Confirmed on site that remediation meets design specifications..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white text-sm font-sans hover:bg-emerald-700"
                >
                  Verify & Close Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal (Manager) */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="text-lg font-serif text-stone-900 mb-4">Reopen Issue with Reason</h3>
            <form onSubmit={handleReopen} className="space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase text-stone-600 mb-1">
                  Mandatory Reopen Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 text-sm"
                  placeholder="Explain why the resolution was rejected and what rework is required..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-800 text-white text-sm font-sans hover:bg-amber-700"
                >
                  Confirm Reopen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
