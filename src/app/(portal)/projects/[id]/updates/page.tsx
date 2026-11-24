"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface UpdateVersion {
  id: string;
  version_number: number;
  title: string;
  body_text: string;
  observed_date?: string;
  status: string;
  review_feedback?: string;
  published_at?: number;
  published_by_name?: string;
  attachments?: Array<{ id: string; file_name: string; size_bytes: number; mime_type: string }>;
}

interface ProjectUpdate {
  id?: string;
  update_id?: string;
  title?: string;
  body_text?: string;
  observed_date?: string;
  published_at?: number;
  author_name?: string;
  is_retracted?: number;
  current_published_version_id?: string;
  versions?: UpdateVersion[];
  attachments?: Array<{ id: string; file_name: string; size_bytes: number; mime_type: string }>;
}

interface InternalNote {
  id: string;
  title: string;
  body_text: string;
  author_name: string;
  is_confidential: number;
  created_at: number;
  attachment_file_name?: string;
}

export default function UpdatesPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [activeTab, setActiveTab] = useState<"FEED" | "INTERNAL_NOTES">("FEED");

  // Modal states
  const [showAddUpdateModal, setShowAddUpdateModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"PUBLISH" | "RETURN">("PUBLISH");
  const [reviewFeedback, setReviewFeedback] = useState("");

  // Form states
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteConfidential, setNoteConfidential] = useState(false);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`);
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to load updates");
      }
      const data = await res.json() as any;
      setUpdates(data.updates || []);
      setInternalNotes(data.internalNotes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchUpdates();
    }
  }, [projectId]);

  const handleCreateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updateTitle,
          bodyText: updateBody,
          observedDate: updateDate,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to create update");
      }
      setShowAddUpdateModal(false);
      setUpdateTitle("");
      setUpdateBody("");
      fetchUpdates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INTERNAL_NOTE",
          title: noteTitle,
          bodyText: noteBody,
          isConfidential: noteConfidential,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to create internal note");
      }
      setShowAddNoteModal(false);
      setNoteTitle("");
      setNoteBody("");
      fetchUpdates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitForReview = async (updateId: string, versionId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/updates/${updateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_REVIEW", versionId }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to submit for review");
      }
      fetchUpdates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReviewSubmit = async (updateId: string) => {
    if (!selectedVersionId) return;
    try {
      const action = reviewAction;
      const res = await fetch(`/api/projects/${projectId}/updates/${updateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          versionId: selectedVersionId,
          feedback: reviewFeedback,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || "Failed to process review");
      }
      setShowReviewModal(false);
      setSelectedVersionId(null);
      setReviewFeedback("");
      fetchUpdates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="portal-container" style={{ padding: "2rem" }}>
        <p className="text-muted">Loading progress updates...</p>
      </div>
    );
  }

  return (
    <div className="portal-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <a href={`/projects/${projectId}/overview`} style={{ color: "var(--color-primary)", textDecoration: "none", fontSize: "0.875rem", marginBottom: "0.5rem", display: "inline-block" }}>
            ← Back to Project Overview
          </a>
          <h1 className="text-display" style={{ fontSize: "1.75rem", fontWeight: 600 }}>Project Updates & Progress Feed</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Site milestones, design progress, and verified project observations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setShowAddUpdateModal(true)}
            className="btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            + Add Update
          </button>
          {internalNotes !== undefined && (
            <button
              onClick={() => setShowAddNoteModal(true)}
              className="btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
            >
              + Private Note
            </button>
          )}
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
          onClick={() => setActiveTab("FEED")}
          style={{
            padding: "0.75rem 1rem",
            background: "none",
            border: "none",
            borderBottom: activeTab === "FEED" ? "2px solid var(--color-primary)" : "2px solid transparent",
            fontWeight: activeTab === "FEED" ? 600 : 400,
            color: activeTab === "FEED" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Updates Feed
        </button>
        {internalNotes.length > 0 && (
          <button
            onClick={() => setActiveTab("INTERNAL_NOTES")}
            style={{
              padding: "0.75rem 1rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "INTERNAL_NOTES" ? "2px solid var(--color-primary)" : "2px solid transparent",
              fontWeight: activeTab === "INTERNAL_NOTES" ? 600 : 400,
              color: activeTab === "INTERNAL_NOTES" ? "var(--color-primary)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            Internal Notes ({internalNotes.length})
          </button>
        )}
      </div>

      {/* Feed Tab */}
      {activeTab === "FEED" && (
        <div>
          {updates.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", backgroundColor: "var(--color-surface)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <p className="text-muted" style={{ fontSize: "1rem" }}>No published updates yet.</p>
              <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                Staff draft and manager review workflow ensures verified outward-facing updates.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {updates.map((item, idx) => {
                const isInternalFormat = Boolean(item.versions);
                const publishedTitle = item.title || item.versions?.[0]?.title || "Update";
                const publishedBody = item.body_text || item.versions?.[0]?.body_text || "";
                const publishedDate = item.observed_date || item.versions?.[0]?.observed_date;
                const author = item.author_name || "Team Member";

                return (
                  <div
                    key={item.id || item.update_id || idx}
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <div>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{publishedTitle}</h3>
                        <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                          Observed on {publishedDate || "Recent"} · Posted by {author}
                        </p>
                      </div>
                      {item.is_retracted === 1 && (
                        <span style={{ padding: "0.25rem 0.5rem", backgroundColor: "#FEE2E2", color: "#991B1B", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
                          RETRACTED
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--color-text)", whiteSpace: "pre-line", margin: "0.75rem 0" }}>
                      {publishedBody}
                    </p>

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
                        {item.attachments.map((att) => (
                          <div
                            key={att.id}
                            style={{
                              padding: "0.5rem 0.75rem",
                              backgroundColor: "#F3F4F6",
                              borderRadius: "4px",
                              fontSize: "0.8125rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <span>📎 {att.file_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Internal version controls if present */}
                    {isInternalFormat && item.versions && (
                      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px dashed var(--color-border)" }}>
                        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                          Review & Version History (Internal Staff Only)
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {item.versions.map((ver) => (
                            <div
                              key={ver.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                backgroundColor: "#FAFAFA",
                                borderRadius: "4px",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <div>
                                <strong>V{ver.version_number}</strong> — {ver.status}
                                {ver.review_feedback && (
                                  <span style={{ color: "#DC2626", marginLeft: "0.5rem" }}>
                                    (Feedback: {ver.review_feedback})
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                {ver.status === "DRAFT" && (
                                  <button
                                    onClick={() => handleSubmitForReview(item.id!, ver.id)}
                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}
                                  >
                                    Submit for Review
                                  </button>
                                )}
                                {ver.status === "IN_REVIEW" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedVersionId(ver.id);
                                        setReviewAction("PUBLISH");
                                        setShowReviewModal(true);
                                      }}
                                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", backgroundColor: "#059669", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                    >
                                      Publish to Client
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedVersionId(ver.id);
                                        setReviewAction("RETURN");
                                        setShowReviewModal(true);
                                      }}
                                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", backgroundColor: "#DC2626", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                                    >
                                      Request Changes
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Internal Notes Tab */}
      {activeTab === "INTERNAL_NOTES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ padding: "0.75rem 1rem", backgroundColor: "#FEF3C7", borderRadius: "6px", color: "#92400E", fontSize: "0.8125rem" }}>
            🔒 <strong>Strictly Private:</strong> Internal notes are accessible only to internal staff. Clients and consultants never see this area.
          </div>
          {internalNotes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: "1.25rem",
                backgroundColor: "var(--color-surface)",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontWeight: 600 }}>{note.title}</h4>
                {note.is_confidential === 1 && (
                  <span style={{ fontSize: "0.75rem", backgroundColor: "#F3E8FF", color: "#6B21A8", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>
                    CONFIDENTIAL
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.5, margin: "0.5rem 0" }}>{note.body_text}</p>
              <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
                Recorded by {note.author_name} · {new Date(note.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Update Modal */}
      {showAddUpdateModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "550px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>New Project Update</h2>
            <form onSubmit={handleCreateUpdate}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Title</label>
                <input
                  type="text"
                  required
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. First Floor Slab Concreting Complete"
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Observation Date</label>
                <input
                  type="date"
                  required
                  value={updateDate}
                  onChange={(e) => setUpdateDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Progress Details</label>
                <textarea
                  required
                  rows={4}
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="Describe the milestone or site observation clearly..."
                />
              </div>

              <p style={{ fontSize: "0.75rem", color: "#6B7280", marginBottom: "1.5rem" }}>
                Note: Updates start in DRAFT and require manager publication before appearing in the client feed.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAddUpdateModal(false)}
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

      {/* Add Internal Note Modal */}
      {showAddNoteModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "550px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>New Private Internal Note</h2>
            <form onSubmit={handleCreateNote}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Title</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="e.g. Contractor penalty discussion"
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Note Content</label>
                <textarea
                  required
                  rows={4}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="Internal team discussion..."
                />
              </div>

              <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="confidential-check"
                  checked={noteConfidential}
                  onChange={(e) => setNoteConfidential(e.target.checked)}
                />
                <label htmlFor="confidential-check" style={{ fontSize: "0.875rem" }}>
                  Mark as confidential (finance / sensitive management)
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(false)}
                  style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "0.5rem 1rem", backgroundColor: "var(--color-primary)", color: "#FFF", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFF", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: "500px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
              {reviewAction === "PUBLISH" ? "Publish Update to Clients" : "Request Changes"}
            </h2>

            {reviewAction === "PUBLISH" ? (
              <p style={{ fontSize: "0.875rem", color: "#4B5563", marginBottom: "1.5rem" }}>
                Publishing will make this update visible in the client feed. The published snapshot is immutable and can only be modified via a reviewed revision.
              </p>
            ) : (
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                  Reason / Feedback for Author
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "4px" }}
                  placeholder="Specify what corrections or clarifications are needed..."
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{ padding: "0.5rem 1rem", border: "1px solid #D1D5DB", background: "#FFF", borderRadius: "4px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUpdate = updates.find((u) => u.versions?.some((v) => v.id === selectedVersionId));
                  if (targetUpdate) {
                    handleReviewSubmit(targetUpdate.id!);
                  }
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: reviewAction === "PUBLISH" ? "#059669" : "#DC2626",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {reviewAction === "PUBLISH" ? "Confirm & Publish" : "Return to Author"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
