"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Button,
  Badge,
  Dialog,
  EmptyState,
  LoadingState,
  PageHeader,
  readResponse,
} from "@/components/ui";
import {
  parseSpreadsheetBytes,
  suggestLeadColumnMapping,
  WorkbookParseResult,
} from "@/shared/spreadsheet";
import { formatBusinessDate } from "@/shared/config";

interface LeadRow {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  requirements_text: string | null;
  lead_stage: string | null;
  next_followup_id: string | null;
  next_action_text: string | null;
  next_due_date: string | null;
  next_due_time: string | null;
  owner_name?: string | null;
  lost_reason?: string | null;
  linked_project_id?: string | null;
  created_at: number;
}

const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "DISCUSSION",
  "PROPOSAL",
  "ON_HOLD",
  "WON",
  "LOST",
] as const;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function LeadsWorkspace() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"LIST" | "BOARD">("LIST");
  const [filter, setFilter] = useState<
    "ALL" | "FOLLOWUPS_DUE" | "OVERDUE" | "NEEDS_ATTENTION"
  >("ALL");
  const [query, setQuery] = useState("");

  // Quick Lead Modal
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [requirement, setRequirement] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<string>("NEW");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [nextActionTime, setNextActionTime] = useState("");
  const [ambiguousNotes, setAmbiguousNotes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Follow-up Modal
  const [followupLead, setFollowupLead] = useState<LeadRow | null>(null);
  const [fuText, setFuText] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("");

  // Lost Reason Modal
  const [lostLead, setLostLead] = useState<LeadRow | null>(null);
  const [lostReason, setLostReason] = useState("");

  // Spreadsheet Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importFileBytes, setImportFileBytes] = useState(0);
  const [importFileSha256, setImportFileSha256] = useState("");
  const [parsedBook, setParsedBook] = useState<WorkbookParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewSummary, setPreviewSummary] = useState<any | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ filter });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/leads?${params.toString()}`);
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to load leads");
      setLeads(json.leads || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [filter]);

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          requirement,
          phone: phone || undefined,
          email: email || undefined,
          stage,
          nextAction: nextAction || undefined,
          nextActionDate: nextActionDate || undefined,
          nextActionTime: nextActionTime || undefined,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to save lead");
      setShowCreate(false);
      setName("");
      setRequirement("");
      setPhone("");
      setEmail("");
      setNextAction("");
      setNextActionDate("");
      setNextActionTime("");
      setAmbiguousNotes([]);
      setNotice("Lead saved.");
      await loadLeads();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStageChange(lead: LeadRow, nextStage: string) {
    if (nextStage === "LOST") {
      setLostLead(lead);
      setLostReason("");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          leadId: lead.id,
          stage: nextStage,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not update stage");
      await loadLeads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirmLost(e: React.FormEvent) {
    e.preventDefault();
    if (!lostLead) return;
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          leadId: lostLead.id,
          stage: "LOST",
          reason: lostReason,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not mark lead lost");
      setLostLead(null);
      await loadLeads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAddFollowup(e: React.FormEvent) {
    e.preventDefault();
    if (!followupLead) return;
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_followup",
          leadId: followupLead.id,
          actionText: fuText,
          dueDate: fuDate || undefined,
          dueTime: fuTime || undefined,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not save follow-up");
      setFollowupLead(null);
      setFuText("");
      setFuDate("");
      setFuTime("");
      await loadLeads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCompleteFollowup(followupId: string) {
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_followup", followupId }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Could not complete follow-up");
      await loadLeads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function buildMappedRows(book: WorkbookParseResult, colMap: Record<string, string>) {
    const sheet = book.sheets[0];
    if (!sheet) return [];
    const revMap: Record<string, string> = {};
    for (const [field, header] of Object.entries(colMap)) {
      if (header) revMap[field] = header;
    }
    return sheet.rows.map((r) => ({
      rowNumber: r.rowNumber,
      name: revMap.name ? r.cells[revMap.name]?.raw || "" : "",
      phone: revMap.phone ? r.cells[revMap.phone]?.raw || "" : "",
      email: revMap.email ? r.cells[revMap.email]?.raw || "" : "",
      requirement: revMap.requirement ? r.cells[revMap.requirement]?.raw || "" : "",
      stage: revMap.stage ? r.cells[revMap.stage]?.raw || "" : "",
      nextAction: revMap.nextAction ? r.cells[revMap.nextAction]?.raw || "" : "",
      dueDate: revMap.nextActionDate ? r.cells[revMap.nextActionDate]?.raw || "" : "",
      dueTime: revMap.nextActionTime ? r.cells[revMap.nextActionTime]?.raw || "" : "",
    }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPreviewSummary(null);
    setImportResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = await sha256Hex(bytes);
      const book = parseSpreadsheetBytes(file.name, bytes, 2000);
      const sheet = book.sheets[0];
      if (!sheet) throw new Error("No readable worksheet found in file.");
      const suggested = suggestLeadColumnMapping(sheet.headers);
      setImportFileName(file.name);
      setImportFileBytes(bytes.byteLength);
      setImportFileSha256(hash);
      setParsedBook(book);
      setMapping(suggested);
    } catch (err: any) {
      setError(err.message || "Could not parse spreadsheet.");
    }
  }

  async function handlePreviewImport() {
    if (!parsedBook) return;
    setImporting(true);
    setError("");
    try {
      const mapped = buildMappedRows(parsedBook, mapping);
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          rows: mapped,
          defaultRequirementNote: "Imported lead",
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Preview failed");
      const items: any[] = json.items || [];
      setPreviewSummary({
        newCount: items.filter((i) => i.decision === "CREATE").length,
        duplicateCount: items.filter((i) => i.decision === "POSSIBLE_DUPLICATE").length,
        invalidCount: items.filter((i) => i.decision === "REJECT" || i.decision === "SKIP").length,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!parsedBook) return;
    setImporting(true);
    setError("");
    try {
      const mapped = buildMappedRows(parsedBook, mapping);
      const batchId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const chunkSize = 50;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize);
        const res = await fetch("/api/leads/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            batchId,
            fileName: importFileName,
            fileSha256: importFileSha256,
            fileBytes: i === 0 ? importFileBytes : 0,
            mapping,
            rows: chunk,
            defaultRequirementNote: "Imported lead",
          }),
        });
        const json: any = await readResponse(res);
        if (!res.ok) throw new Error(json.error || "Import failed");
        totalInserted += json.created ?? 0;
        totalUpdated += json.updated ?? 0;
        totalSkipped += (json.skipped ?? 0) + (json.rejected ?? 0);
      }
      setImportResult({ batchId, insertedCount: totalInserted, updatedCount: totalUpdated, skippedCount: totalSkipped });
      await loadLeads();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleUndoImport() {
    if (!importResult?.batchId) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", batchId: importResult.batchId }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Undo failed");
      setImportResult(null);
      setPreviewSummary(null);
      setNotice(`Undid import batch (${json.reverted ?? 0} leads reverted, ${json.preservedConflicts ?? 0} modified leads preserved).`);
      await loadLeads();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        title="Leads"
        description="Fast lead capture, follow-ups, spreadsheet import, and enquiry progression."
        actions={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button type="button" onClick={() => setShowCreate(true)}>
              + Quick Lead
            </Button>
            <Button type="button" secondary onClick={() => setShowImport(true)}>
              Import Spreadsheet
            </Button>
            <a
              href="/api/leads?format=csv"
              className="btn-secondary"
              style={{ padding: "0.45rem 0.8rem", fontSize: "0.85rem" }}
            >
              Export CSV
            </a>
          </div>
        }
      />

      {error && (
        <div role="alert" className="card" style={{ borderColor: "var(--merveille-danger)", color: "var(--merveille-danger)" }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="card" style={{ borderColor: "var(--merveille-success)", color: "var(--merveille-success)" }}>
          {notice}
        </div>
      )}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {(
            [
              ["ALL", "All"],
              ["FOLLOWUPS_DUE", "Follow-ups due"],
              ["OVERDUE", "Overdue"],
              ["NEEDS_ATTENTION", "Needs attention"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={filter === key ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadLeads();
            }}
            style={{ display: "flex", gap: "0.35rem" }}
          >
            <input
              type="search"
              placeholder="Search leads…"
              aria-label="Search leads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
            />
            <button type="submit" className="btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }}>
              Search
            </button>
          </form>

          <div role="tablist" aria-label="Leads view mode" style={{ display: "flex", gap: "0.3rem" }}>
            {(["LIST", "BOARD"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={view === m}
                onClick={() => setView(m)}
                className={view === m ? "btn-primary" : "btn-secondary"}
                style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
              >
                {m === "LIST" ? "List" : "Board"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading leads…" />
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads match this view"
          description="Add a lead or import an Excel/CSV sheet."
        />
      ) : view === "LIST" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {leads.map((lead) => (
            <div key={lead.id} className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <div style={{ minWidth: "220px", flex: "1 1 300px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Link href={`/enquiries/${lead.id}`} style={{ fontWeight: 600 }}>
                    {lead.contact_name}
                  </Link>
                  <Badge>{lead.lead_stage || "NEW"}</Badge>
                </div>
                <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {lead.requirements_text || "No requirement note"}
                </p>
                <div className="text-muted" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                  {[lead.contact_phone, lead.contact_email, lead.owner_name ? `Owner: ${lead.owner_name}` : null]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
                {lead.next_action_text && (
                  <div style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
                    Next: <strong>{lead.next_action_text}</strong>
                    {lead.next_due_date ? ` (${formatBusinessDate(lead.next_due_date)}${lead.next_due_time ? ` ${lead.next_due_time}` : ""})` : ""}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                <select
                  aria-label={`Stage for ${lead.contact_name}`}
                  value={lead.lead_stage || "NEW"}
                  onChange={(e) => handleStageChange(lead, e.target.value)}
                  style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", background: "var(--merveille-surface)", color: "var(--merveille-ink)" }}
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                  onClick={() => setFollowupLead(lead)}
                >
                  Follow-up
                </button>
                {lead.next_followup_id && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                    onClick={() => handleCompleteFollowup(lead.next_followup_id!)}
                  >
                    Done
                  </button>
                )}
                <Link href={`/enquiries/${lead.id}`} className="btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}>
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" }}>
          {LEAD_STAGES.map((st) => {
            const colLeads = leads.filter((l) => (l.lead_stage || "NEW") === st);
            return (
              <div key={st} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                  <span>{st}</span>
                  <span className="text-muted">{colLeads.length}</span>
                </div>
                {colLeads.map((l) => (
                  <div key={l.id} style={{ padding: "0.55rem", borderRadius: "6px", border: "1px solid var(--merveille-border)", fontSize: "0.82rem" }}>
                    <Link href={`/enquiries/${l.id}`} style={{ fontWeight: 600 }}>
                      {l.contact_name}
                    </Link>
                    <div className="text-muted" style={{ fontSize: "0.76rem", marginTop: "0.2rem" }}>
                      {l.requirements_text || "—"}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Lead Modal */}
      {showCreate && (
        <Dialog title="Quick Lead" onClose={() => setShowCreate(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-muted" style={{ fontSize: "0.82rem" }}>
                Only Name & Requirement are required. Voice fills fields for review without auto-saving.
              </span>

            </div>

            {ambiguousNotes.length > 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--merveille-warning)" }}>
                Please verify: {ambiguousNotes.join(", ")}
              </div>
            )}

            <form onSubmit={handleCreateLead} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <input
                type="text"
                required
                placeholder="Client / Contact Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
              />
              <textarea
                required
                rows={3}
                placeholder="Requirement / Scope *"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <select
                  aria-label="Initial stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                >
                  {LEAD_STAGES.filter((s) => s !== "LOST").map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Next follow-up action"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <input
                  type="date"
                  aria-label="Follow-up date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                />
                <input
                  type="time"
                  aria-label="Follow-up time"
                  value={nextActionTime}
                  onChange={(e) => setNextActionTime(e.target.value)}
                  style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <Button type="button" secondary onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Lead"}
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Follow-up Modal */}
      {followupLead && (
        <Dialog title={`Follow-up: ${followupLead.contact_name}`} onClose={() => setFollowupLead(null)}>
          <form onSubmit={handleAddFollowup} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>

            </div>
            <input
              type="text"
              required
              placeholder="Next action (e.g. Call back with concept estimate)"
              value={fuText}
              onChange={(e) => setFuText(e.target.value)}
              style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <input
                type="date"
                aria-label="Due date"
                value={fuDate}
                onChange={(e) => setFuDate(e.target.value)}
                style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
              />
              <input
                type="time"
                aria-label="Due time"
                value={fuTime}
                onChange={(e) => setFuTime(e.target.value)}
                style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button type="button" secondary onClick={() => setFollowupLead(null)}>Cancel</Button>
              <Button type="submit">Save Follow-up</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Lost Reason Modal */}
      {lostLead && (
        <Dialog title={`Mark ${lostLead.contact_name} as Lost`} onClose={() => setLostLead(null)}>
          <form onSubmit={handleConfirmLost} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <input
              type="text"
              required
              placeholder="Reason for marking Lost *"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              style={{ padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button type="button" secondary onClick={() => setLostLead(null)}>Cancel</Button>
              <Button type="submit">Confirm Lost</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Spreadsheet Import Modal */}
      {showImport && (
        <Dialog title="Import Leads (.xlsx, .xls, .csv)" onClose={() => setShowImport(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />

            {parsedBook && parsedBook.sheets[0] && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className="text-muted" style={{ fontSize: "0.82rem" }}>
                  Parsed {parsedBook.sheets[0].rows.length} rows from <strong>{importFileName}</strong>. Verify column mapping:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                  {(["name", "phone", "email", "requirement", "stage", "nextAction", "nextActionDate"] as const).map((field) => (
                    <label key={field} style={{ fontSize: "0.78rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span>{field}</span>
                      <select
                        value={mapping[field] || ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                        style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid var(--merveille-border)" }}
                      >
                        <option value="">(Unmapped)</option>
                        {parsedBook.sheets[0].headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Button type="button" secondary onClick={handlePreviewImport} disabled={importing}>
                    Preview Import
                  </Button>
                  {previewSummary && !importResult && (
                    <Button type="button" onClick={handleConfirmImport} disabled={importing}>
                      {importing ? "Importing…" : `Confirm Import (${parsedBook.sheets[0].rows.length} rows)`}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {previewSummary && !importResult && (
              <div style={{ fontSize: "0.82rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--merveille-border)" }}>
                Preview: {previewSummary.newCount ?? 0} new, {previewSummary.duplicateCount ?? 0} duplicates/updates, {previewSummary.invalidCount ?? 0} invalid.
              </div>
            )}

            {importResult && (
              <div style={{ fontSize: "0.85rem", padding: "0.65rem", borderRadius: "6px", border: "1px solid var(--merveille-success)" }}>
                <div>
                  Imported: {importResult.insertedCount} added, {importResult.updatedCount} updated, {importResult.skippedCount} skipped.
                </div>
                <div style={{ marginTop: "0.45rem" }}>
                  <Button type="button" secondary onClick={handleUndoImport} disabled={importing}>
                    Undo Import Batch
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
