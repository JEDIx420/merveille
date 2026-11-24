"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import { useFeedback } from "@/components/ui";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ChangeVersion {
  id: string;
  version_number: number;
  currency: string;
  scope_summary: string;
  exclusions?: string;
  price_minor: number;
  tax_minor: number;
  total_minor: number;
  required_prework_payment_minor: number;
  schedule_impact_days: number;
  status: string;
  accepted_by_name?: string;
  accepted_at?: number;
  authorized_by_name?: string;
  authorized_at?: number;
  allocated_payment_minor: number;
  created_at: number;
}

interface ChangeComment {
  id: string;
  user_id: string;
  author_name: string;
  comment_text: string;
  created_at: number;
}

interface ChangeRequestDetail {
  id: string;
  project_id: string;
  request_number: string;
  title: string;
  description: string;
  source_type: string;
  source_reference_id?: string;
  affected_original_scope?: string;
  current_version_number: number;
  status: string;
  requested_by_user_id: string;
  requester_name: string;
  created_at: number;
  versions: ChangeVersion[];
  comments: ChangeComment[];
  currentVersion?: ChangeVersion;
  readiness: {
    condition1_estimateAccepted: boolean;
    condition2_paymentConfirmed: boolean;
    condition3_managerAuthorized: boolean;
    readyToStart: boolean;
  };
}

