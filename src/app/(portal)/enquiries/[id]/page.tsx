"use client";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import layout from "./page.module.css";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface Enquiry {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  site_location: string;
  requirements_text: string | null;
  status:
    | "OPEN"
    | "FEASIBILITY_REVIEW"
    | "QUOTE_PREPARATION"
    | "ON_HOLD"
    | "LOST"
    | "DECLINED"
    | "CONVERTED";
  decline_reason: string | null;
  linked_project_id: string | null;
  created_at: number;
}

interface FeasibilityStudy {
  id: string;
  observations: string;
  site_constraints: string | null;
  recommendations: string;
  created_at: number;
}

export default function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: enquiryId } = use(params);
  const { principal } = useSession();
  const [data, setData] = useState<{
    enquiry: Enquiry;
    studies: FeasibilityStudy[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Feasibility Form
  const [showFeasibilityForm, setShowFeasibilityForm] = useState(false);
  const [observations, setObservations] = useState("");
  const [siteConstraints, setSiteConstraints] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // Close Modal (Lost/Declined)
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"LOST" | "DECLINED">("LOST");
  const [closeReason, setCloseReason] = useState("");

  // Convert Modal
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [mainClientUserId, setMainClientUserId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEnquiry();
    if (hasCapability(principal, "ADMIN")) loadUsers();
  }, [enquiryId]);

  async function loadEnquiry() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`);
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to load enquiry");
      setData(json);
      if (json.enquiry) {
        setProjectName(`${json.enquiry.contact_name} Residence`);
        setProjectCode(
          `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/people");
      const json: any = await readResponse(res);
      if (res.ok) {
        setUsersList(json.people || []);
      }
    } catch (e: any) {
      setError(e.message || "Unable to load people. Try again.");
    }
  }

  async function handleFeasibilitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_FEASIBILITY",
          observations,
          siteConstraints,
          recommendations,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to record study");
      setActionSuccess("Feasibility assessment successfully recorded.");
      setShowFeasibilityForm(false);
      setObservations("");
      setSiteConstraints("");
      setRecommendations("");
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          status: closeStatus,
          reason: closeReason,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to close enquiry");
      setActionSuccess(`Enquiry successfully marked as ${closeStatus}.`);
      setShowCloseModal(false);
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConvertSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONVERT",
          projectCode,
          projectName,
          mainClientUserId,
          managerUserId,
        }),
      });
      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to convert enquiry");
      setActionSuccess(
        "Enquiry converted into a draft project with baseline stages.",
      );
      setShowConvertModal(false);
      loadEnquiry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={cx(["card text-muted", layout.block1].join(" "))}>
        Loading enquiry details...
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className={cx(["card", layout.block2].join(" "))}>
        <h2 className={cx(layout.block3)}>Enquiry Not Found</h2>
        <p className={cx("text-muted")}>
          {error || "Could not retrieve enquiry."}
        </p>
        <a
          href="/enquiries"
          className={cx(["btn-secondary", layout.block4].join(" "))}
        >
          Back to Enquiries
        </a>
      </div>
    );
  }

  const enq = data.enquiry;
  const isClosed = enq.status === "LOST" || enq.status === "DECLINED";
  const isConverted = enq.status === "CONVERTED";

  return (
    <div className={cx(layout.block5)}>
      {/* Breadcrumb */}
      <nav className={cx(layout.block6)}>
        <a href="/enquiries" className={cx(layout.block7)}>
          Enquiries
        </a>
        <span>/</span>
        <span className={cx(layout.block8)}>{enq.contact_name}</span>
      </nav>

      {/* Header */}
      <header className={cx(layout.block9)}>
        <div>
          <div className={cx(layout.block10)}>
            <span
              className={cx(
                `badge badge-${
                  isConverted ? "active" : isClosed ? "paused" : "draft"
                }`,
              )}
            >
              {enq.status}
            </span>
            <span className={cx(layout.block11)}>
              Received {formatBusinessDate(enq.created_at)}
            </span>
          </div>
          <h1 className={cx("text-display")}>{enq.contact_name}</h1>
          <p className={cx(["text-muted", layout.block12].join(" "))}>
            {enq.site_location}
          </p>
        </div>

        {/* Action Controls */}
        <div className={cx(layout.block13)}>
          {!isConverted && !isClosed && (
            <>
              <button
                onClick={() => setShowCloseModal(true)}
                className={cx("btn-secondary")}
              >
                Close as Lost/Declined
              </button>
              {hasCapability(principal, "ADMIN") ? (
                <button
                  onClick={() => setShowConvertModal(true)}
                  className={cx("btn-primary")}
                >
                  Convert to project
                </button>
              ) : (
                <p className="muted">
                  An administrator can create the project and assign its
                  contacts.
                </p>
              )}
            </>
          )}

          {isConverted && enq.linked_project_id && (
            <a
              href={`/projects/${enq.linked_project_id}/overview`}
              className={cx("btn-primary")}
            >
              Open Converted Project →
            </a>
          )}
        </div>
      </header>

      {/* Alerts */}
      {actionSuccess && (
        <div className={cx(layout.block14)}>{actionSuccess}</div>
      )}

      {/* Closed Reason Banner */}
      {isClosed && (
        <div className={cx(["card", layout.block15].join(" "))}>
          <strong className={cx(layout.block16)}>
            Enquiry Closed ({enq.status})
          </strong>
          <p className={cx(layout.block17)}>
            Reason: {enq.decline_reason || "No decline reason recorded."}
          </p>
          <p className={cx(layout.block18)}>Per</p>
        </div>
      )}

      {/* Brief & Contact Details Card */}
      <div className={cx("card")}>
        <h2 className={cx(layout.block19)}>Prospect & Brief Details</h2>
        <div className={cx(layout.block20)}>
          <div>
            <div className={cx(["text-muted", layout.block21].join(" "))}>
              Contact Name
            </div>
            <div className={cx(layout.block22)}>{enq.contact_name}</div>
          </div>
          <div>
            <div className={cx(["text-muted", layout.block23].join(" "))}>
              Email
            </div>
            <div className={cx(layout.block24)}>{enq.contact_email}</div>
          </div>
          <div>
            <div className={cx(["text-muted", layout.block25].join(" "))}>
              Phone
            </div>
            <div className={cx(layout.block26)}>
              {enq.contact_phone || "Not recorded"}
            </div>
          </div>
          <div>
            <div className={cx(["text-muted", layout.block27].join(" "))}>
              Location
            </div>
            <div className={cx(layout.block28)}>{enq.site_location}</div>
          </div>
        </div>

        <div className={cx(layout.block29)}>
          <div className={cx(["text-muted", layout.block30].join(" "))}>
            Spatial Requirements & Brief
          </div>
          <div className={cx(layout.block31)}>
            {enq.requirements_text || "No preliminary requirements recorded."}
          </div>
        </div>
      </div>

      {/* Feasibility Studies */}
      <div className={cx("card")}>
        <div className={cx(layout.block32)}>
          <div>
            <h2 className={cx(layout.block33)}>Site Feasibility Studies</h2>
            <p className={cx(["text-muted", layout.block34].join(" "))}>
              Site topography, municipal zoning, road access, and architectural
              recommendations.
            </p>
          </div>
          {!isClosed && !showFeasibilityForm && (
            <button
              onClick={() => setShowFeasibilityForm(true)}
              className={cx("btn-secondary")}
            >
              + Record Study
            </button>
          )}
        </div>

        {/* Feasibility study creation form */}
        {showFeasibilityForm && (
          <form
            onSubmit={handleFeasibilitySubmit}
            className={cx(layout.block35)}
          >
            <h3 className={cx(layout.block36)}>New Feasibility Assessment</h3>
            <div>
              <label className={cx(layout.block37)}>Site Observations *</label>
              <textarea
                required
                rows={3}
                placeholder="Topography, existing vegetation, road width, neighbouring structures..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className={cx(layout.block38)}
              />
            </div>

            <div>
              <label className={cx(layout.block39)}>
                Site & Regulatory Constraints
              </label>
              <textarea
                rows={2}
                placeholder="Frontage setbacks, K-SMART FAR limitations, CRZ / environmental buffers..."
                value={siteConstraints}
                onChange={(e) => setSiteConstraints(e.target.value)}
                className={cx(layout.block40)}
              />
            </div>

            <div>
              <label className={cx(layout.block41)}>
                Design Recommendations *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Recommended footprint, massing orientation, structural approach..."
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                className={cx(layout.block42)}
              />
            </div>

            <div className={cx(layout.block43)}>
              <button
                type="button"
                onClick={() => setShowFeasibilityForm(false)}
                className={cx("btn-secondary")}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cx("btn-primary")}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Feasibility Study"}
              </button>
            </div>
          </form>
        )}

        {/* Existing studies list */}
        {data.studies.length === 0 ? (
          <p className={cx(["text-muted", layout.block44].join(" "))}>
            No feasibility assessments recorded yet.
          </p>
        ) : (
          <div className={cx(layout.block45)}>
            {data.studies.map((s) => (
              <div key={s.id} className={cx(layout.block46)}>
                <div className={cx(layout.block47)}>
                  <span className={cx(layout.block48)}>
                    Feasibility Assessment
                  </span>
                  <span className={cx(layout.block49)}>
                    {formatBusinessDate(s.created_at)}
                  </span>
                </div>
                <div className={cx(layout.block50)}>
                  <strong className={cx(layout.block51)}>Observations:</strong>
                  {s.observations}
                </div>
                {s.site_constraints && (
                  <div className={cx(layout.block52)}>
                    <strong className={cx(layout.block53)}>Constraints:</strong>
                    {s.site_constraints}
                  </div>
                )}
                <div className={cx(layout.block54)}>
                  <strong className={cx(layout.block55)}>
                    Recommendations:
                  </strong>
                  {s.recommendations}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close Modal (Lost / Declined) */}
      {showCloseModal && (
        <Dialog
          title="Close Enquiry without Commission"
          onClose={() => setShowCloseModal(false)}
        >
          <div className={cx(["card", layout.block57].join(" "))}>
            <h3 className={cx(layout.block58)}>
              Close Enquiry without Commission
            </h3>
            <p className={cx(["text-muted", layout.block59].join(" "))}>Per</p>
            <form onSubmit={handleCloseSubmit}>
              <div className={cx(layout.block60)}>
                <label className={cx(layout.block61)} htmlFor="closeStatus">
                  Outcome *
                </label>
                <select
                  value={closeStatus}
                  onChange={(e) =>
                    setCloseStatus(e.target.value as "LOST" | "DECLINED")
                  }
                  className={cx(layout.block62)}
                  id="closeStatus"
                >
                  <option value="LOST">
                    Lost (Client chose alternative / decided not to proceed)
                  </option>
                  <option value="DECLINED">
                    Declined (Practice capacity / location outside focus)
                  </option>
                </select>
              </div>

              <div className={cx(layout.block63)}>
                <label className={cx(layout.block64)}>
                  Reason for Closure *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the commercial or logistical reason..."
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className={cx(layout.block65)}
                />
              </div>

              <div className={cx(layout.block66)}>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className={cx("btn-secondary")}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Closing..." : "Confirm Closure"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Convert Modal */}
      {showConvertModal && (
        <Dialog
          title="Convert Enquiry to Project Record"
          onClose={() => setShowConvertModal(false)}
        >
          <div className={cx(["card", layout.block68].join(" "))}>
            <h3 className={cx(layout.block69)}>
              Convert Enquiry to Project Record
            </h3>
            <p className={cx(["text-muted", layout.block70].join(" "))}>
              Initializes a new architectural project with standard stages in
              DRAFT status. Full activation requires accepted quotation and
              confirmed advance payment.
            </p>
            <form onSubmit={handleConvertSubmit}>
              <div className={cx(layout.block71)}>
                <label className={cx(layout.block72)} htmlFor="projectCode">
                  Project Code *
                </label>
                <input
                  type="text"
                  required
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  className={cx(layout.block73)}
                  id="projectCode"
                />
              </div>

              <div className={cx(layout.block74)}>
                <label className={cx(layout.block75)} htmlFor="projectName">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={cx(layout.block76)}
                  id="projectName"
                />
              </div>

              <div className={cx(layout.block77)}>
                <label
                  className={cx(layout.block78)}
                  htmlFor="mainClientUserId"
                >
                  Main Client Authority *
                </label>
                <select
                  required
                  value={mainClientUserId}
                  onChange={(e) => setMainClientUserId(e.target.value)}
                  className={cx(layout.block79)}
                  id="mainClientUserId"
                >
                  <option value="">Select registered client user...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className={cx(layout.block80)}>
                <label className={cx(layout.block81)} htmlFor="managerUserId">
                  Lead Project Manager *
                </label>
                <select
                  required
                  value={managerUserId}
                  onChange={(e) => setManagerUserId(e.target.value)}
                  className={cx(layout.block82)}
                  id="managerUserId"
                >
                  <option value="">Select project manager...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className={cx(layout.block83)}>
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className={cx("btn-secondary")}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx("btn-primary")}
                  disabled={submitting}
                >
                  {submitting ? "Converting..." : "Convert to Project"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
