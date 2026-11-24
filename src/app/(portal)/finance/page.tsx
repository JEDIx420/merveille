"use client";
import { AccountingForms } from "@/features/accounting-forms";
import { PermissionGate } from "@/components/permission-gate";
import { cx } from "@/components/utilities";
import { ErrorState, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

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
  const feedback = useFeedback();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<FinancialReport | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [consultantBills, setConsultantBills] = useState<ConsultantBill[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[] | null>(
    null,
  ); // null if unauthorized
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "EXPENSES" | "CONSULTANTS" | "PAYROLL"
  >("OVERVIEW");

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
        const data = (await readResponse(repRes)) as any;
        setReport(data.report || null);
      }
      if (expRes.ok) {
        const data = (await readResponse(expRes)) as any;
        setExpenses(data.expenses || []);
      }
      if (cblRes.ok) {
        const data = (await readResponse(cblRes)) as any;
        setConsultantBills(data.bills || []);
      }
      if (payRes.ok) {
        const data = (await readResponse(payRes)) as any;
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
      feedback.notify(err.message);
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
      feedback.notify(err.message);
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
      feedback.notify(err.message);
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
      feedback.notify(err.message);
    }
  };

  if (loading) {
    return (
      <div className={cx(["portal-container", layout.block1].join(" "))}>
        <p className={cx("text-muted")}>
          Loading practice financial accounts...
        </p>
      </div>
    );
  }

  if (error) return <ErrorState message={error} retry={fetchFinancials} />;
  return (
    <div className={cx(["portal-container", layout.block2].join(" "))}>
      <AccountingForms onSaved={fetchFinancials} />
      {/* Header */}
      <div className={cx(layout.block3)}>
        <div>
          <h1 className={cx(["text-display", layout.block4].join(" "))}>
            Firm Operational Accounts
          </h1>
          <p className={cx(["text-muted", layout.block5].join(" "))}>
            Ledger-balanced receivables, operational expenses, consultant
            obligations, and protected executive reporting.
          </p>
        </div>

        <div className={cx(layout.block6)}>
          <button
            onClick={() => setShowExpenseModal(true)}
            className={cx(["btn-secondary", layout.block7].join(" "))}
          >
            + Record Expense
          </button>
        </div>
      </div>

      {error && <div className={cx(layout.block8)}>{error}</div>}

      {/* Tabs */}
      <div className={cx(layout.block9)}>
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          style={{
            borderBottom:
              activeTab === "OVERVIEW"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "OVERVIEW" ? 600 : 400,
            color:
              activeTab === "OVERVIEW"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block10)}
        >
          Statement Overview
        </button>
        <button
          onClick={() => setActiveTab("EXPENSES")}
          style={{
            borderBottom:
              activeTab === "EXPENSES"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "EXPENSES" ? 600 : 400,
            color:
              activeTab === "EXPENSES"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block11)}
        >
          Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("CONSULTANTS")}
          style={{
            borderBottom:
              activeTab === "CONSULTANTS"
                ? "2px solid var(--ui-action)"
                : "2px solid transparent",
            fontWeight: activeTab === "CONSULTANTS" ? 600 : 400,
            color:
              activeTab === "CONSULTANTS"
                ? "var(--ui-action)"
                : "var(--ui-text-muted)",
          }}
          className={cx(layout.block12)}
        >
          Consultant Obligations ({consultantBills.length})
        </button>
        {payrollRecords !== null && (
          <button
            onClick={() => setActiveTab("PAYROLL")}
            style={{
              borderBottom:
                activeTab === "PAYROLL"
                  ? "2px solid var(--ui-action)"
                  : "2px solid transparent",
              fontWeight: activeTab === "PAYROLL" ? 600 : 400,
              color:
                activeTab === "PAYROLL"
                  ? "var(--ui-action)"
                  : "var(--ui-text-muted)",
            }}
            className={cx(layout.block13)}
          >
            🔒 Payroll & Salaries ({payrollRecords.length})
          </button>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === "OVERVIEW" && report && (
        <div>
          <div className={cx(layout.block14)}>
            <strong>Reporting Basis:</strong> {report.reportingBasis} ·{" "}
            <strong>Base Currency:</strong> {report.currency} ·{" "}
            <strong>Period:</strong> {report.period.startDate} to{" "}
            {report.period.endDate}
          </div>

          <div className={cx(layout.block15)}>
            <div className={cx(layout.block16)}>
              <span className={cx(layout.block17)}>
                Invoiced Value (Revenue)
              </span>
              <div className={cx(layout.block18)}>
                {formatCurrency(report.invoicedAmountMinor)}
              </div>
            </div>

            <div className={cx(layout.block19)}>
              <span className={cx(layout.block20)}>Money Received (Cash)</span>
              <div className={cx(layout.block21)}>
                {formatCurrency(report.moneyReceivedMinor)}
              </div>
            </div>

            <div className={cx(layout.block22)}>
              <span className={cx(layout.block23)}>Direct Expenses</span>
              <div className={cx(layout.block24)}>
                {formatCurrency(report.directExpensesMinor)}
              </div>
            </div>

            <div className={cx(layout.block25)}>
              <span className={cx(layout.block26)}>Consultant Fees</span>
              <div className={cx(layout.block27)}>
                {formatCurrency(report.consultantFeesMinor)}
              </div>
            </div>

            {/* Protected Salary & Profit Cards (ADMIN ONLY) */}
            {report.salariesMinor !== undefined && (
              <div className={cx(layout.block28)}>
                <span className={cx(layout.block29)}>
                  🔒 Salaries & Payroll (Admin)
                </span>
                <div className={cx(layout.block30)}>
                  {formatCurrency(report.salariesMinor)}
                </div>
              </div>
            )}

            {report.operatingProfitMinor !== undefined && (
              <div className={cx(layout.block31)}>
                <span className={cx(layout.block32)}>
                  🔒 Operating Profit (Admin)
                </span>
                <div className={cx(layout.block33)}>
                  {formatCurrency(report.operatingProfitMinor)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === "EXPENSES" && (
        <div className={cx(layout.block34)}>
          {expenses.map((exp) => (
            <div key={exp.id} className={cx(layout.block35)}>
              <div>
                <span className={cx(layout.block36)}>
                  {exp.category} · {exp.incurred_date}
                </span>
                <h4 className={cx(layout.block37)}>{exp.description}</h4>
                <p className={cx(["text-muted", layout.block38].join(" "))}>
                  Supplier: {exp.supplier_name || "Direct"} · Submitted by{" "}
                  {exp.submitter_name}
                </p>
              </div>

              <div className={cx(layout.block39)}>
                <span className={cx(layout.block40)}>
                  {formatCurrency(exp.amount_minor)}
                </span>
                <span
                  style={{
                    backgroundColor:
                      exp.status === "POSTED"
                        ? "var(--ui-success-bg)"
                        : exp.status === "APPROVED"
                          ? "#DBEAFE"
                          : "#FEF3C7",
                    color:
                      exp.status === "POSTED"
                        ? "#065F46"
                        : exp.status === "APPROVED"
                          ? "#1E40AF"
                          : "#92400E",
                  }}
                  className={cx(layout.block41)}
                >
                  {exp.status}
                </span>

                {exp.status === "SUBMITTED" && (
                  <button
                    onClick={() => handleApproveExpense(exp.id)}
                    className={cx(layout.block42)}
                  >
                    Approve (Manager)
                  </button>
                )}
                {exp.status === "APPROVED" && (
                  <PermissionGate roles={["ADMIN"]}>
                    <button
                      onClick={() => handlePostExpense(exp.id)}
                      className={cx(layout.block43)}
                    >
                      Post (Admin)
                    </button>
                  </PermissionGate>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consultant Obligations Tab */}
      {activeTab === "CONSULTANTS" && (
        <div className={cx(layout.block44)}>
          {consultantBills.map((cb) => (
            <div key={cb.id} className={cx(layout.block45)}>
              <div>
                <span className={cx(layout.block46)}>
                  {cb.discipline} · Ref: {cb.bill_reference}
                </span>
                <h4 className={cx(layout.block47)}>{cb.consultant_name}</h4>
                <p className={cx(["text-muted", layout.block48].join(" "))}>
                  Project: {cb.project_name} · Bill Date: {cb.bill_date}
                </p>
              </div>

              <div className={cx(layout.block49)}>
                <span className={cx(layout.block50)}>
                  {formatCurrency(cb.amount_minor)}
                </span>
                <span
                  style={{
                    backgroundColor:
                      cb.status === "POSTED"
                        ? "var(--ui-success-bg)"
                        : cb.status === "APPROVED"
                          ? "#DBEAFE"
                          : "#FEF3C7",
                    color:
                      cb.status === "POSTED"
                        ? "#065F46"
                        : cb.status === "APPROVED"
                          ? "#1E40AF"
                          : "#92400E",
                  }}
                  className={cx(layout.block51)}
                >
                  {cb.status}
                </span>

                {cb.status === "SUBMITTED" && (
                  <button
                    onClick={() => handleApproveConsultantBill(cb.id)}
                    className={cx(layout.block52)}
                  >
                    Approve (Manager)
                  </button>
                )}
                {cb.status === "APPROVED" && (
                  <PermissionGate roles={["ADMIN"]}>
                    <button
                      onClick={() => handlePostConsultantBill(cb.id)}
                      className={cx(layout.block53)}
                    >
                      Post (Admin)
                    </button>
                  </PermissionGate>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll Tab (ADMIN ONLY) */}
      {activeTab === "PAYROLL" && payrollRecords && (
        <div className={cx(layout.block54)}>
          <div className={cx(layout.block55)}>
            🔒 <strong>Strictly Confidential (Admin Only):</strong> Payroll
            allocations and individual salaries are protected by operational
            permissions and isolated from staff, consultants, and non-admin
            owners.
          </div>

          {payrollRecords.map((pr) => (
            <div key={pr.id} className={cx(layout.block56)}>
              <div>
                <span className={cx(layout.block57)}>
                  Period: {pr.period_month}
                </span>
                <h4 className={cx(layout.block58)}>{pr.employee_name}</h4>
                <p className={cx(["text-muted", layout.block59].join(" "))}>
                  Project Allocation: {pr.project_name || "Firm Overhead"}
                </p>
              </div>

              <div>
                <span className={cx(layout.block60)}>
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
