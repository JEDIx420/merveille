"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { useProject } from "@/components/project-context";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { CommercialForms } from "@/features/commercial-forms";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { Dialog, Field, ErrorState, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

import { BRAND_CONFIG, formatRupees } from "@/shared/config";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Quotation {
  id: string;
  version_number: number;
  title: string;
  currency: string;
  total_amount_minor: number;
  required_advance_minor: number;
  status: string;
  accepted_by_name?: string;
  accepted_at?: number;
  creator_name: string;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_rate_minor: number;
    amount_minor: number;
  }>;
}

interface ScheduleItem {
  id: string;
  item_order: number;
  description: string;
  amount_minor: number;
  trigger_type: string;
  target_date?: string;
  target_stage_name?: string;
  is_advance: number;
}

interface PaymentSchedule {
  id: string;
  version_number: number;
  status: string;
  revision_reason?: string;
  creator_name: string;
  items?: ScheduleItem[];
}

interface InvoiceVersion {
  id: string;
  version_number: number;
  total_minor: number;
  status: string;
  due_date: string;
  approver_name?: string;
  lineItems?: Array<{ id: string; description: string; amount_minor: number }>;
}

interface Invoice {
  id: string;
  invoice_number?: string;
  status: string;
  settlement_status: string;
  total_minor: number;
  allocated_minor: number;
  outstanding_minor: number;
  due_date: string;
  creator_name: string;
  issuer_name?: string;
  current_version_number: number;
  versions?: InvoiceVersion[];
}

interface Receipt {
  id: string;
  receipt_number?: string;
  amount_minor: number;
  allocated_minor: number;
  unallocated_minor: number;
  received_date: string;
  payment_method: string;
  reference_note?: string;
  status: string;
  reporter_name: string;
  confirmer_name?: string;
  settlement_invoice_id?: string;
  allocations?: Array<{
    id: string;
    invoice_number: string;
    amount_minor: number;
  }>;
}

