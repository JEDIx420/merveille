"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatBusinessDate, formatRupees } from "@/shared/config";

interface ArchivedProjectSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  is_archived: number;
  archive_reason: string | null;
  archived_at: number | null;
  drawing_count: number;
  unpaid_invoices_count: number;
  total_unpaid_minor: number;
}

interface ArchivedDrawing {
  drawing_id: string;
  drawing_number: string;
  drawing_title: string;
  discipline: string;
  version_id: string;
  version_label: string;
  version_status: string;
  released_at: number;
  file_id: string;
  file_name: string;
  size_bytes: number;
  is_current_release: number;
}

interface ArchivedUpdate {
  update_id: string;
  version_id: string;
  title: string;
  body_text: string;
  observed_date: string | null;
  published_at: number;
}

interface ArchivedInvoice {
  id: string;
  invoice_number: string;
  total_minor: number;
  allocated_minor: number;
  outstanding_minor: number;
  due_date: string;
  status: string;
  settlement_status: string;
}

export default function ArchivePage() {
  const [projects, setProjects] = useState<ArchivedProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectData, setSelectedProjectData] = useState<{
    project: any;
    releasedDrawings: ArchivedDrawing[];
    publishedUpdates: ArchivedUpdate[];
    unpaidInvoices: ArchivedInvoice[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Settlement modal state (ADMIN only)
  const [settleInvoice, setSettleInvoice] = useState<ArchivedInvoice | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");

  // Reopen modal state (MANAGER/OWNER only)
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState("");

  // Export state (ADMIN/OWNER only)
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);

  useEffect(() => {
    loadArchivedProjects();
  }, []);

  async function loadArchivedProjects() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/archive");
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load archived projects");
      setProjects(json.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setLoadingDetails(true);
    setSelectedProjectData(null);
    setExportResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/archive`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load archived project records");
      setSelectedProjectData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSettleInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!settleInvoice || !selectedProjectId) return;
    setSettling(true);
    setSettleError("");

    const amountPaise = Math.round(parseFloat(settleAmount) * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      setSettleError("Please enter a valid positive amount.");
      setSettling(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settle",
          invoiceId: settleInvoice.id,
          amountMinor: amountPaise,
          notes: settleNotes,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to settle archived invoice");

      setSettleInvoice(null);
      setSettleAmount("");
      setSettleNotes("");
      await selectProject(selectedProjectId);
      await loadArchivedProjects();
    } catch (err: any) {
      setSettleError(err.message);
    } finally {
      setSettling(false);
    }
  }

  async function handleReopenProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setReopening(true);
    setReopenError("");

    if (!reopenReason.trim()) {
      setReopenError("A formal reopen reason is required.");
      setReopening(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reopen",
          reason: reopenReason.trim(),
        }),
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reopen project");

      setShowReopenModal(false);
      setReopenReason("");
      setSelectedProjectId(null);
      setSelectedProjectData(null);
      await loadArchivedProjects();
    } catch (err: any) {
      setReopenError(err.message);
    } finally {
      setReopening(false);
    }
  }

  async function handleExportBackup() {
    if (!selectedProjectId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/export`, {
        method: "POST",
      });
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to export project backup");
      setExportResult(json);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const filteredProjects = projects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.archive_reason && p.archive_reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-serif font-bold text-foreground tracking-tight">
          Archived Projects
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Move completed projects out of day-to-day work while retaining their records for long-term access.
          Authorized clients, representatives, and consultants retain access to permitted released drawings and updates.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Main Grid: Projects List + Project Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Projects Directory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search code, name, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading archive registry...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-lg">
              <p className="text-sm font-medium text-foreground">No archived projects found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed projects moved to the archive will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p.id)}
                    className={`cursor-pointer p-4 rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {p.code}
                        </span>
                        <h3 className="mt-1 text-sm font-semibold text-foreground">
                          {p.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        Archived
                      </span>
                    </div>

                    {p.archive_reason && (
                      <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">
                        “{p.archive_reason}”
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.drawing_count} released drawings</span>
                      {p.unpaid_invoices_count > 0 ? (
                        <span className="text-destructive font-medium">
                          {formatRupees(p.total_unpaid_minor)} due
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">All settled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Historical Detail View */}
        <div className="lg:col-span-7">
          {!selectedProjectId ? (
            <div className="p-12 text-center border border-dashed border-border rounded-lg h-full flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-foreground">Select an archived project</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                View released drawing registers, published client updates, and historical payment obligations.
              </p>
            </div>
          ) : loadingDetails ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Retrieving historical records...
            </div>
          ) : selectedProjectData ? (
            <div className="space-y-6">
              {/* Banner: Archived — view and download */}
              <div className="p-4 bg-muted/60 border border-border rounded-lg flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 bg-background border border-border rounded font-medium">
                      {selectedProjectData.project.code}
                    </span>
                    <h2 className="text-lg font-serif font-bold text-foreground">
                      {selectedProjectData.project.name}
                    </h2>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Archived — view and download</span>
                    <span className="mx-2">•</span>
                    Operational changes, task edits, and new invoice drafts are disabled.
                  </div>
                  {selectedProjectData.project.archiveReason && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      Reason: {selectedProjectData.project.archiveReason}
                    </p>
                  )}
                </div>

                {/* Internal Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportBackup}
                    disabled={exporting}
                    className="text-xs px-2.5 py-1.5 border border-border bg-background hover:bg-muted text-foreground rounded font-medium disabled:opacity-50"
                  >
                    {exporting ? "Exporting..." : "DR Backup"}
                  </button>
                  <button
                    onClick={() => setShowReopenModal(true)}
                    className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded font-medium"
                  >
                    Reopen Project
                  </button>
                </div>
              </div>

              {exportResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                  <p className="font-semibold">Disaster Recovery Backup Exported</p>
                  <p className="mt-0.5">Key: <code className="font-mono">{exportResult.backupKey}</code></p>
                  <p className="mt-0.5 font-mono">SHA-256: {exportResult.manifestSha256}</p>
                </div>
              )}

              {/* Unpaid Financial Obligations */}
              {selectedProjectData.unpaidInvoices.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Outstanding Financial Obligations
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Archiving does not forgive unpaid balances. Existing invoices remain legally payable.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border/40">
                    {selectedProjectData.unpaidInvoices.map((inv) => (
                      <div key={inv.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            Invoice #{inv.invoice_number || inv.id}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Due {inv.due_date} • Outstanding: {formatRupees(inv.outstanding_minor)}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSettleInvoice(inv);
                            setSettleAmount((inv.outstanding_minor / 100).toFixed(2));
                          }}
                          className="text-xs px-2.5 py-1 bg-background border border-input hover:bg-muted text-foreground rounded font-medium shadow-xs"
                        >
                          Settle Balance
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Released Drawings Section */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Released Drawing Register
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedProjectData.releasedDrawings.length} releases preserved
                  </span>
                </div>

                {selectedProjectData.releasedDrawings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No released drawings recorded on this project.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedProjectData.releasedDrawings.map((d) => (
                      <div key={d.version_id} className="p-3.5 flex items-center justify-between hover:bg-muted/20">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-foreground">
                              {d.drawing_number}
                            </span>
                            <span className="text-xs text-foreground font-medium">
                              {d.drawing_title}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded">
                              {d.version_label}
                            </span>
                            {d.is_current_release ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                                Current Release
                              </span>
                            ) : (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                Superseded Release
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {d.discipline} • Released {d.released_at ? formatBusinessDate(d.released_at) : "N/A"} • {(d.size_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        {d.file_id && (
                          <a
                            href={`/api/files/${d.file_id}`}
                            download
                            className="text-xs px-2.5 py-1 bg-background border border-input hover:bg-muted text-foreground rounded font-medium shadow-xs"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Published Updates Section */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Published Client Updates
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedProjectData.publishedUpdates.length} updates published
                  </span>
                </div>

                {selectedProjectData.publishedUpdates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No client updates were published for this project.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedProjectData.publishedUpdates.map((u) => (
                      <div key={u.version_id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">{u.title}</h4>
                          <span className="text-[11px] text-muted-foreground">
                            {formatBusinessDate(u.published_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {u.body_text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Settle Balance Modal (ADMIN only) */}
      {settleInvoice && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-lg rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-serif font-bold text-foreground">
              Settle Archived Obligation
            </h3>
            <p className="text-xs text-muted-foreground">
              ADMIN-only exception: Record a settlement against Invoice #{settleInvoice.invoice_number || settleInvoice.id} without reopening project construction operations.
            </p>

            {settleError && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20">
                {settleError}
              </div>
            )}

            <form onSubmit={handleSettleInvoice} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Settlement Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Outstanding balance: {formatRupees(settleInvoice.outstanding_minor)}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Settlement Reference / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank transfer reference, final settlement"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettleInvoice(null)}
                  className="px-3 py-1.5 text-xs border border-border bg-background hover:bg-muted text-foreground rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded font-medium disabled:opacity-50"
                >
                  {settling ? "Recording..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Project Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-lg rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-serif font-bold text-foreground">
              Reopen Archived Project
            </h3>
            <p className="text-xs text-muted-foreground">
              Reopening moves the project back to ACTIVE status. A formal reason is mandatory and active manager and client assignments will be rechecked.
            </p>

            {reopenError && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20">
                {reopenError}
              </div>
            )}

            <form onSubmit={handleReopenProject} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Reopen Justification / Reason *
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this project is being returned to active operations..."
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-3 py-1.5 text-xs border border-border bg-background hover:bg-muted text-foreground rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded font-medium disabled:opacity-50"
                >
                  {reopening ? "Reopening..." : "Reopen to Active"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
