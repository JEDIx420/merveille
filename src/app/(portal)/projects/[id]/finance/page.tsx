"use client";

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
  items?: Array<{ id: string; description: string; quantity: number; unit_rate_minor: number; amount_minor: number }>;
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
  allocations?: Array<{ id: string; invoice_number: string; amount_minor: number }>;
}

export default function ProjectFinancePage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [activeTab, setActiveTab] = useState<"QUOTES" | "SCHEDULE" | "INVOICES" | "RECEIPTS">("QUOTES");

  // Modals
  const [showDraftInvoiceModal, setShowDraftInvoiceModal] = useState(false);
  const [showReportReceiptModal, setShowReportReceiptModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Form inputs
  const [invDueDate, setInvDueDate] = useState("");
  const [invDesc, setInvDesc] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [rcpAmount, setRcpAmount] = useState("");
  const [rcpMethod, setRcpMethod] = useState("NEFT");
  const [rcpRef, setRcpRef] = useState("");
  const [allocInvoiceId, setAllocInvoiceId] = useState("");
  const [allocAmount, setAllocAmount] = useState("");

  const formatCurrency = (minor: number) => {
    const rupees = (minor / 100).toFixed(2);
    return `₹ ${Number(rupees).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [qRes, sRes, iRes, rRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/finance/quotes`),
        fetch(`/api/projects/${projectId}/finance/schedule`),
        fetch(`/api/projects/${projectId}/finance/invoices`),
        fetch(`/api/projects/${projectId}/finance/receipts`),
      ]);

      if (qRes.ok) {
        const qData = (await qRes.json()) as any;
        setQuotations(qData.quotations || []);
      }
      if (sRes.ok) {
        const sData = (await sRes.json()) as any;
        setSchedules(sData.schedules || []);
      }
      if (iRes.ok) {
        const iData = (await iRes.json()) as any;
        setInvoices(iData.invoices || []);
      }
      if (rRes.ok) {
        const rData = (await rRes.json()) as any;
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
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to accept quotation");
      }
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
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
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to draft invoice");
      }
      setShowDraftInvoiceModal(false);
      setInvDueDate("");
      setInvDesc("");
      setInvAmount("");
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveInvoice = async (invoiceId: string, versionNumber: number) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", versionNumber }),
      });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to approve invoice");
      }
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleIssueInvoice = async (invoiceId: string, versionNumber: number) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ISSUE", versionNumber }),
      });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to issue invoice");
      }
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReportReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountMinor = Math.round(parseFloat(rcpAmount) * 100);
      const res = await fetch(`/api/projects/${projectId}/finance/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REPORT",
          amountMinor,
          receivedDate: new Date().toISOString().slice(0, 10),
          paymentMethod: rcpMethod,
          referenceNote: rcpRef,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to report payment");
      }
      setShowReportReceiptModal(false);
      setRcpAmount("");
      setRcpRef("");
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
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
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to confirm receipt");
      }
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
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
          receiptId: selectedReceiptId,
          invoiceId: allocInvoiceId,
          amountMinor,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to allocate funds");
      }
      setShowAllocateModal(false);
      setSelectedReceiptId(null);
      setAllocInvoiceId("");
      setAllocAmount("");
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActivateProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/finance/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as any;
        throw new Error(data.error || "Failed to activate project");
      }
      alert("Project commercial activation successful!");
      fetchFinanceData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="portal-container" style={{ padding: "2rem" }}>
        <p className="text-muted">Loading commercial finance records...</p>
      </div>
    );
  }

  const acceptedQuote = quotations.find((q) => q.status === "ACCEPTED");
  const confirmedReceiptsSum = receipts
    .filter((r) => r.status === "CONFIRMED")
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const isAdvanceSatisfied = acceptedQuote
    ? confirmedReceiptsSum >= acceptedQuote.required_advance_minor
    : false;

  return (
    <div className="portal-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <a href={`/projects/${projectId}/overview`} style={{ color: "var(--color-primary)", textDecoration: "none", fontSize: "0.875rem", marginBottom: "0.5rem", display: "inline-block" }}>
            ← Back to Project Overview
          </a>
          <h1 className="text-display" style={{ fontSize: "1.75rem", fontWeight: 600 }}>Commercial Finance & Invoicing</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Authoritative quotations, upfront milestone schedules, approved billing, and confirmed receipts.
          </p>
        </div>

        {/* Commercial Gate Banner */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={handleActivateProject}
            className="btn-primary"
            style={{
              padding: "0.6rem 1.2rem",
              fontSize: "0.875rem",
              backgroundColor: acceptedQuote && isAdvanceSatisfied ? "#059669" : "#9CA3AF",
              cursor: acceptedQuote && isAdvanceSatisfied ? "pointer" : "not-allowed",
            }}
          >
            Activate Project
          </button>
        </div>
      </div>

      {/* Commercial Gate Status Summary */}
      <div style={{ padding: "1.25rem", backgroundColor: "#F9FAFB", borderRadius: "8px", border: "1px solid #E5E7EB", marginBottom: "2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Contractual Quotation</span>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: "0.25rem" }}>
            {acceptedQuote ? (
              <span style={{ color: "#059669" }}>✓ Accepted ({formatCurrency(acceptedQuote.total_amount_minor)})</span>
            ) : (
              <span style={{ color: "#DC2626" }}>✗ Pending Acceptance</span>
            )}
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Required Advance</span>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: "0.25rem" }}>
            {acceptedQuote ? formatCurrency(acceptedQuote.required_advance_minor) : "Not Set"}
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Confirmed Receipts</span>
          <div style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: "0.25rem" }}>
            {isAdvanceSatisfied ? (
              <span style={{ color: "#059669" }}>✓ {formatCurrency(confirmedReceiptsSum)}</span>
            ) : (
              <span style={{ color: "#D97706" }}>⚠ {formatCurrency(confirmedReceiptsSum)}</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#991B1B", borderRadius: "6px", marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setActiveTab("QUOTES")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "QUOTES" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "QUOTES" ? 600 : 400,
            color: activeTab === "QUOTES" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Quotations ({quotations.length})
        </button>
        <button
          onClick={() => setActiveTab("SCHEDULE")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "SCHEDULE" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "SCHEDULE" ? 600 : 400,
            color: activeTab === "SCHEDULE" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Payment Schedule
        </button>
        <button
          onClick={() => setActiveTab("INVOICES")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "INVOICES" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "INVOICES" ? 600 : 400,
            color: activeTab === "INVOICES" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("RECEIPTS")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "RECEIPTS" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "RECEIPTS" ? 600 : 400,
            color: activeTab === "RECEIPTS" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Receipts & Payments ({receipts.length})
        </button>
      </div>

      {/* Quotations Tab */}
      {activeTab === "QUOTES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {quotations.map((quote) => (
            <div key={quote.id} style={{ padding: "1.5rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                    {quote.title} (V{quote.version_number})
                  </h3>
                  <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                    Prepared by {quote.creator_name} · Required Advance: {formatCurrency(quote.required_advance_minor)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    backgroundColor: quote.status === "ACCEPTED" ? "#D1FAE5" : "#FEF3C7",
                    color: quote.status === "ACCEPTED" ? "#065F46" : "#92400E",
                  }}>
                    {quote.status}
                  </span>
                  {quote.status === "SENT" && (
                    <button
                      onClick={() => handleAcceptQuote(quote.id)}
                      className="btn-primary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem", cursor: "pointer" }}
                    >
                      Accept Proposal
                    </button>
                  )}
                </div>
              </div>

              {/* Items */}
              {quote.items && quote.items.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", marginTop: "1rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5E7EB", textAlign: "left", color: "#6B7280" }}>
                      <th style={{ padding: "0.5rem 0" }}>Description</th>
                      <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((itm) => (
                      <tr key={itm.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "0.5rem 0" }}>{itm.description}</td>
                        <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: 500 }}>
                          {formatCurrency(itm.amount_minor)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: "0.75rem 0", fontWeight: 600 }}>Total Agreed Scope</td>
                      <td style={{ padding: "0.75rem 0", textAlign: "right", fontWeight: 700, fontSize: "1rem" }}>
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
            <p className="text-muted">No payment schedule established yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {schedules.map((sch) => (
                <div key={sch.id} style={{ padding: "1.5rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                        Payment Schedule Version {sch.version_number}
                      </h3>
                      {sch.revision_reason && (
                        <p style={{ fontSize: "0.8125rem", color: "#6B7280", marginTop: "0.25rem" }}>
                          Reason: {sch.revision_reason}
                        </p>
                      )}
                    </div>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor: sch.status === "AGREED" ? "#D1FAE5" : "#F3F4F6",
                      color: sch.status === "AGREED" ? "#065F46" : "#6B7280",
                    }}>
                      {sch.status}
                    </span>
                  </div>

                  {sch.items && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #E5E7EB", textAlign: "left", color: "#6B7280" }}>
                          <th style={{ padding: "0.5rem 0" }}>#</th>
                          <th style={{ padding: "0.5rem 0" }}>Milestone Description</th>
                          <th style={{ padding: "0.5rem 0" }}>Trigger Rule</th>
                          <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sch.items.map((itm) => (
                          <tr key={itm.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "0.5rem 0" }}>{itm.item_order}</td>
                            <td style={{ padding: "0.5rem 0" }}>{itm.description}</td>
                            <td style={{ padding: "0.5rem 0", color: "#4B5563" }}>
                              {itm.trigger_type} {itm.target_date && `(${itm.target_date})`} {itm.target_stage_name && `[${itm.target_stage_name}]`}
                            </td>
                            <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: 500 }}>
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              onClick={() => setShowDraftInvoiceModal(true)}
              className="btn-primary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
            >
              + Draft Invoice
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ padding: "1.5rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                      {inv.invoice_number ? inv.invoice_number : `Draft Invoice (V${inv.current_version_number})`}
                    </h3>
                    <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                      Due: {inv.due_date} · Prepared by {inv.creator_name}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor: inv.status === "ISSUED" ? "#DBEAFE" : "#FEF3C7",
                      color: inv.status === "ISSUED" ? "#1E40AF" : "#92400E",
                    }}>
                      {inv.status}
                    </span>
                    {inv.status === "ISSUED" && (
                      <span style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: inv.settlement_status === "PAID" ? "#D1FAE5" : "#FEE2E2",
                        color: inv.settlement_status === "PAID" ? "#065F46" : "#991B1B",
                      }}>
                        {inv.settlement_status}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "2rem", marginTop: "1rem", fontSize: "0.875rem" }}>
                  <div>Total: <strong>{formatCurrency(inv.total_minor)}</strong></div>
                  <div>Allocated: <strong style={{ color: "#059669" }}>{formatCurrency(inv.allocated_minor)}</strong></div>
                  <div>Outstanding: <strong style={{ color: "#DC2626" }}>{formatCurrency(inv.outstanding_minor)}</strong></div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
                  {inv.status === "DRAFT" && (
                    <button
                      onClick={() => handleApproveInvoice(inv.id, inv.current_version_number)}
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8125rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Approve (Manager)
                    </button>
                  )}
                  {inv.status === "APPROVED" && (
                    <button
                      onClick={() => handleIssueInvoice(inv.id, inv.current_version_number)}
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8125rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Issue Invoice (Staff)
                    </button>
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              onClick={() => setShowReportReceiptModal(true)}
              className="btn-primary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
            >
              + Report Payment
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {receipts.map((rcp) => (
              <div key={rcp.id} style={{ padding: "1.5rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                      {rcp.receipt_number || "Reported Transfer"}
                    </h3>
                    <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                      Received Date: {rcp.received_date} · Method: {rcp.payment_method} · Reporter: {rcp.reporter_name}
                    </p>
                  </div>
                  <span style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    backgroundColor: rcp.status === "CONFIRMED" ? "#D1FAE5" : "#FEF3C7",
                    color: rcp.status === "CONFIRMED" ? "#065F46" : "#92400E",
                  }}>
                    {rcp.status}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "2rem", marginTop: "1rem", fontSize: "0.875rem" }}>
                  <div>Amount: <strong>{formatCurrency(rcp.amount_minor)}</strong></div>
                  <div>Allocated to Invoices: <strong style={{ color: "#059669" }}>{formatCurrency(rcp.allocated_minor)}</strong></div>
                  <div>Unallocated Advance: <strong style={{ color: "#2563EB" }}>{formatCurrency(rcp.unallocated_minor)}</strong></div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
                  {rcp.status === "REPORTED" && (
                    <button
                      onClick={() => handleConfirmReceipt(rcp.id)}
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8125rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Confirm Real Money (Admin)
                    </button>
                  )}
                  {rcp.status === "CONFIRMED" && rcp.unallocated_minor > 0 && (
                    <button
                      onClick={() => {
                        setSelectedReceiptId(rcp.id);
                        setShowAllocateModal(true);
                      }}
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.8125rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Allocate to Invoice (Admin)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Invoice Modal */}
      {showDraftInvoiceModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "500px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Draft New Invoice</h2>
            <form onSubmit={handleCreateDraftInvoice}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Due Date</label>
                <input
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Line Item Description</label>
                <input
                  type="text"
                  required
                  value={invDesc}
                  onChange={(e) => setInvDesc(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. Architectural Phase 1 Milestone"
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. 50000"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowDraftInvoiceModal(false)}
                  style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Receipt Modal */}
      {showReportReceiptModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "500px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Report External Payment</h2>
            <form onSubmit={handleReportReceipt}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rcpAmount}
                  onChange={(e) => setRcpAmount(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Payment Method</label>
                <select
                  value={rcpMethod}
                  onChange={(e) => setRcpMethod(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                >
                  <option value="NEFT">NEFT / Bank Transfer</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>UTR / Bank Reference Note</label>
                <input
                  type="text"
                  required
                  value={rcpRef}
                  onChange={(e) => setRcpRef(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. UTR12345678"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReportReceiptModal(false)}
                  style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "500px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>Allocate Receipt to Invoice</h2>
            <form onSubmit={handleAllocateReceipt}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Target Invoice</label>
                <select
                  required
                  value={allocInvoiceId}
                  onChange={(e) => setAllocInvoiceId(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                >
                  <option value="">Select an invoice...</option>
                  {invoices
                    .filter((inv) => inv.status === "ISSUED" && inv.outstanding_minor > 0)
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Outstanding: {formatCurrency(inv.outstanding_minor)})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Allocation Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={allocAmount}
                  onChange={(e) => setAllocAmount(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