export default function ChangesPage() {
  const feedback = useFeedback();
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changesList, setChangesList] = useState<any[]>([]);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [activeChange, setActiveChange] = useState<ChangeRequestDetail | null>(
    null,
  );

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIssueEstimateModal, setShowIssueEstimateModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSourceType, setNewSourceType] = useState<
    | "MATERIAL_SELECTION"
    | "CLIENT_REQUEST"
    | "SITE_CONDITION"
    | "DESIGN_REVISION"
    | "DISCUSSION"
  >("CLIENT_REQUEST");
  const [newAffectedScope, setNewAffectedScope] = useState("");

  const [estScope, setEstScope] = useState("");
  const [estExclusions, setEstExclusions] = useState("");
  const [estPrice, setEstPrice] = useState("");
  const [estTax, setEstTax] = useState("0");
  const [estAdvance, setEstAdvance] = useState("");
  const [estDays, setEstDays] = useState("0");

  const [reviseReason, setReviseReason] = useState("");
  const [commentText, setCommentText] = useState("");

  const [payReceiptId, setPayReceiptId] = useState("");
  const [paymentReceipts, setPaymentReceipts] = useState<any[]>([]);
  useEffect(() => {
    if (!showPaymentModal) return;
    fetch(`/api/projects/${projectId}/finance/receipts`)
      .then(readResponse)
      .then((data) =>
        setPaymentReceipts(
          (data.receipts || []).filter(
            (r: any) =>
              r.status === "CONFIRMED" &&
              r.unallocated_minor > 0 &&
              !r.settlement_invoice_id,
          ),
        ),
      )
      .catch((e) => setError(e.message));
  }, [showPaymentModal, projectId]);
  const [payAmount, setPayAmount] = useState("");

  const loadChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/changes`);
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to load change requests");
      }
      const data = (await readResponse(res)) as any;
      setChangesList(data.changes || []);
      if (data.changes?.length > 0 && !selectedChangeId) {
        setSelectedChangeId(data.changes[0].id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadChangeDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/changes/${id}`);
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to load change detail");
      }
      const data = (await readResponse(res)) as any;
      setActiveChange(data.change);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (projectId) loadChanges();
  }, [projectId]);

  useEffect(() => {
    if (selectedChangeId) loadChangeDetail(selectedChangeId);
  }, [selectedChangeId]);

  const handleCreateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: newTitle,
          description: newDescription,
          sourceType: newSourceType,
          affectedOriginalScope: newAffectedScope || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to create change request");
      }
      const data = (await readResponse(res)) as any;
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewAffectedScope("");
      await loadChanges();
      if (data.result?.id) {
        setSelectedChangeId(data.result.id);
      }
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleIssueEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeId) return;
    try {
      const priceMinor = Math.round(parseFloat(estPrice || "0") * 100);
      const taxMinor = Math.round(parseFloat(estTax || "0") * 100);
      const advanceMinor = estAdvance
        ? Math.round(parseFloat(estAdvance) * 100)
        : priceMinor + taxMinor;

      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_estimate",
          changeRequestId: selectedChangeId,
          scopeSummary: estScope,
          exclusions: estExclusions || undefined,
          priceMinor,
          taxMinor,
          requiredPreworkPaymentMinor: advanceMinor,
          scheduleImpactDays: parseInt(estDays || "0", 10),
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to issue estimate");
      }
      setShowIssueEstimateModal(false);
      setEstScope("");
      setEstExclusions("");
      setEstPrice("");
      setEstTax("0");
      setEstAdvance("");
      setEstDays("0");
      await loadChangeDetail(selectedChangeId);
      await loadChanges();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleReviseEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeId) return;
    try {
      const priceMinor = Math.round(parseFloat(estPrice || "0") * 100);
      const taxMinor = Math.round(parseFloat(estTax || "0") * 100);
      const advanceMinor = estAdvance
        ? Math.round(parseFloat(estAdvance) * 100)
        : priceMinor + taxMinor;

      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revise",
          changeRequestId: selectedChangeId,
          scopeSummary: estScope,
          exclusions: estExclusions || undefined,
          priceMinor,
          taxMinor,
          requiredPreworkPaymentMinor: advanceMinor,
          scheduleImpactDays: parseInt(estDays || "0", 10),
          reason: reviseReason,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to revise estimate");
      }
      setShowReviseModal(false);
      setReviseReason("");
      await loadChangeDetail(selectedChangeId);
      await loadChanges();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleAcceptEstimate = async () => {
    if (!selectedChangeId || !activeChange?.currentVersion) return;
    if (
      !(await feedback.confirm(
        "Accept this estimate version as binding contractual additional scope?",
      ))
    )
      return;
    try {
      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          changeRequestId: selectedChangeId,
          versionNumber: activeChange.currentVersion.version_number,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to accept estimate");
      }
      await loadChangeDetail(selectedChangeId);
      await loadChanges();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleAuthorizeWork = async () => {
    if (!selectedChangeId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "authorize",
          changeRequestId: selectedChangeId,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to authorize work");
      }
      await loadChangeDetail(selectedChangeId);
      await loadChanges();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeId || !payReceiptId) return;
    try {
      const amountMinor = payAmount
        ? Math.round(parseFloat(payAmount) * 100)
        : undefined;
      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_payment",
          changeRequestId: selectedChangeId,
          receiptId: payReceiptId,
          amountMinor,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to allocate payment");
      }
      setShowPaymentModal(false);
      setPayReceiptId("");
      setPayAmount("");
      await loadChangeDetail(selectedChangeId);
      await loadChanges();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeId || !commentText.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          changeRequestId: selectedChangeId,
          commentText,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to add comment");
      }
      setCommentText("");
      await loadChangeDetail(selectedChangeId);
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

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
            Commercial Control
          </span>
          <h1 className={cx("text-3xl font-serif text-stone-900 mt-1")}>
            Change Requests & Extra Work
          </h1>
          <p className={cx("text-sm text-stone-600 mt-1")}>
            Three independent conditions gate additional work: Main-Client
            Acceptance + Confirmed Pre-work Payment + Manager Authorization.
          </p>
        </div>
        <ProjectMutation>
          <button
            onClick={() => setShowCreateModal(true)}
            className={cx(
              "mt-4 md:mt-0 px-4 py-2 bg-stone-900 text-stone-100 text-sm font-sans hover:bg-stone-800 transition",
            )}
          >
            + Request Change
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

      {loading ? (
        <div
          className={cx("py-12 text-center text-stone-400 font-sans text-sm")}
        >
          Loading change requests...
        </div>
      ) : (
        <div className={cx("grid grid-cols-1 lg:grid-cols-3 gap-8")}>
          {/* Left: Change Requests List */}
          <div className={cx("lg:col-span-1 space-y-3")}>
            <h2
              className={cx(
                "text-xs font-sans uppercase tracking-wider text-stone-500 font-medium mb-3",
              )}
            >
              Change Requests ({changesList.length})
            </h2>

            {changesList.length === 0 ? (
              <div
                className={cx(
                  "p-8 text-center border border-dashed border-stone-300 text-stone-400 text-sm",
                )}
              >
                No change requests for this project.
              </div>
            ) : (
              changesList.map((cr) => {
                const isSelected = selectedChangeId === cr.id;
                return (
                  <div
                    key={cr.id}
                    onClick={() => setSelectedChangeId(cr.id)}
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
                        {cr.request_number}
                      </span>
                      <span
                        className={cx(
                          `px-2 py-0.5 uppercase tracking-wider text-[10px] font-medium ${
                            cr.status === "AUTHORIZED"
                              ? "bg-emerald-100 text-emerald-800"
                              : cr.status === "PAYMENT_CONFIRMED"
                                ? "bg-blue-100 text-blue-800"
                                : cr.status === "ACCEPTED_AWAITING_PAYMENT"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-stone-100 text-stone-700"
                          }`,
                        )}
                      >
                        {cr.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3
                      className={cx(
                        "text-sm font-serif font-medium text-stone-900 line-clamp-1",
                      )}
                    >
                      {cr.title}
                    </h3>

                    <div
                      className={cx(
                        "flex items-center justify-between text-xs text-stone-500 font-sans mt-2",
                      )}
                    >
                      <span>Source: {cr.source_type.replace(/_/g, " ")}</span>
                      <span>v{cr.current_version_number}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Active Change Detail */}
          <div className={cx("lg:col-span-2")}>
            {!activeChange ? (
              <div
                className={cx(
                  "p-12 text-center border border-stone-200 bg-stone-50 text-stone-400",
                )}
              >
                Select a change request to view estimate details and commercial
                readiness.
              </div>
            ) : (
              <div className={cx("space-y-6")}>
                {/* Change Header */}
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
                          {activeChange.request_number}
                        </span>
                        <span
                          className={cx(
                            "text-xs uppercase px-2 py-0.5 bg-stone-100 text-stone-600 font-sans font-medium",
                          )}
                        >
                          {activeChange.source_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <h2
                        className={cx(
                          "text-xl font-serif text-stone-900 font-medium mt-1",
                        )}
                      >
                        {activeChange.title}
                      </h2>
                    </div>

                    <span
                      className={cx(
                        `self-start px-2.5 py-1 text-xs uppercase font-sans tracking-wider font-medium ${
                          activeChange.status === "AUTHORIZED"
                            ? "bg-emerald-100 text-emerald-800"
                            : activeChange.status === "PAYMENT_CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : activeChange.status ===
                                  "ACCEPTED_AWAITING_PAYMENT"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-stone-700"
                        }`,
                      )}
                    >
                      {activeChange.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <p className={cx("text-sm text-stone-700 font-sans mt-4")}>
                    {activeChange.description}
                  </p>

                  {activeChange.affected_original_scope && (
                    <div
                      className={cx("mt-3 text-xs font-sans text-stone-500")}
                    >
                      <strong className={cx("text-stone-700")}>
                        Affected Scope:
                      </strong>{" "}
                      {activeChange.affected_original_scope}
                    </div>
                  )}

                  <div
                    className={cx(
                      "mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-sans",
                    )}
                  >
                    <span>Requested by {activeChange.requester_name}</span>
                    <span>
                      {new Date(activeChange.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* THREE-CONDITION READINESS PANEL (Primary Gate) */}
                <div
                  className={cx(
                    "bg-white border border-stone-200 p-6 shadow-sm",
                  )}
                >
                  <div
                    className={cx(
                      "flex items-center justify-between pb-3 border-b border-stone-100 mb-4",
                    )}
                  >
                    <h3
                      className={cx(
                        "text-sm font-sans uppercase tracking-wider text-stone-900 font-semibold",
                      )}
                    >
                      Commercial Pre-Work Readiness Gate
                    </h3>
                    <span
                      className={cx(
                        `text-xs px-2.5 py-1 font-sans uppercase tracking-wider font-semibold ${
                          activeChange.readiness.readyToStart
                            ? "bg-emerald-800 text-white"
                            : "bg-stone-200 text-stone-700"
                        }`,
                      )}
                    >
                      {activeChange.readiness.readyToStart
                        ? "✓ Authorized to Start"
                        : "Execution Blocked"}
                    </span>
                  </div>

                  <div
                    className={cx(
                      "grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans",
                    )}
                  >
                    {/* Condition 1 */}
                    <div
                      className={cx(
                        `p-3 border ${
                          activeChange.readiness.condition1_estimateAccepted
                            ? "border-emerald-300 bg-emerald-50/50"
                            : "border-stone-200 bg-stone-50"
                        }`,
                      )}
                    >
                      <div className={cx("flex items-center gap-2 mb-1")}>
                        <span
                          className={cx(
                            `w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              activeChange.readiness.condition1_estimateAccepted
                                ? "bg-emerald-700 text-white"
                                : "bg-stone-300 text-stone-600"
                            }`,
                          )}
                        >
                          {activeChange.readiness.condition1_estimateAccepted
                            ? "✓"
                            : "1"}
                        </span>
                        <span className={cx("font-semibold text-stone-800")}>
                          1. Main-Client Acceptance
                        </span>
                      </div>
                      <p className={cx("text-stone-600")}>
                        {activeChange.readiness.condition1_estimateAccepted
                          ? `Accepted by ${activeChange.currentVersion?.accepted_by_name || "Main Client"}`
                          : "Pending binding acceptance from main client"}
                      </p>
                    </div>

                    {/* Condition 2 */}
                    <div
                      className={cx(
                        `p-3 border ${
                          activeChange.readiness.condition2_paymentConfirmed
                            ? "border-emerald-300 bg-emerald-50/50"
                            : "border-stone-200 bg-stone-50"
                        }`,
                      )}
                    >
                      <div className={cx("flex items-center gap-2 mb-1")}>
                        <span
                          className={cx(
                            `w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              activeChange.readiness.condition2_paymentConfirmed
                                ? "bg-emerald-700 text-white"
                                : "bg-stone-300 text-stone-600"
                            }`,
                          )}
                        >
                          {activeChange.readiness.condition2_paymentConfirmed
                            ? "✓"
                            : "2"}
                        </span>
                        <span className={cx("font-semibold text-stone-800")}>
                          2. Pre-work Payment
                        </span>
                      </div>
                      <p className={cx("text-stone-600")}>
                        {activeChange.currentVersion
                          ? `${formatCurrency(activeChange.currentVersion.allocated_payment_minor)} of ${formatCurrency(activeChange.currentVersion.required_prework_payment_minor)} allocated`
                          : "No estimate"}
                      </p>
                    </div>

                    {/* Condition 3 */}
                    <div
                      className={cx(
                        `p-3 border ${
                          activeChange.readiness.condition3_managerAuthorized
                            ? "border-emerald-300 bg-emerald-50/50"
                            : "border-stone-200 bg-stone-50"
                        }`,
                      )}
                    >
                      <div className={cx("flex items-center gap-2 mb-1")}>
                        <span
                          className={cx(
                            `w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              activeChange.readiness
                                .condition3_managerAuthorized
                                ? "bg-emerald-700 text-white"
                                : "bg-stone-300 text-stone-600"
                            }`,
                          )}
                        >
                          {activeChange.readiness.condition3_managerAuthorized
                            ? "✓"
                            : "3"}
                        </span>
                        <span className={cx("font-semibold text-stone-800")}>
                          3. Manager Authorization
                        </span>
                      </div>
                      <p className={cx("text-stone-600")}>
                        {activeChange.readiness.condition3_managerAuthorized
                          ? `Authorized by ${activeChange.currentVersion?.authorized_by_name || "Manager"}`
                          : "Awaiting manager release"}
                      </p>
                    </div>
                  </div>

                  {/* Contextual Action Bar */}
                  <div
                    className={cx(
                      "mt-6 pt-4 border-t border-stone-200 flex flex-wrap gap-3 justify-end",
                    )}
                  >
                    {activeChange.status === "REQUESTED" && (
                      <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                        <ProjectMutation>
                          <button
                            onClick={() => setShowIssueEstimateModal(true)}
                            className={cx(
                              "px-4 py-2 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800 uppercase tracking-wider",
                            )}
                          >
                            Prepare / Issue Estimate
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}

                    {activeChange.status === "AWAITING_CLIENT" && (
                      <PermissionGate projectId={projectId} contractual>
                        <ProjectMutation>
                          <button
                            onClick={handleAcceptEstimate}
                            className={cx(
                              "px-4 py-2 bg-emerald-800 text-white text-xs font-sans hover:bg-emerald-700 uppercase tracking-wider",
                            )}
                          >
                            Accept Estimate (Main Client)
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}

                    {activeChange.status === "ACCEPTED_AWAITING_PAYMENT" && (
                      <PermissionGate projectId={projectId} roles={["ADMIN"]}>
                        <ProjectMutation>
                          <button
                            onClick={() => setShowPaymentModal(true)}
                            className={cx(
                              "px-4 py-2 bg-blue-900 text-white text-xs font-sans hover:bg-blue-800 uppercase tracking-wider",
                            )}
                          >
                            Confirm & Allocate Payment (Admin)
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}

                    {activeChange.status === "PAYMENT_CONFIRMED" && (
                      <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                        <ProjectMutation>
                          <button
                            onClick={handleAuthorizeWork}
                            className={cx(
                              "px-4 py-2 bg-emerald-800 text-white text-xs font-sans hover:bg-emerald-700 uppercase tracking-wider",
                            )}
                          >
                            Authorize Additional Work (Manager)
                          </button>
                        </ProjectMutation>
                      </PermissionGate>
                    )}

                    {/* Revision allowed when already estimated */}
                    {activeChange.currentVersion && (
                      <ProjectMutation>
                        <button
                          onClick={() => {
                            setEstScope(
                              activeChange.currentVersion?.scope_summary || "",
                            );
                            setEstPrice(
                              activeChange.currentVersion?.price_minor
                                ? (
                                    activeChange.currentVersion.price_minor /
                                    100
                                  ).toString()
                                : "",
                            );
                            setEstAdvance(
                              activeChange.currentVersion
                                ?.required_prework_payment_minor
                                ? (
                                    activeChange.currentVersion
                                      .required_prework_payment_minor / 100
                                  ).toString()
                                : "",
                            );
                            setEstDays(
                              activeChange.currentVersion?.schedule_impact_days?.toString() ||
                                "0",
                            );
                            setShowReviseModal(true);
                          }}
                          className={cx(
                            "px-3 py-2 border border-stone-300 text-stone-700 text-xs font-sans hover:bg-stone-50 uppercase tracking-wider",
                          )}
                        >
                          Revise Scope / Price (Invalidates Prior Consent)
                        </button>
                      </ProjectMutation>
                    )}
                  </div>
                </div>

                {/* Estimate Versions */}
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
                    Estimate History & Specifications
                  </h3>

                  <div className={cx("space-y-4")}>
                    {activeChange.versions?.map((ver) => (
                      <div
                        key={ver.id}
                        className={cx(
                          `p-4 border ${
                            ver.version_number ===
                            activeChange.current_version_number
                              ? "border-stone-900 bg-white"
                              : "border-stone-200 bg-stone-50 text-stone-600"
                          }`,
                        )}
                      >
                        <div
                          className={cx(
                            "flex items-center justify-between pb-2 border-b border-stone-100 text-xs font-sans",
                          )}
                        >
                          <span className={cx("font-semibold text-stone-800")}>
                            Version {ver.version_number}
                          </span>
                          <span
                            className={cx(
                              `px-2 py-0.5 uppercase tracking-wider font-medium text-[10px] ${
                                ver.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : ver.status === "SUPERSEDED"
                                    ? "bg-stone-200 text-stone-500 line-through"
                                    : "bg-stone-100 text-stone-700"
                              }`,
                            )}
                          >
                            {ver.status}
                          </span>
                        </div>

                        <p
                          className={cx(
                            "text-sm text-stone-800 mt-2 font-sans font-medium",
                          )}
                        >
                          {ver.scope_summary}
                        </p>

                        {ver.exclusions && (
                          <p
                            className={cx(
                              "text-xs text-stone-500 mt-1 font-sans",
                            )}
                          >
                            <strong>Exclusions:</strong> {ver.exclusions}
                          </p>
                        )}

                        <div
                          className={cx(
                            "mt-4 pt-3 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans",
                          )}
                        >
                          <div>
                            <span className={cx("text-stone-500 block")}>
                              Total Price:
                            </span>
                            <span
                              className={cx("font-semibold text-stone-900")}
                            >
                              {formatCurrency(ver.total_minor)}
                            </span>
                          </div>
                          <div>
                            <span className={cx("text-stone-500 block")}>
                              Pre-work Payment:
                            </span>
                            <span
                              className={cx("font-semibold text-stone-900")}
                            >
                              {formatCurrency(
                                ver.required_prework_payment_minor,
                              )}
                            </span>
                          </div>
                          <div>
                            <span className={cx("text-stone-500 block")}>
                              Schedule Impact:
                            </span>
                            <span
                              className={cx("font-semibold text-stone-900")}
                            >
                              +{ver.schedule_impact_days} days
                            </span>
                          </div>
                          <div>
                            <span className={cx("text-stone-500 block")}>
                              Allocated:
                            </span>
                            <span
                              className={cx("font-semibold text-emerald-800")}
                            >
                              {formatCurrency(ver.allocated_payment_minor)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discussion & Comments */}
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
                    Comments & Advisory Input (
                    {activeChange.comments?.length || 0})
                  </h3>

                  <div className={cx("space-y-3 mb-6")}>
                    {activeChange.comments?.length === 0 ? (
                      <p
                        className={cx(
                          "text-xs text-stone-400 font-sans italic",
                        )}
                      >
                        No comments recorded yet. Representatives and
                        consultants can add input below.
                      </p>
                    ) : (
                      activeChange.comments.map((c) => (
                        <div
                          key={c.id}
                          className={cx(
                            "p-3 bg-stone-50 border border-stone-200 text-xs font-sans",
                          )}
                        >
                          <div
                            className={cx(
                              "flex justify-between font-medium text-stone-800 mb-1",
                            )}
                          >
                            <span>{c.author_name}</span>
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

                  <form
                    onSubmit={handleAddComment}
                    className={cx("flex gap-2")}
                  >
                    <input
                      type="text"
                      required
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add comment, specification clarification, or consultant note..."
                      className={cx(
                        "flex-1 px-3 py-2 border border-stone-300 text-xs font-sans",
                      )}
                    />
                    <button
                      type="submit"
                      className={cx(
                        "px-4 py-2 bg-stone-900 text-white text-xs font-sans hover:bg-stone-800",
                      )}
                    >
                      Post Comment
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateModal && (
        <Dialog
          title="Request Scope Change"
          onClose={() => setShowCreateModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Request Scope Change
            </h3>
            <form onSubmit={handleCreateChange} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="newTitle"
                >
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Master Bedroom Wood Flooring Upgrade"
                  id="newTitle"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="newSourceType"
                >
                  Source Type
                </label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value as any)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  id="newSourceType"
                >
                  <option value="CLIENT_REQUEST">Client Direct Request</option>
                  <option value="MATERIAL_SELECTION">
                    Material Selection Implication
                  </option>
                  <option value="SITE_CONDITION">
                    Site Condition Discovery
                  </option>
                  <option value="DESIGN_REVISION">Design Revision</option>
                  <option value="DISCUSSION">Discussion Outcome</option>
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
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Detailed description of proposed scope departure..."
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="newAffectedScope"
                >
                  Affected Original Scope
                </label>
                <input
                  type="text"
                  value={newAffectedScope}
                  onChange={(e) => setNewAffectedScope(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Replaces contract tile flooring in Room 102"
                  id="newAffectedScope"
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Issue Estimate Modal */}
      {showIssueEstimateModal && (
        <Dialog
          title="Issue Change Estimate"
          onClose={() => setShowIssueEstimateModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Issue Change Estimate
            </h3>
            <form onSubmit={handleIssueEstimate} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Scope Summary *
                </label>
                <textarea
                  required
                  rows={2}
                  value={estScope}
                  onChange={(e) => setEstScope(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Precise description of additional work..."
                />
              </div>

              <div className={cx("grid grid-cols-2 gap-3")}>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estPrice"
                  >
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={estPrice}
                    onChange={(e) => setEstPrice(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    placeholder="95000"
                    id="estPrice"
                  />
                </div>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estTax"
                  >
                    GST / Tax (₹)
                  </label>
                  <input
                    type="number"
                    value={estTax}
                    onChange={(e) => setEstTax(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="estTax"
                  />
                </div>
              </div>

              <div className={cx("grid grid-cols-2 gap-3")}>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estAdvance"
                  >
                    Required Advance (₹)
                  </label>
                  <input
                    type="number"
                    value={estAdvance}
                    onChange={(e) => setEstAdvance(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    placeholder="Leave blank for full"
                    id="estAdvance"
                  />
                </div>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estDays"
                  >
                    Schedule Impact (Days)
                  </label>
                  <input
                    type="number"
                    value={estDays}
                    onChange={(e) => setEstDays(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="estDays"
                  />
                </div>
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="estExclusions"
                >
                  Exclusions
                </label>
                <input
                  type="text"
                  value={estExclusions}
                  onChange={(e) => setEstExclusions(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Electrical fittings not included"
                  id="estExclusions"
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowIssueEstimateModal(false)}
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
                  Issue Immutable Estimate
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Revise Estimate Modal */}
      {showReviseModal && (
        <Dialog
          title="Revise Scope / Price"
          onClose={() => setShowReviseModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-1")}>
              Revise Scope / Price
            </h3>
            <p className={cx("text-xs text-amber-800 font-sans mb-4")}>
              Warning: Creating a new estimate version supersedes the prior
              version and invalidates existing client acceptance and manager
              authorization.
            </p>
            <form onSubmit={handleReviseEstimate} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="reviseReason"
                >
                  Reason for Revision *
                </label>
                <input
                  type="text"
                  required
                  value={reviseReason}
                  onChange={(e) => setReviseReason(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Scope expanded to include terrace extension"
                  id="reviseReason"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Revised Scope Summary *
                </label>
                <textarea
                  required
                  rows={2}
                  value={estScope}
                  onChange={(e) => setEstScope(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                />
              </div>

              <div className={cx("grid grid-cols-2 gap-3")}>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estPrice"
                  >
                    Revised Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={estPrice}
                    onChange={(e) => setEstPrice(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="estPrice"
                  />
                </div>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="estAdvance"
                  >
                    Required Advance (₹)
                  </label>
                  <input
                    type="number"
                    value={estAdvance}
                    onChange={(e) => setEstAdvance(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="estAdvance"
                  />
                </div>
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-amber-800 text-white text-sm font-sans hover:bg-amber-700",
                  )}
                >
                  Issue Revised Version
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Confirm Payment Modal (Admin Only) */}
      {showPaymentModal && (
        <Dialog
          title="Allocate Confirmed Receipt"
          onClose={() => setShowPaymentModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Allocate Confirmed Receipt
            </h3>
            <form onSubmit={handleConfirmPayment} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="payReceiptId"
                >
                  Confirmed receipt *
                </label>
                <select
                  required
                  value={payReceiptId}
                  onChange={(e) => setPayReceiptId(e.target.value)}
                  id="payReceiptId"
                >
                  <option value="">
                    Select an available confirmed receipt
                  </option>
                  {paymentReceipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.receipt_number ||
                        receipt.reference_note ||
                        "Confirmed payment"}{" "}
                      — {formatCurrency(receipt.unallocated_minor)} available
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="payAmount"
                >
                  Amount to Allocate (₹)
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="Leave blank for full needed amount"
                  id="payAmount"
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-blue-900 text-white text-sm font-sans hover:bg-blue-800",
                  )}
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
