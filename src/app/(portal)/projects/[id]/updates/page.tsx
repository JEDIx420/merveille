"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

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
  attachments?: Array<{
    id: string;
    file_name: string;
    size_bytes: number;
    mime_type: string;
  }>;
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
  attachments?: Array<{
    id: string;
    file_name: string;
    size_bytes: number;
    mime_type: string;
  }>;
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
  const feedback = useFeedback();
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
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [reviewAction, setReviewAction] = useState<"PUBLISH" | "RETURN">(
    "PUBLISH",
  );
  const [reviewFeedback, setReviewFeedback] = useState("");

  // Form states
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updateDate, setUpdateDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteConfidential, setNoteConfidential] = useState(false);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`);
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to load updates");
      }
      const data = (await readResponse(res)) as any;
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
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to create update");
      }
      setShowAddUpdateModal(false);
      setUpdateTitle("");
      setUpdateBody("");
      fetchUpdates();
    } catch (err: any) {
      feedback.notify(err.message);
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
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to create internal note");
      }
      setShowAddNoteModal(false);
      setNoteTitle("");
      setNoteBody("");
      fetchUpdates();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleSubmitForReview = async (updateId: string, versionId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/updates/${updateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "SUBMIT_REVIEW", versionId }),
        },
      );
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to submit for review");
      }
      fetchUpdates();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleReviewSubmit = async (updateId: string) => {
    if (!selectedVersionId) return;
    try {
      const action = reviewAction;
      const res = await fetch(
        `/api/projects/${projectId}/updates/${updateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            versionId: selectedVersionId,
            feedback: reviewFeedback,
          }),
        },
      );
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to process review");
      }
      setShowReviewModal(false);
      setSelectedVersionId(null);
      setReviewFeedback("");
      fetchUpdates();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  if (loading) {
    return (
      <div className={cx(["portal-container", layout.block1].join(" "))}>
        <p className={cx("text-muted")}>Loading progress updates...</p>
      </div>
    );
  }

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
            Project Updates & Progress Feed
          </h1>
          <p className={cx(["text-muted", layout.block6].join(" "))}>
            Site milestones, design progress, and verified project observations.
          </p>
        </div>

        <div className={cx(layout.block7)}>
          <ProjectMutation>
            <button
              onClick={() => setShowAddUpdateModal(true)}
              className={cx(["btn-primary", layout.block8].join(" "))}
            >
              + Add Update
            </button>
          </ProjectMutation>
          {internalNotes !== undefined && (
            <ProjectMutation>
              <button
                onClick={() => setShowAddNoteModal(true)}
                className={cx(["btn-secondary", layout.block9].join(" "))}
              >
                + Private Note
              </button>
            </ProjectMutation>
          )}
        </div>
      </div>

      {error && <div className={cx(layout.block10)}>{error}</div>}

      {/* Tabs */}
      <div className={cx(layout.block11)}>
        <button
          onClick={() => setActiveTab("FEED")}
          style={{
            borderBottom:
              activeTab === "FEED"
                ? "2px solid var(--color-primary)"
                : "2px solid transparent",
            fontWeight: activeTab === "FEED" ? 600 : 400,
            color:
              activeTab === "FEED"
                ? "var(--color-primary)"
                : "var(--color-muted)",
          }}
          className={cx(layout.block12)}
        >
          Updates Feed
        </button>
        {internalNotes.length > 0 && (
          <button
            onClick={() => setActiveTab("INTERNAL_NOTES")}
            style={{
              borderBottom:
                activeTab === "INTERNAL_NOTES"
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              fontWeight: activeTab === "INTERNAL_NOTES" ? 600 : 400,
              color:
                activeTab === "INTERNAL_NOTES"
                  ? "var(--color-primary)"
                  : "var(--color-muted)",
            }}
            className={cx(layout.block13)}
          >
            Internal Notes ({internalNotes.length})
          </button>
        )}
      </div>

      {/* Feed Tab */}
      {activeTab === "FEED" && (
        <div>
          {updates.length === 0 ? (
            <div className={cx(layout.block14)}>
              <p className={cx(["text-muted", layout.block15].join(" "))}>
                No published updates yet.
              </p>
              <p className={cx(["text-muted", layout.block16].join(" "))}>
                Staff draft and manager review workflow ensures verified
                outward-facing updates.
              </p>
            </div>
          ) : (
            <div className={cx(layout.block17)}>
              {updates.map((item, idx) => {
                const isInternalFormat = Boolean(item.versions);
                const publishedTitle =
                  item.title || item.versions?.[0]?.title || "Update";
                const publishedBody =
                  item.body_text || item.versions?.[0]?.body_text || "";
                const publishedDate =
                  item.observed_date || item.versions?.[0]?.observed_date;
                const author = item.author_name || "Team Member";

                return (
                  <div
                    key={item.id || item.update_id || idx}
                    className={cx(layout.block18)}
                  >
                    <div className={cx(layout.block19)}>
                      <div>
                        <h3 className={cx(layout.block20)}>{publishedTitle}</h3>
                        <p
                          className={cx(
                            ["text-muted", layout.block21].join(" "),
                          )}
                        >
                          Observed on {publishedDate || "Recent"} · Posted by{" "}
                          {author}
                        </p>
                      </div>
                      {item.is_retracted === 1 && (
                        <span className={cx(layout.block22)}>RETRACTED</span>
                      )}
                    </div>

                    <p className={cx(layout.block23)}>{publishedBody}</p>

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div className={cx(layout.block24)}>
                        {item.attachments.map((att) => (
                          <div key={att.id} className={cx(layout.block25)}>
                            <span>📎 {att.file_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Internal version controls if present */}
                    {isInternalFormat && item.versions && (
                      <div className={cx(layout.block26)}>
                        <p className={cx(layout.block27)}>
                          Review & Version History (Internal Staff Only)
                        </p>
                        <div className={cx(layout.block28)}>
                          {item.versions.map((ver) => (
                            <div key={ver.id} className={cx(layout.block29)}>
                              <div>
                                <strong>V{ver.version_number}</strong> —{" "}
                                {ver.status}
                                {ver.review_feedback && (
                                  <span className={cx(layout.block30)}>
                                    (Feedback: {ver.review_feedback})
                                  </span>
                                )}
                              </div>
                              <div className={cx(layout.block31)}>
                                {ver.status === "DRAFT" && (
                                  <ProjectMutation>
                                    <button
                                      onClick={() =>
                                        handleSubmitForReview(item.id!, ver.id)
                                      }
                                      className={cx(layout.block32)}
                                    >
                                      Submit for Review
                                    </button>
                                  </ProjectMutation>
                                )}
                                {ver.status === "IN_REVIEW" && (
                                  <>
                                    <ProjectMutation>
                                      <button
                                        onClick={() => {
                                          setSelectedVersionId(ver.id);
                                          setReviewAction("PUBLISH");
                                          setShowReviewModal(true);
                                        }}
                                        className={cx(layout.block33)}
                                      >
                                        Publish to Client
                                      </button>
                                    </ProjectMutation>
                                    <ProjectMutation>
                                      <button
                                        onClick={() => {
                                          setSelectedVersionId(ver.id);
                                          setReviewAction("RETURN");
                                          setShowReviewModal(true);
                                        }}
                                        className={cx(layout.block34)}
                                      >
                                        Request Changes
                                      </button>
                                    </ProjectMutation>
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
        <div className={cx(layout.block35)}>
          <div className={cx(layout.block36)}>
            🔒 <strong>Strictly Private:</strong> Internal notes are accessible
            only to internal staff. Clients and consultants never see this area.
          </div>
          {internalNotes.map((note) => (
            <div key={note.id} className={cx(layout.block37)}>
              <div className={cx(layout.block38)}>
                <h4 className={cx(layout.block39)}>{note.title}</h4>
                {note.is_confidential === 1 && (
                  <span className={cx(layout.block40)}>CONFIDENTIAL</span>
                )}
              </div>
              <p className={cx(layout.block41)}>{note.body_text}</p>
              <p className={cx(["text-muted", layout.block42].join(" "))}>
                Recorded by {note.author_name} ·{" "}
                {new Date(note.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Update Modal */}
      {showAddUpdateModal && (
        <Dialog
          title="New Project Update"
          onClose={() => setShowAddUpdateModal(false)}
        >
          <div className={cx(layout.block44)}>
            <h2 className={cx(layout.block45)}>New Project Update</h2>
            <form onSubmit={handleCreateUpdate}>
              <div className={cx(layout.block46)}>
                <label className={cx(layout.block47)} htmlFor="updateTitle">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="e.g. First Floor Slab Concreting Complete"
                  className={cx(layout.block48)}
                  id="updateTitle"
                />
              </div>

              <div className={cx(layout.block49)}>
                <label className={cx(layout.block50)} htmlFor="updateDate">
                  Observation Date
                </label>
                <input
                  type="date"
                  required
                  value={updateDate}
                  onChange={(e) => setUpdateDate(e.target.value)}
                  className={cx(layout.block51)}
                  id="updateDate"
                />
              </div>

              <div className={cx(layout.block52)}>
                <label className={cx(layout.block53)}>Progress Details</label>
                <textarea
                  required
                  rows={4}
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Describe the milestone or site observation clearly..."
                  className={cx(layout.block54)}
                />
              </div>

              <p className={cx(layout.block55)}>
                Note: Updates start in DRAFT and require manager publication
                before appearing in the client feed.
              </p>

              <div className={cx(layout.block56)}>
                <button
                  type="button"
                  onClick={() => setShowAddUpdateModal(false)}
                  className={cx(layout.block57)}
                >
                  Cancel
                </button>
                <button type="submit" className={cx(layout.block58)}>
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Add Internal Note Modal */}
      {showAddNoteModal && (
        <Dialog
          title="New Private Internal Note"
          onClose={() => setShowAddNoteModal(false)}
        >
          <div className={cx(layout.block60)}>
            <h2 className={cx(layout.block61)}>New Private Internal Note</h2>
            <form onSubmit={handleCreateNote}>
              <div className={cx(layout.block62)}>
                <label className={cx(layout.block63)} htmlFor="noteTitle">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Contractor penalty discussion"
                  className={cx(layout.block64)}
                  id="noteTitle"
                />
              </div>

              <div className={cx(layout.block65)}>
                <label className={cx(layout.block66)}>Note Content</label>
                <textarea
                  required
                  rows={4}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Internal team discussion..."
                  className={cx(layout.block67)}
                />
              </div>

              <div className={cx(layout.block68)}>
                <input
                  type="checkbox"
                  id="confidential-check"
                  checked={noteConfidential}
                  onChange={(e) => setNoteConfidential(e.target.checked)}
                />
                <label
                  htmlFor="confidential-check"
                  className={cx(layout.block69)}
                >
                  Mark as confidential (finance / sensitive management)
                </label>
              </div>

              <div className={cx(layout.block70)}>
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(false)}
                  className={cx(layout.block71)}
                >
                  Cancel
                </button>
                <button type="submit" className={cx(layout.block72)}>
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <Dialog
          title="Review details"
          onClose={() => setShowReviewModal(false)}
        >
          <div className={cx(layout.block74)}>
            <h2 className={cx(layout.block75)}>
              {reviewAction === "PUBLISH"
                ? "Publish Update to Clients"
                : "Request Changes"}
            </h2>

            {reviewAction === "PUBLISH" ? (
              <p className={cx(layout.block76)}>
                Publishing will make this update visible in the client feed. The
                published snapshot is immutable and can only be modified via a
                reviewed revision.
              </p>
            ) : (
              <div className={cx(layout.block77)}>
                <label className={cx(layout.block78)}>
                  Reason / Feedback for Author
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Specify what corrections or clarifications are needed..."
                  className={cx(layout.block79)}
                />
              </div>
            )}

            <div className={cx(layout.block80)}>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className={cx(layout.block81)}
              >
                Cancel
              </button>
              <ProjectMutation>
                <button
                  type="button"
                  onClick={() => {
                    const targetUpdate = updates.find((u) =>
                      u.versions?.some((v) => v.id === selectedVersionId),
                    );
                    if (targetUpdate) {
                      handleReviewSubmit(targetUpdate.id!);
                    }
                  }}
                  style={{
                    backgroundColor:
                      reviewAction === "PUBLISH" ? "#059669" : "#DC2626",
                  }}
                  className={cx(layout.block82)}
                >
                  {reviewAction === "PUBLISH"
                    ? "Confirm & Publish"
                    : "Return to Author"}
                </button>
              </ProjectMutation>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
