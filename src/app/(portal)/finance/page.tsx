"use client";

import React, { useState, useEffect } from "react";

interface FinancialReport {
  reportingBasis: string;
  currency: string;
  period: { startDate: string; endDate: string };
  invoicedAmountMinor: number;
  moneyReceivedMinor: number;
  directExpensesMinor: number;
  consultantFeesMinor: number;
  nonSensitiveCostsMinor: number;
  salariesMinor?: number;
  totalCostsMinor?: number;
  operatingProfitMinor?: number;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  supplier_name?: string;
  amount_minor: number;
  incurred_date: string;
  status: string;
  submitter_name: string;
  approver_name?: string;
  project_name?: string;
}

interface ConsultantBill {
  id: string;
  consultant_name: string;
  bill_reference: string;
  discipline: string;
  amount_minor: number;
  bill_date: string;
  status: string;
  project_name: string;
}

interface PayrollRecord {
  id: string;
  employee_name: string;
  period_month: string;
  gross_salary_minor: number;
  project_name?: string;
}

export default function FirmFinancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<FinancialReport | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [consultantBills, setConsultantBills] = useState<ConsultantBill[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[] | null>(null); // null if unauthorized
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "EXPENSES" | "CONSULTANTS" | "PAYROLL">("OVERVIEW");

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showConsultantModal, setShowConsultantModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);

  // Form states
  const [expDesc, setExpDesc] = useState("");
  const [expCategory, setExpCategory] = useState("SITE_TRAVEL");
  const [expAmount, setExpAmount] = useState("");
  const [expSupplier, setExpSupplier] = useState("");
  const [cblRef, setCblRef] = useState("");
  const [cblDiscipline, setCblDiscipline] = useState("STRUCTURAL");
  const [cblAmount, setCblAmount] = useState("");
  const [salEmployee, setSalEmployee] = useState("");
  const [salMonth, setSalMonth] = useState("2026-11");
  const [salAmount, setSalAmount] = useState("");

  const formatCurrency = (minor: number) => {
    const rupees = (minor / 100).toFixed(2);
    return `₹ ${Number(rupees).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const [repRes, expRes, cblRes, payRes] = await Promise.all([
        fetch("/api/finance/reports"),
        fetch("/api/finance/expenses"),
        fetch("/api/finance/consultants"),
        fetch("/api/finance/payroll"),
      ]);

      if (repRes.ok) {
        const data = (await repRes.json()) as any;
        setReport(data.report || null);
      }
      if (expRes.ok) {
        const data = (await expRes.json()) as any;
        setExpenses(data.expenses || []);
      }
      if (cblRes.ok) {
        const data = (await cblRes.json()) as any;
        setConsultantBills(data.bills || []);
      }
      if (payRes.ok) {
        const data = (await payRes.json()) as any;
        setPayrollRecords(data.payroll || []);
      } else {
        setPayrollRecords(null); // non-admin: strictly unavailable
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const handleApproveExpense = async (expenseId: string) => {
    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", expenseId }),
      });
      if (!res.ok) throw new Error("Failed to approve expense");
      fetchFinancials();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostExpense = async (expenseId: string) => {
    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "POST", expenseId }),
      });
      if (!res.ok) throw new Error("Failed to post expense to ledger");
      fetchFinancials();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveConsultantBill = async (billId: string) => {
    try {
      const res = await fetch("/api/finance/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", billId }),
      });
      if (!res.ok) throw new Error("Failed to approve consultant bill");
      fetchFinancials();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePostConsultantBill = async (billId: string) => {
    try {
      const res = await fetch("/api/finance/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "POST", billId }),
      });
      if (!res.ok) throw new Error("Failed to post consultant bill to ledger");
      fetchFinancials();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="portal-container" style={{ padding: "2rem" }}>
        <p className="text-muted">Loading practice financial accounts...</p>
      </div>
    );
  }

  return (
    <div className="portal-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display" style={{ fontSize: "1.75rem", fontWeight: 600 }}>Firm Operational Accounts</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Ledger-balanced receivables, operational expenses, consultant obligations, and protected executive reporting.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            + Record Expense
          </button>
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
          onClick={() => setActiveTab("OVERVIEW")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "OVERVIEW" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "OVERVIEW" ? 600 : 400,
            color: activeTab === "OVERVIEW" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Statement Overview
        </button>
        <button
          onClick={() => setActiveTab("EXPENSES")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "EXPENSES" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "EXPENSES" ? 600 : 400,
            color: activeTab === "EXPENSES" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("CONSULTANTS")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "CONSULTANTS" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "CONSULTANTS" ? 600 : 400,
            color: activeTab === "CONSULTANTS" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Consultant Obligations ({consultantBills.length})
        </button>
        {payrollRecords !== null && (
          <button
            onClick={() => setActiveTab("PAYROLL")}
            style={{
              padding: "0.75rem 1rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "PAYROLL" ? "2px solid var(--color-primary)" : "2px solid transparent",
              fontWeight: activeTab === "PAYROLL" ? 600 : 400,
              color: activeTab === "PAYROLL" ? "var(--color-primary)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            🔒 Payroll & Salaries ({payrollRecords.length})
          </button>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === "OVERVIEW" && report && (
        <div>
          <div style={{ padding: "0.75rem 1.25rem", backgroundColor: "#F3F4F6", borderRadius: "6px", marginBottom: "1.5rem", fontSize: "0.8125rem", color: "#4B5563" }}>
            <strong>Reporting Basis:</strong> {report.reportingBasis} · <strong>Base Currency:</strong> {report.currency} · <strong>Period:</strong> {report.period.startDate} to {report.period.endDate}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Invoiced Value (Revenue)</span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {formatCurrency(report.invoicedAmountMinor)}
              </div>
            </div>

            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Money Received (Cash)</span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: "#059669" }}>
                {formatCurrency(report.moneyReceivedMinor)}
              </div>
            </div>

            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Direct Expenses</span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {formatCurrency(report.directExpensesMinor)}
              </div>
            </div>

            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Consultant Fees</span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                {formatCurrency(report.consultantFeesMinor)}
              </div>
            </div>

            {/* Protected Salary & Profit Cards (ADMIN ONLY) */}
            {report.salariesMinor !== undefined && (
              <div style={{ padding: "1.25rem", backgroundColor: "#FAF5FF", borderRadius: "8px", border: "1px solid #E9D5FF" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7E22CE", textTransform: "uppercase" }}>🔒 Salaries & Payroll (Admin)</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: "#6B21A8" }}>
                  {formatCurrency(report.salariesMinor)}
                </div>
              </div>
            )}

            {report.operatingProfitMinor !== undefined && (
              <div style={{ padding: "1.25rem", backgroundColor: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#15803D", textTransform: "uppercase" }}>🔒 Operating Profit (Admin)</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: "#166534" }}>
                  {formatCurrency(report.operatingProfitMinor)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === "EXPENSES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {expenses.map((exp) => (
            <div key={exp.id} style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280" }}>{exp.category} · {exp.incurred_date}</span>
                <h4 style={{ margin: "0.25rem 0", fontWeight: 600 }}>{exp.description}</h4>
                <p className="text-muted" style={{ fontSize: "0.8125rem", margin: 0 }}>
                  Supplier: {exp.supplier_name || "Direct"} · Submitted by {exp.submitter_name}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>{formatCurrency(exp.amount_minor)}</span>
                <span style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: exp.status === "POSTED" ? "#D1FAE5" : exp.status === "APPROVED" ? "#DBEAFE" : "#FEF3C7",
                  color: exp.status === "POSTED" ? "#065F46" : exp.status === "APPROVED" ? "#1E40AF" : "#92400E",
                }}>
                  {exp.status}
                </span>

                {exp.status === "SUBMITTED" && (
                  <button
                    onClick={() => handleApproveExpense(exp.id)}
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    Approve (Manager)
                  </button>
                )}
                {exp.status === "APPROVED" && (
                  <button
                    onClick={() => handlePostExpense(exp.id)}
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Post (Admin)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consultant Obligations Tab */}
      {activeTab === "CONSULTANTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {consultantBills.map((cb) => (
            <div key={cb.id} style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280" }}>{cb.discipline} · Ref: {cb.bill_reference}</span>
                <h4 style={{ margin: "0.25rem 0", fontWeight: 600 }}>{cb.consultant_name}</h4>
                <p className="text-muted" style={{ fontSize: "0.8125rem", margin: 0 }}>
                  Project: {cb.project_name} · Bill Date: {cb.bill_date}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>{formatCurrency(cb.amount_minor)}</span>
                <span style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: cb.status === "POSTED" ? "#D1FAE5" : cb.status === "APPROVED" ? "#DBEAFE" : "#FEF3C7",
                  color: cb.status === "POSTED" ? "#065F46" : cb.status === "APPROVED" ? "#1E40AF" : "#92400E",
                }}>
                  {cb.status}
                </span>

                {cb.status === "SUBMITTED" && (
                  <button
                    onClick={() => handleApproveConsultantBill(cb.id)}
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    Approve (Manager)
                  </button>
                )}
                {cb.status === "APPROVED" && (
                  <button
                    onClick={() => handlePostConsultantBill(cb.id)}
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Post (Admin)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll Tab (ADMIN ONLY) */}
      {activeTab === "PAYROLL" && payrollRecords && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "0.75rem 1.25rem", backgroundColor: "#FEF3C7", borderRadius: "6px", color: "#92400E", fontSize: "0.8125rem" }}>
            🔒 <strong>Strictly Confidential (Admin Only):</strong> Payroll allocations and individual salaries are protected by operational permissions and isolated from staff, consultants, and non-admin owners.
          </div>

          {payrollRecords.map((pr) => (
            <div key={pr.id} style={{ padding: "1.25rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280" }}>Period: {pr.period_month}</span>
                <h4 style={{ margin: "0.25rem 0", fontWeight: 600 }}>{pr.employee_name}</h4>
                <p className="text-muted" style={{ fontSize: "0.8125rem", margin: 0 }}>
                  Project Allocation: {pr.project_name || "Firm Overhead"}
                </p>
              </div>

              <div>
                <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#6B21A8" }}>
                  {formatCurrency(pr.gross_salary_minor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
