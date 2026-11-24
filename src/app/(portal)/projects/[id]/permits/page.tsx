"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ObservationFile {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  is_client_shared?: number;
}

interface PermitObservation {
  id: string;
  observed_status_text: string;
  decision_date?: string;
  last_checked_date: string;
  source_description: string;
  reference_url?: string;
  staff_notes?: string;
  sharing_status: string;
  recorded_by_name: string;
  shared_by_name?: string;
  shared_at?: number;
  created_at: number;
  files?: ObservationFile[];
}

interface PermitMilestone {
  milestoneId: string;
  milestoneType: "SANCTION" | "COMPLETION";
  applicationReference?: string;
  trackingLabel?: string;
  hasPublishedRecord?: boolean;
  statusText?: string;
  decisionDate?: string;
  lastCheckedDate?: string;
  recordedByName?: string;
  sourceDescription?: string;
  referenceUrl?: string;
  recordStatement?: string;
  disclaimer?: string;
  files?: ObservationFile[];
  observations?: PermitObservation[];
}

export default function PermitsPage() {
  const feedback = useFeedback();
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<PermitMilestone[]>([]);

  // Modal states
  const [showAddObsModal, setShowAddObsModal] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );

  // Form states
  const [statusText, setStatusText] = useState("");
  const [checkedDate, setCheckedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [decisionDate, setDecisionDate] = useState("");
  const [sourceDesc, setSourceDesc] = useState(
    "Staff manual check on K-SMART portal",
  );
  const [refUrl, setRefUrl] = useState("https://ksmart.kerala.gov.in");
  const [staffNotes, setStaffNotes] = useState("");

  const fetchPermits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`);
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to load permit records");
      }
      const data = (await readResponse(res)) as any;
      setMilestones(data.permits || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchPermits();
    }
  }, [projectId]);

  const handleRecordObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestoneId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_OBSERVATION",
          milestoneId: selectedMilestoneId,
          observedStatusText: statusText,
          lastCheckedDate: checkedDate,
          decisionDate: decisionDate || undefined,
          sourceDescription: sourceDesc,
          referenceUrl: refUrl || undefined,
          staffNotes: staffNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to record observation");
      }

      setShowAddObsModal(false);
      setSelectedMilestoneId(null);
      setStatusText("");
      setStaffNotes("");
      fetchPermits();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleSubmitForSharing = async (observationId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_SHARING", observationId }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to submit for sharing");
      }
      fetchPermits();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  const handleReviewSharing = async (
    observationId: string,
    decision: "APPROVE" | "RETURN",
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVIEW_SHARING",
          observationId,
          decision,
        }),
      });
      if (!res.ok) {
        const data = (await readResponse(res)) as any;
        throw new Error(data.error || "Failed to process sharing decision");
      }
      fetchPermits();
    } catch (err: any) {
      feedback.notify(err.message);
    }
  };

  if (loading) {
    return (
      <div className={cx(["portal-container", layout.block1].join(" "))}>
        <p className={cx("text-muted")}>Loading K-SMART permit records...</p>
      </div>
    );
  }

  return (
    <div className={cx(["portal-container", layout.block2].join(" "))}>
      {/* Header */}
      <div className={cx(layout.block3)}>
        <a
          href={`/projects/${projectId}/overview`}
          className={cx(layout.block4)}
        >
          ← Back to Project Overview
        </a>
        <h1 className={cx(["text-display", layout.block5].join(" "))}>
          K-SMART Permit Records
        </h1>
        <p className={cx(["text-muted", layout.block6].join(" "))}>
          Sanction and completion permit observations recorded manually by the
          architectural team.
        </p>
      </div>

      {/* Disclaimers & Truthful Boundary Statement */}
      <div className={cx(layout.block7)}>
        <p className={cx(layout.block8)}>
          ℹ️ <strong>Practice Tracking Boundary:</strong> Merveille Designs
          tracks observations manually from K-SMART submissions and documents.
          The portal does not query, scrape, or integrate with government
          servers, nor does it certify the legal validity of permits.
        </p>
      </div>

      {error && <div className={cx(layout.block9)}>{error}</div>}

      {/* Milestones Grid */}
      <div className={cx(layout.block10)}>
        {milestones.map((milestone) => {
          const isSanction = milestone.milestoneType === "SANCTION";
          const title = isSanction
            ? "Sanction Permit (Building Permit)"
            : "Completion Certificate & Occupancy";
          const isInternal = Boolean(milestone.observations);

          return (
            <div key={milestone.milestoneId} className={cx(layout.block11)}>
              <div className={cx(layout.block12)}>
                <div>
                  <span className={cx(layout.block13)}>Milestone Group</span>
                  <h2 className={cx(layout.block14)}>{title}</h2>
                  {milestone.applicationReference && (
                    <p className={cx(["text-muted", layout.block15].join(" "))}>
                      Application Ref:{" "}
                      <strong>{milestone.applicationReference}</strong>
                    </p>
                  )}
                </div>

                {isInternal && (
                  <ProjectMutation>
                    <button
                      onClick={() => {
                        setSelectedMilestoneId(milestone.milestoneId);
                        setShowAddObsModal(true);
                      }}
                      className={cx(["btn-primary", layout.block16].join(" "))}
                    >
                      + Record Status
                    </button>
                  </ProjectMutation>
                )}
              </div>

              {/* Client View (Published Observation) */}
              {!isInternal && (
                <div>
                  {milestone.hasPublishedRecord ? (
                    <div className={cx(layout.block17)}>
                      <div className={cx(layout.block18)}>
                        <span className={cx(layout.block19)}>
                          {milestone.statusText}
                        </span>
                        <span className={cx(layout.block20)}>
                          VERIFIED RECORD
                        </span>
                      </div>

                      <p className={cx(layout.block21)}>
                        {milestone.recordStatement}
                      </p>

                      {milestone.decisionDate && (
                        <p className={cx(layout.block22)}>
                          Order / Decision Date:{" "}
                          <strong>{milestone.decisionDate}</strong>
                        </p>
                      )}

                      {milestone.referenceUrl && (
                        <p className={cx(layout.block23)}>
                          <a
                            href={milestone.referenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cx(layout.block24)}
                          >
                            Open K-SMART Portal Reference ↗
                          </a>
                        </p>
                      )}

                      {/* Client shared files */}
                      {milestone.files && milestone.files.length > 0 && (
                        <div className={cx(layout.block25)}>
                          <p className={cx(layout.block26)}>
                            Approved Supporting Documents
                          </p>
                          <div className={cx(layout.block27)}>
                            {milestone.files.map((file) => (
                              <div key={file.id} className={cx(layout.block28)}>
                                📄 {file.file_name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className={cx(layout.block29)}>
                        {milestone.disclaimer}
                      </p>
                    </div>
                  ) : (
                    <div className={cx(layout.block30)}>
                      <p
                        className={cx(["text-muted", layout.block31].join(" "))}
                      >
                        No published permit observations recorded yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Timeline View */}
              {isInternal && milestone.observations && (
                <div className={cx(layout.block32)}>
                  <div className={cx(layout.block33)}>
                    Observation Timeline ({milestone.observations.length})
                  </div>

                  {milestone.observations.length === 0 ? (
                    <p className={cx(["text-muted", layout.block34].join(" "))}>
                      No observations recorded yet. Click &quot;Record
                      Status&quot; to log a check.
                    </p>
                  ) : (
                    milestone.observations.map((obs) => (
                      <div key={obs.id} className={cx(layout.block35)}>
                        <div className={cx(layout.block36)}>
                          <span className={cx(layout.block37)}>
                            {obs.observed_status_text}
                          </span>
                          <span
                            style={{
                              backgroundColor:
                                obs.sharing_status === "SHARED"
                                  ? "var(--ui-success-bg)"
                                  : obs.sharing_status ===
                                      "SUBMITTED_FOR_SHARING"
                                    ? "#FEF3C7"
                                    : "#F3F4F6",
                              color:
                                obs.sharing_status === "SHARED"
                                  ? "#065F46"
                                  : obs.sharing_status ===
                                      "SUBMITTED_FOR_SHARING"
                                    ? "#92400E"
                                    : "#374151",
                            }}
                            className={cx(layout.block38)}
                          >
                            {obs.sharing_status}
                          </span>
                        </div>

                        <p className={cx(layout.block39)}>
                          Checked: <strong>{obs.last_checked_date}</strong> ·
                          Recorded by {obs.recorded_by_name}
                        </p>

                        {obs.staff_notes && (
                          <div className={cx(layout.block40)}>
                            🔒 <em>Internal Note:</em> {obs.staff_notes}
                          </div>
                        )}

                        {obs.files && obs.files.length > 0 && (
                          <div className={cx(layout.block41)}>
                            {obs.files.map((f) => (
                              <span
                                key={f.id}
                                style={{
                                  backgroundColor: f.is_client_shared
                                    ? "#DBEAFE"
                                    : "#FEE2E2",
                                  color: f.is_client_shared
                                    ? "#1E40AF"
                                    : "#991B1B",
                                }}
                                className={cx(layout.block42)}
                              >
                                {f.is_client_shared
                                  ? "🌐 Client Shared"
                                  : "🔒 Internal Only"}
                                : {f.file_name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Manager sharing controls */}
                        <div className={cx(layout.block43)}>
                          {obs.sharing_status === "INTERNAL" && (
                            <ProjectMutation>
                              <button
                                onClick={() => handleSubmitForSharing(obs.id)}
                                className={cx(layout.block44)}
                              >
                                Submit for Client Sharing
                              </button>
                            </ProjectMutation>
                          )}
                          {obs.sharing_status === "SUBMITTED_FOR_SHARING" && (
                            <>
                              <ProjectMutation>
                                <button
                                  onClick={() =>
                                    handleReviewSharing(obs.id, "APPROVE")
                                  }
                                  className={cx(layout.block45)}
                                >
                                  Approve & Publish
                                </button>
                              </ProjectMutation>
                              <ProjectMutation>
                                <button
                                  onClick={() =>
                                    handleReviewSharing(obs.id, "RETURN")
                                  }
                                  className={cx(layout.block46)}
                                >
                                  Keep Internal
                                </button>
                              </ProjectMutation>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record Observation Modal */}
      {showAddObsModal && (
        <Dialog
          title="Record K-SMART Status Observation"
          onClose={() => setShowAddObsModal(false)}
        >
          <div className={cx(layout.block48)}>
            <h2 className={cx(layout.block49)}>
              Record K-SMART Status Observation
            </h2>
            <form onSubmit={handleRecordObservation}>
              <div className={cx(layout.block50)}>
                <label className={cx(layout.block51)} htmlFor="statusText">
                  Observed Status
                </label>
                <input
                  type="text"
                  required
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="e.g. Scrutiny in progress / Sanction Order Issued"
                  className={cx(layout.block52)}
                  id="statusText"
                />
              </div>

              <div className={cx(layout.block53)}>
                <div>
                  <label className={cx(layout.block54)} htmlFor="checkedDate">
                    Last Checked Date
                  </label>
                  <input
                    type="date"
                    required
                    value={checkedDate}
                    onChange={(e) => setCheckedDate(e.target.value)}
                    className={cx(layout.block55)}
                    id="checkedDate"
                  />
                </div>
                <div>
                  <label className={cx(layout.block56)} htmlFor="decisionDate">
                    Order / Decision Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={decisionDate}
                    onChange={(e) => setDecisionDate(e.target.value)}
                    className={cx(layout.block57)}
                    id="decisionDate"
                  />
                </div>
              </div>

              <div className={cx(layout.block58)}>
                <label className={cx(layout.block59)} htmlFor="sourceDesc">
                  Source Description
                </label>
                <input
                  type="text"
                  required
                  value={sourceDesc}
                  onChange={(e) => setSourceDesc(e.target.value)}
                  className={cx(layout.block60)}
                  id="sourceDesc"
                />
              </div>

              <div className={cx(layout.block61)}>
                <label className={cx(layout.block62)} htmlFor="refUrl">
                  Reference URL (Optional)
                </label>
                <input
                  type="url"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  className={cx(layout.block63)}
                  id="refUrl"
                />
              </div>

              <div className={cx(layout.block64)}>
                <label className={cx(layout.block65)}>
                  Internal Staff Notes (Private)
                </label>
                <textarea
                  rows={3}
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Private commentary for team members only..."
                  className={cx(layout.block66)}
                />
              </div>

              <div className={cx(layout.block67)}>
                <button
                  type="button"
                  onClick={() => setShowAddObsModal(false)}
                  className={cx(layout.block68)}
                >
                  Cancel
                </button>
                <button type="submit" className={cx(layout.block69)}>
                  Record Observation
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