export default function ProjectFinancePage() {
  const feedback = useFeedback();
  const project = useProject();
  const { principal } = useSession();
  const archived = project?.is_archived === 1 || project?.status === "ARCHIVED";
  const admin = hasCapability(principal, "ADMIN");
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [activeTab, setActiveTab] = useState<
    "QUOTES" | "SCHEDULE" | "INVOICES" | "RECEIPTS"
  >("QUOTES");

  // Modals
  const [showDraftInvoiceModal, setShowDraftInvoiceModal] = useState(false);
  const [showReportReceiptModal, setShowReportReceiptModal] = useState(false);
  const [allocateKey, setAllocateKey] = useState("");
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    null,
  );

  // Form inputs
  const [invDueDate, setInvDueDate] = useState("");
  const [invDesc, setInvDesc] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [reportKey, setReportKey] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [settlementInvoiceId, setSettlementInvoiceId] = useState("");
  const [rcpDate, setRcpDate] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BRAND_CONFIG.timezone,
    }).format(new Date()),
  );
  const [receiptFiles, setReceiptFiles] = useState<any[]>([]);
  const [evidenceFileId, setEvidenceFileId] = useState("");
  useEffect(() => {
    if (showReportReceiptModal)
      fetch(`/api/projects/${projectId}/files`)
        .then(readResponse)
        .then((d) => setReceiptFiles(d.files || []))
        .catch((e) => setError(e.message));
  }, [showReportReceiptModal, projectId]);
  const [rcpAmount, setRcpAmount] = useState("");
  const [rcpMethod, setRcpMethod] = useState("NEFT");
  const [rcpRef, setRcpRef] = useState("");
  const [allocInvoiceId, setAllocInvoiceId] = useState("");
  const [allocAmount, setAllocAmount] = useState("");

  const formatCurrency = formatRupees;

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [qRes, sRes, iRes, rRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/finance/quotes`),
        fetch(`/api/projects/${projectId}/finance/schedule`),
        fetch(`/api/projects/${projectId}/finance/invoices`),
        fetch(`/api/projects/${projectId}/finance/receipts`),
      ]);

      {
        const qData = (await readResponse(qRes)) as any;
        setQuotations(qData.quotations || []);
      }
      {
        const sData = (await readResponse(sRes)) as any;
        setSchedules(sData.schedules || []);
      }
      {
        const iData = (await readResponse(iRes)) as any;
        setInvoices(iData.invoices || []);
      }
      {
        const rData = (await readResponse(rRes)) as any;
        setReceipts(rData.receipts || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchFinanceData();
    }
  }, [projectId]);

  const handleAcceptQuote = async (quotationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/finance/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT", quotationId }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to accept quotation");
      }
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleCreateDraftInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const unitRateMinor = Math.round(parseFloat(invAmount) * 100);
      const res = await fetch(`/api/projects/${projectId}/finance/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: invDueDate,
          lineItems: [{ description: invDesc, unitRateMinor, quantity: 1 }],
        }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to draft invoice");
      }
      setShowDraftInvoiceModal(false);
      setInvDueDate("");
      setInvDesc("");
      setInvAmount("");
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleApproveInvoice = async (
    invoiceId: string,
    versionNumber: number,
  ) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", versionNumber }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to approve invoice");
      }
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleIssueInvoice = async (
    invoiceId: string,
    versionNumber: number,
  ) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ISSUE", versionNumber }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to issue invoice");
      }
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleReportReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportBusy(true);
    try {
      const amountMinor = Math.round(parseFloat(rcpAmount) * 100);
      const res = await fetch(`/api/projects/${projectId}/finance/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REPORT",
          idempotencyKey: reportKey,
          settlementInvoiceId: archived ? settlementInvoiceId : undefined,
          evidenceFileId: evidenceFileId || undefined,
          amountMinor,
          receivedDate: rcpDate,
          paymentMethod: rcpMethod,
          referenceNote: rcpRef,
        }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to report payment");
      }
      setShowReportReceiptModal(false);
      setRcpAmount("");
      setRcpRef("");
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    } finally {
      setReportBusy(false);
    }
  };

  const handleConfirmReceipt = async (receiptId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/finance/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM", receiptId }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to confirm receipt");
      }
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleAllocateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptId || !allocInvoiceId) return;

    try {
      const amountMinor = Math.round(parseFloat(allocAmount) * 100);
      const res = await fetch(`/api/projects/${projectId}/finance/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ALLOCATE",
          idempotencyKey: allocateKey || crypto.randomUUID(),
          receiptId: selectedReceiptId,
          invoiceId: allocInvoiceId,
          amountMinor,
        }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to allocate funds");
      }
      setShowAllocateModal(false);
      setSelectedReceiptId(null);
      setAllocInvoiceId("");
      setAllocAmount("");
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleActivateProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/finance/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to activate project");
      }
      feedback.notify("Project commercial activation successful!");
      fetchFinanceData();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  if (loading) {
    return (
      <div className={cx(["portal-container", layout.block1].join(" "))}>
        <p className={cx("text-muted")}>
          Loading commercial finance records...
        </p>
      </div>
    );
  }

  if (
    error &&
    !showDraftInvoiceModal &&
    !showReportReceiptModal &&
    !showAllocateModal
  )
    return <ErrorState message={error} retry={fetchFinanceData} />;

  const acceptedQuote = quotations.find((q) => q.status === "ACCEPTED");
  const confirmedReceiptsSum = receipts
    .filter((r) => r.status === "CONFIRMED")
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const isAdvanceSatisfied = acceptedQuote
    ? confirmedReceiptsSum >= acceptedQuote.required_advance_minor
    : false;

  return (
    <div className={cx(["portal-container", layout.block2].join(" "))}>
      {/* Header */}
      <div className={cx(layout.block3)}>
        <div>
          <a
            href={`/projects/${projectId}/overview`}
            className={cx(layout.block4)}
          >
            ← Back to Project Overview
          </a>
          <h1 className={cx(["text-display", layout.block5].join(" "))}>
            Commercial Finance & Invoicing
          </h1>
          <p className={cx(["text-muted", layout.block6].join(" "))}>
            Authoritative quotations, upfront milestone schedules, approved
            billing, and confirmed receipts.
          </p>
        </div>

        {/* Commercial Gate Banner */}
        <div className={cx(layout.block7)}>
          {!archived && (
            <PermissionGate projectId={projectId} roles={["MANAGER"]}>
              <ProjectMutation>
                <button
                  onClick={handleActivateProject}
                  className={cx(["btn-primary", layout.block8].join(" "))}
                  disabled={!acceptedQuote || !isAdvanceSatisfied}
                >
                  Activate Project
                </button>
              </ProjectMutation>
            </PermissionGate>
          )}
        </div>
      </div>

      <CommercialForms
        projectId={projectId}
        quotations={quotations}
        onSaved={fetchFinanceData}
      />

      {/* Commercial Gate Status Summary */}
      <div className={cx(layout.block9)}>
        <div>
          <span className={cx(layout.block10)}>Contractual Quotation</span>
          <div className={cx(layout.block11)}>
            {acceptedQuote ? (
              <span className={cx(layout.block12)}>
                ✓ Accepted ({formatCurrency(acceptedQuote.total_amount_minor)})
              </span>
            ) : (
              <span className={cx(layout.block13)}>✗ Pending Acceptance</span>
            )}
          </div>
        </div>

        <div>
          <span className={cx(layout.block14)}>Required Advance</span>
          <div className={cx(layout.block15)}>
            {acceptedQuote
              ? formatCurrency(acceptedQuote.required_advance_minor)
              : "Not Set"}
          </div>
        </div>

        <div>
          <span className={cx(layout.block16)}>Confirmed Receipts</span>
          <div className={cx(layout.block17)}>
            {isAdvanceSatisfied ? (
              <span className={cx(layout.block18)}>
                ✓ {formatCurrency(confirmedReceiptsSum)}
              </span>
            ) : (
              <span className={cx(layout.block19)}>
                ⚠ {formatCurrency(confirmedReceiptsSum)}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <div className={cx(layout.block20)}>{error}</div>}

      {/* Tabs */}
      <div className={cx(layout.block21)}>
        <button
          onClick={() => setActiveTab("QUOTES")}
          style={{
            borderBottom:
              activeTab === "QUOTES"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "QUOTES" ? 600 : 400,
            color:
              activeTab === "QUOTES"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block22)}
        >
          Quotations ({quotations.length})
        </button>
        <button
          onClick={() => setActiveTab("SCHEDULE")}
          style={{
            borderBottom:
              activeTab === "SCHEDULE"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "SCHEDULE" ? 600 : 400,
            color:
              activeTab === "SCHEDULE"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block23)}
        >
          Payment Schedule
        </button>
        <button
          onClick={() => setActiveTab("INVOICES")}
          style={{
            borderBottom:
              activeTab === "INVOICES"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "INVOICES" ? 600 : 400,
            color:
              activeTab === "INVOICES"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block24)}
        >
          Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("RECEIPTS")}
          style={{
            borderBottom:
              activeTab === "RECEIPTS"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "RECEIPTS" ? 600 : 400,
            color:
              activeTab === "RECEIPTS"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block25)}
        >
          Receipts & Payments ({receipts.length})
        </button>
      </div>

      {/* Quotations Tab */}
      {activeTab === "QUOTES" && (
        <div className={cx(layout.block26)}>
          {quotations.map((quote) => (
            <div key={quote.id} className={cx(layout.block27)}>
              <div className={cx(layout.block28)}>
                <div>
                  <h3 className={cx(layout.block29)}>
                    {quote.title} (V{quote.version_number})
                  </h3>
                  <p className={cx(["text-muted", layout.block30].join(" "))}>
                    Prepared by {quote.creator_name} · Required Advance:{" "}
                    {formatCurrency(quote.required_advance_minor)}
                  </p>
                </div>
                <div className={cx(layout.block31)}>
                  <span
                    style={{
                      backgroundColor:
                        quote.status === "ACCEPTED"
                          ? "var(--ui-success-bg)"
                          : "var(--ui-warning-bg)",
                      color:
                        quote.status === "ACCEPTED" ? "var(--ui-success)" : "var(--ui-warning)",
                    }}
                    className={cx(layout.block32)}
                  >
                    {quote.status}
                  </span>
                  {quote.status === "SENT" && (
                    <PermissionGate projectId={projectId} contractual>
                      <ProjectMutation>
                        <button
                          onClick={() => handleAcceptQuote(quote.id)}
                          className={cx(
                            ["btn-primary", layout.block33].join(" "),
                          )}
                        >
                          Accept Proposal
                        </button>
                      </ProjectMutation>
                    </PermissionGate>
                  )}
                </div>
              </div>

              {/* Items */}
              {quote.items && quote.items.length > 0 && (
                <table className={cx(layout.block34)}>
                  <thead>
                    <tr className={cx(layout.block35)}>
                      <th className={cx(layout.block36)}>Description</th>
                      <th className={cx(layout.block37)}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((itm) => (
                      <tr key={itm.id} className={cx(layout.block38)}>
                        <td className={cx(layout.block39)}>
                          {itm.description}
                        </td>
                        <td className={cx(layout.block40)}>
                          {formatCurrency(itm.amount_minor)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className={cx(layout.block41)}>Total Agreed Scope</td>
                      <td className={cx(layout.block42)}>
                        {formatCurrency(quote.total_amount_minor)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment Schedule Tab */}
      {activeTab === "SCHEDULE" && (
        <div>
          {schedules.length === 0 ? (
            <p className={cx("text-muted")}>
              No payment schedule established yet.
            </p>
          ) : (
            <div className={cx(layout.block43)}>
              {schedules.map((sch) => (
                <div key={sch.id} className={cx(layout.block44)}>
                  <div className={cx(layout.block45)}>
                    <div>
                      <h3 className={cx(layout.block46)}>
                        Payment Schedule Version {sch.version_number}
                      </h3>
                      {sch.revision_reason && (
                        <p className={cx(layout.block47)}>
                          Reason: {sch.revision_reason}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        backgroundColor:
                          sch.status === "AGREED"
                            ? "var(--ui-success-bg)"
                            : "var(--ui-surface-subtle)",
                        color: sch.status === "AGREED" ? "var(--ui-success)" : "var(--ui-text-muted)",
                      }}
                      className={cx(layout.block48)}
                    >
                      {sch.status}
                    </span>
                  </div>

                  {sch.items && (
                    <table className={cx(layout.block49)}>
                      <thead>
                        <tr className={cx(layout.block50)}>
                          <th className={cx(layout.block51)}>#</th>
                          <th className={cx(layout.block52)}>
                            Milestone Description
                          </th>
                          <th className={cx(layout.block53)}>Trigger Rule</th>
                          <th className={cx(layout.block54)}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sch.items.map((itm) => (
                          <tr key={itm.id} className={cx(layout.block55)}>
                            <td className={cx(layout.block56)}>
                              {itm.item_order}
                            </td>
                            <td className={cx(layout.block57)}>
                              {itm.description}
                            </td>
                            <td className={cx(layout.block58)}>
                              {itm.trigger_type}{" "}
                              {itm.target_date && `(${itm.target_date})`}{" "}
                              {itm.target_stage_name &&
                                `[${itm.target_stage_name}]`}
                            </td>
                            <td className={cx(layout.block59)}>
                              {formatCurrency(itm.amount_minor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === "INVOICES" && (
        <div>
          <div className={cx(layout.block60)}>
            {!archived && (
              <PermissionGate projectId={projectId} grant="financeAuthor">
                <ProjectMutation>
                  <button
                    onClick={() => setShowDraftInvoiceModal(true)}
                    className={cx(["btn-primary", layout.block61].join(" "))}
                  >
                    + Draft Invoice
                  </button>
                </ProjectMutation>
              </PermissionGate>
            )}
          </div>

          <div className={cx(layout.block62)}>
            {invoices.map((inv) => (
              <div key={inv.id} className={cx(layout.block63)}>
                <div className={cx(layout.block64)}>
                  <div>
                    <h3 className={cx(layout.block65)}>
                      {inv.invoice_number
                        ? inv.invoice_number
                        : `Draft Invoice (V${inv.current_version_number})`}
                    </h3>
                    <p className={cx(["text-muted", layout.block66].join(" "))}>
                      Due: {inv.due_date} · Prepared by {inv.creator_name}
                    </p>
                  </div>
                  <div className={cx(layout.block67)}>
                    <span
                      style={{
                        backgroundColor:
                          inv.status === "ISSUED" ? "var(--ui-info-bg)" : "var(--ui-warning-bg)",
                        color: inv.status === "ISSUED" ? "var(--ui-link)" : "var(--ui-warning)",
                      }}
                      className={cx(layout.block68)}
                    >
                      {inv.status}
                    </span>
                    {inv.status === "ISSUED" && (
                      <span
                        style={{
                          backgroundColor:
                            inv.settlement_status === "PAID"
                              ? "var(--ui-success-bg)"
                              : "var(--ui-danger-bg)",
                          color:
                            inv.settlement_status === "PAID"
                              ? "var(--ui-success)"
                              : "var(--ui-danger)",
                        }}
                        className={cx(layout.block69)}
                      >
                        {inv.settlement_status}
                      </span>
                    )}
                  </div>
                </div>

                <div className={cx(layout.block70)}>
                  <div>
                    Total: <strong>{formatCurrency(inv.total_minor)}</strong>
                  </div>
                  <div>
                    Allocated:{" "}
                    <strong className={cx(layout.block71)}>
                      {formatCurrency(inv.allocated_minor)}
                    </strong>
                  </div>
                  <div>
                    Outstanding:{" "}
                    <strong className={cx(layout.block72)}>
                      {formatCurrency(inv.outstanding_minor)}
                    </strong>
                  </div>
                </div>

                {/* Actions */}
                <div className={cx(layout.block73)}>
                  {inv.status === "DRAFT" && (
                    <PermissionGate projectId={projectId} roles={["MANAGER"]}>
                      <ProjectMutation>
                        <button
                          onClick={() =>
                            handleApproveInvoice(
                              inv.id,
                              inv.current_version_number,
                            )
                          }
                          className={cx(layout.block74)}
                        >
                          Approve (Manager)
                        </button>
                      </ProjectMutation>
                    </PermissionGate>
                  )}
                  {inv.status === "APPROVED" && (
                    <PermissionGate projectId={projectId} grant="invoiceIssue">
                      <ProjectMutation>
                        <button
                          onClick={() =>
                            handleIssueInvoice(
                              inv.id,
                              inv.current_version_number,
                            )
                          }
                          className={cx(layout.block75)}
                        >
                          Issue Invoice (Staff)
                        </button>
                      </ProjectMutation>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receipts Tab */}
      {activeTab === "RECEIPTS" && (
        <div>
          <div className={cx(layout.block76)}>
            {(!archived || admin) && (
              <PermissionGate projectId={projectId} paymentReport>
                <button
                  onClick={() => {
                    setReportKey(crypto.randomUUID());
                    setShowReportReceiptModal(true);
                  }}
                  className={cx(["btn-primary", layout.block77].join(" "))}
                >
                  + {archived ? "Record settlement payment" : "Report payment"}
                </button>
              </PermissionGate>
            )}
          </div>

          <div className={cx(layout.block78)}>
            {receipts.map((rcp) => (
              <div key={rcp.id} className={cx(layout.block79)}>
                <div className={cx(layout.block80)}>
                  <div>
                    <h3 className={cx(layout.block81)}>
                      {rcp.receipt_number || "Reported Transfer"}
                    </h3>
                    <p className={cx(["text-muted", layout.block82].join(" "))}>
                      Received Date: {rcp.received_date} · Method:{" "}
                      {rcp.payment_method} · Reporter: {rcp.reporter_name}
                    </p>
                  </div>
                  <span
                    style={{
                      backgroundColor:
                        rcp.status === "CONFIRMED"
                          ? "var(--ui-success-bg)"
                          : "var(--ui-warning-bg)",
                      color: rcp.status === "CONFIRMED" ? "var(--ui-success)" : "var(--ui-warning)",
                    }}
                    className={cx(layout.block83)}
                  >
                    {rcp.status}
                  </span>
                </div>

                <div className={cx(layout.block84)}>
                  <div>
                    Amount: <strong>{formatCurrency(rcp.amount_minor)}</strong>
                  </div>
                  <div>
                    Allocated to Invoices:{" "}
                    <strong className={cx(layout.block85)}>
                      {formatCurrency(rcp.allocated_minor)}
                    </strong>
                  </div>
                  <div>
                    Unallocated Advance:{" "}
                    <strong className={cx(layout.block86)}>
                      {formatCurrency(rcp.unallocated_minor)}
                    </strong>
                  </div>
                </div>

                <div className={cx(layout.block87)}>
                  {rcp.status === "REPORTED" && (
                    <PermissionGate projectId={projectId} roles={["ADMIN"]}>
                      <button
                        onClick={() => handleConfirmReceipt(rcp.id)}
                        className={cx(layout.block88)}
                      >
                        Confirm Real Money (Admin)
                      </button>
                    </PermissionGate>
                  )}
                  {rcp.status === "CONFIRMED" && rcp.unallocated_minor > 0 && (
                    <PermissionGate projectId={projectId} roles={["ADMIN"]}>
                      <button
                        onClick={() => {
                          setSelectedReceiptId(rcp.id);
                          setAllocInvoiceId(rcp.settlement_invoice_id || "");
                          setAllocateKey(crypto.randomUUID());
                          setShowAllocateModal(true);
                        }}
                        className={cx(layout.block89)}
                      >
                        Allocate to Invoice (Admin)
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Invoice Modal */}
      {showDraftInvoiceModal && (
        <Dialog
          title="Draft New Invoice"
          onClose={() => setShowDraftInvoiceModal(false)}
        >
          <div className={cx(layout.block91)}>
            <h2 className={cx(layout.block92)}>Draft New Invoice</h2>
            <form onSubmit={handleCreateDraftInvoice}>
              <div className={cx(layout.block93)}>
                <label className={cx(layout.block94)} htmlFor="invDueDate">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className={cx(layout.block95)}
                  id="invDueDate"
                />
              </div>

              <div className={cx(layout.block96)}>
                <label className={cx(layout.block97)} htmlFor="invDesc">
                  Line Item Description
                </label>
                <input
                  type="text"
                  required
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                  placeholder="e.g. Architectural Phase 1 Milestone"
                  className={cx(layout.block98)}
                  id="invDesc"
                />
              </div>

              <div className={cx(layout.block99)}>
                <label className={cx(layout.block100)} htmlFor="invAmount">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className={cx(layout.block101)}
                  id="invAmount"
                />
              </div>

              <div className={cx(layout.block102)}>
                <PermissionGate projectId={projectId} grant="financeAuthor">
                  <button
                    type="button"
                    onClick={() => setShowDraftInvoiceModal(false)}
                    className={cx(layout.block103)}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button type="submit" className={cx(layout.block104)}>
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Report Receipt Modal */}
      {showReportReceiptModal && (
        <Dialog
          title={
            archived ? "Record settlement payment" : "Report external payment"
          }
          onClose={() => setShowReportReceiptModal(false)}
        >
          <div className={cx(layout.block106)}>
            <h2 className={cx(layout.block107)}>
              {archived
                ? "Record settlement payment"
                : "Report external payment"}
            </h2>
            <form onSubmit={handleReportReceipt} className="page-stack">
              {archived && (
                <Field label="Existing outstanding invoice">
                  <select
                    required
                    value={settlementInvoiceId}
                    onChange={(e) => setSettlementInvoiceId(e.target.value)}
                  >
                    <option value="">Select existing invoice</option>
                    {invoices
                      .filter(
                        (i) => i.status === "ISSUED" && i.outstanding_minor > 0,
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.invoice_number} —{" "}
                          {formatCurrency(i.outstanding_minor)} outstanding
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label="Date received">
                <input
                  required
                  type="date"
                  value={rcpDate}
                  onChange={(e) => setRcpDate(e.target.value)}
                />
              </Field>
              <Field label="Payment evidence (optional)">
                <select
                  value={evidenceFileId}
                  onChange={(e) => setEvidenceFileId(e.target.value)}
                >
                  <option value="">
                    Use the bank reference recorded below
                  </option>
                  {receiptFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.file_name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted">
                Record an actual payment received outside the portal.
                Confirmation and allocation remain separate actions.
              </p>
              <div className={cx(layout.block108)}>
                <label className={cx(layout.block109)} htmlFor="rcpAmount">
                  Amount Paid (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rcpAmount}
                  onChange={(e) => setRcpAmount(e.target.value)}
                  className={cx(layout.block110)}
                  id="rcpAmount"
                />
              </div>

              <div className={cx(layout.block111)}>
                <label className={cx(layout.block112)} htmlFor="rcpMethod">
                  Payment Method
                </label>
                <select
                  value={rcpMethod}
                  onChange={(e) => setRcpMethod(e.target.value)}
                  className={cx(layout.block113)}
                  id="rcpMethod"
                >
                  <option value="NEFT">NEFT / Bank Transfer</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className={cx(layout.block114)}>
                <label className={cx(layout.block115)} htmlFor="rcpRef">
                  UTR / Bank Reference Note
                </label>
                <input
                  type="text"
                  required
                  value={rcpRef}
                  onChange={(e) => setRcpRef(e.target.value)}
                  placeholder="e.g. UTR12345678"
                  className={cx(layout.block116)}
                  id="rcpRef"
                />
              </div>

              <div className={cx(layout.block117)}>
                <button
                  type="button"
                  onClick={() => setShowReportReceiptModal(false)}
                  className={cx(layout.block118)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportBusy}
                  className={cx(layout.block119)}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Allocate Modal */}
      {showAllocateModal && (
        <Dialog
          title="Allocate Receipt to Invoice"
          onClose={() => setShowAllocateModal(false)}
        >
          <div className={cx(layout.block121)}>
            <h2 className={cx(layout.block122)}>Allocate Receipt to Invoice</h2>
            <form onSubmit={handleAllocateReceipt}>
              <div className={cx(layout.block123)}>
                <label className={cx(layout.block124)} htmlFor="allocInvoiceId">
                  Target Invoice
                </label>
                <select
                  required
                  value={allocInvoiceId}
                  onChange={(e) => setAllocInvoiceId(e.target.value)}
                  className={cx(layout.block125)}
                  id="allocInvoiceId"
                >
                  <option value="">Select an invoice...</option>
                  {invoices
                    .filter(
                      (inv) =>
                        inv.status === "ISSUED" &&
                        inv.outstanding_minor > 0 &&
                        (!receipts.find((r) => r.id === selectedReceiptId)
                          ?.settlement_invoice_id ||
                          receipts.find((r) => r.id === selectedReceiptId)
                            ?.settlement_invoice_id === inv.id),
                    )
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Outstanding:{" "}
                        {formatCurrency(inv.outstanding_minor)})
                      </option>
                    ))}
                </select>
              </div>

              <div className={cx(layout.block126)}>
                <label className={cx(layout.block127)} htmlFor="allocAmount">
                  Allocation Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(e.target.value)}
                  className={cx(layout.block128)}
                  id="allocAmount"
                />
              </div>

              <div className={cx(layout.block129)}>
                <PermissionGate projectId={projectId} roles={["ADMIN"]}>
                  <button
                    type="button"
                    onClick={() => setShowAllocateModal(false)}
                    className={cx(layout.block130)}
                  >
                    Cancel
                  </button>
                </PermissionGate>
                <button type="submit" className={cx(layout.block131)}>
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
