"use client";
import { cx } from "@/components/utilities";
import { use, useState, useEffect } from "react";
import { useProject } from "@/components/project-context";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import {
  PageHeader,
  Button,
  Field,
  Badge,
  Dialog,
  FilePreview,
  EmptyState,
  ErrorState,
  LoadingState,
  readResponse,
  useFeedback,
  ui,
} from "@/components/ui";
import { formatBusinessDate } from "@/shared/config";
const disciplines = [
  "ARCHITECTURAL",
  "STRUCTURAL",
  "MEP",
  "LANDSCAPE",
  "INTERIOR",
  "CIVIL",
];
export default function Drawings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { principal } = useSession();
  const project = useProject();
  const readOnly = project?.is_archived === 1 || project?.status === "ARCHIVED";
  const feedback = useFeedback();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [versionId, setVersionId] = useState("");
  const [selected, setSelected] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [discipline, setDiscipline] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"drawing" | "revision" | "review" | null>(
    null,
  );
  const [form, setForm] = useState({
    number: "",
    title: "",
    discipline: "ARCHITECTURAL",
    versionLabel: "",
    fileId: "",
    note: "",
    reviewers: [] as string[],
    decision: "APPROVED",
    reason: "",
  });
  const manager = !readOnly && hasCapability(principal, "MANAGER", id);
  const author =
    !readOnly && (manager || hasCapability(principal, "TEAM_MEMBER", id));
  const consultant = !readOnly && hasCapability(principal, "CONSULTANT", id);
  function field(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await readResponse(
        await fetch(`/api/projects/${id}/drawings?discipline=${discipline}`),
      );
      setDrawings(data.drawings || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id, discipline]);
  async function openDrawing(drawingId: string) {
    setSelected(drawingId);
    setDetail(null);
    setError("");
    try {
      const data = await readResponse(
        await fetch(`/api/drawings/${drawingId}`),
      );
      setDetail(data);
      setVersionId(
        data.versions?.find(
          (v: any) => v.id === data.drawing?.current_released_version_id,
        )?.id ||
          data.versions?.[0]?.id ||
          "",
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function prepareRevision() {
    setError("");
    try {
      const [f, p] = await Promise.all([
        fetch(`/api/projects/${id}/files`).then(readResponse),
        fetch(`/api/projects/${id}/participants`).then(readResponse),
      ]);
      setFiles(f.files || []);
      setParticipants(
        (p.participants || []).filter((p: any) =>
          p.roles?.includes("CONSULTANT"),
        ),
      );
      setModal("revision");
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function mutate(url: string, payload: any, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readResponse(
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setNotice(success);
      setModal(null);
      await load();
      if (selected) await openDrawing(selected);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const version = detail?.versions?.find((v: any) => v.id === versionId);
  const drawing = detail?.drawing || drawings.find((d) => d.id === selected);
  const assignedReview = version?.reviews?.find(
    (r: any) => r.consultant_user_id === principal?.id,
  );
  return (
    <div className={ui.page}>
      <PageHeader
        title="Drawings"
        description="Prepared by the team, reviewed by designated consultants, released by your manager."
        actions={
          author && (
            <Button onClick={() => setModal("drawing")}>Add drawing</Button>
          )
        }
      />
      {error && <ErrorState message={error} retry={load} />}{" "}
      {notice && (
        <p role="status" className={cx("status-note")}>
          {notice}
        </p>
      )}
      <Field label="Discipline">
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="ALL">All disciplines</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>
              {d.toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      {loading ? (
        <LoadingState label="Loading drawing register…" />
      ) : drawings.length ? (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Drawing</th>
                <th>Discipline</th>
                <th>Current release</th>
                <th>Last released</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {drawings.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.title}</strong>
                    <small>{d.drawing_number}</small>
                  </td>
                  <td>{d.discipline.toLowerCase()}</td>
                  <td>
                    {d.is_withdrawn ? (
                      <Badge>WITHDRAWN</Badge>
                    ) : d.current_version_label ? (
                      <Badge>{`Revision ${d.current_version_label}`}</Badge>
                    ) : (
                      "Not released"
                    )}
                  </td>
                  <td>
                    {d.released_at ? formatBusinessDate(d.released_at) : "—"}
                  </td>
                  <td>
                    <Button secondary onClick={() => openDrawing(d.id)}>
                      Open drawing
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <div className={ui.panel}>
            <EmptyState
              title="No drawings in this view"
              description={
                author
                  ? "Add a drawing to start its revision and review history."
                  : "Released drawings and your assigned review versions will appear here."
              }
            />
          </div>
        )
      )}
      {selected && (
        <section className={ui.panel}>
          <PageHeader
            section
            title={drawing?.title || "Drawing details"}
            description={drawing?.drawing_number}
            actions={
              author && (
                <Button secondary onClick={prepareRevision}>
                  Add revision
                </Button>
              )
            }
          />
          {!detail ? (
            <LoadingState label="Loading revisions…" />
          ) : !version ? (
            <EmptyState
              title="No revisions yet"
              description="Add a revision with a completed project file and designated reviewers."
            />
          ) : (
            <>
              <div className={ui.state} />
              <Field label="Revision">
                <select
                  value={versionId}
                  onChange={(e) => setVersionId(e.target.value)}
                >
                  {detail.versions.map((v: any) => (
                    <option value={v.id} key={v.id}>
                      {v.version_label} —{" "}
                      {v.status.replaceAll("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <div className={ui.state} />
              <div className={ui.twoColumns}>
                <FilePreview
                  fileId={version.file_id}
                  name={version.file_name || `Drawing ${version.version_label}`}
                  mimeType={version.mime_type}
                />
                <div>
                  <Badge>{version.status}</Badge>
                  <h3>Revision {version.version_label}</h3>
                  <p className={ui.meta}>
                    Prepared {formatBusinessDate(version.created_at)}
                    {version.author_name ? ` by ${version.author_name}` : ""}
                  </p>
                  {version.submission_note && <p>{version.submission_note}</p>}
                  {version.status === "SUPERSEDED" && (
                    <p className={cx("status-note")}>
                      Previous release — use the current drawing for ongoing
                      work.
                    </p>
                  )}
                  <h3>Required reviews</h3>
                  {version.reviews?.length ? (
                    version.reviews.map((r: any) => (
                      <div className={ui.row} key={r.id}>
                        <div>
                          <strong>
                            {r.consultant_name ||
                              r.reviewer_name ||
                              "Assigned consultant"}
                          </strong>
                          {r.decision_reason && <p>{r.decision_reason}</p>}
                        </div>
                        <Badge>{r.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className={ui.meta}>No reviewers recorded.</p>
                  )}
                  <div className={ui.state} />
                  <div className={ui.actions}>
                    {author && version.status === "DRAFT" && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            `/api/drawings/versions/${version.id}`,
                            { action: "SUBMIT_REVIEW" },
                            "Revision submitted for consultant review.",
                          )
                        }
                      >
                        Submit revision {version.version_label}
                      </Button>
                    )}
                    {consultant &&
                      assignedReview &&
                      version.status === "IN_REVIEW" && (
                        <Button onClick={() => setModal("review")}>
                          Review revision {version.version_label}
                        </Button>
                      )}
                    {manager && version.status === "CONSULTANT_APPROVED" && (
                      <Button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await feedback.confirm(
                              `Release revision ${version.version_label} to the client? The existing release will be retained as superseded history.`,
                            )
                          )
                            mutate(
                              `/api/drawings/versions/${version.id}`,
                              {
                                action: "RELEASE",
                                expectedCurrentVersionId:
                                  drawing?.current_released_version_id ?? null,
                              },
                              "Drawing revision released to the client.",
                            );
                        }}
                      >
                        Release to client
                      </Button>
                    )}
                    {manager && drawing?.current_released_version_id && (
                      <Button
                        secondary
                        disabled={busy}
                        onClick={async () => {
                          const reason = await feedback.prompt(
                            "Explain why the current drawing must be withdrawn. This does not release an older revision.",
                          );
                          if (reason)
                            mutate(
                              `/api/drawings/${selected}`,
                              { action: "WITHDRAW", reason },
                              "Current drawing withdrawn.",
                            );
                        }}
                      >
                        Withdraw release
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {modal && (
        <Dialog
          title={
            modal === "drawing"
              ? "Add drawing"
              : modal === "revision"
                ? "Add revision"
                : `Review revision ${version?.version_label}`
          }
          onClose={() => setModal(null)}
        >
          <form
            className={ui.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === "drawing")
                mutate(
                  `/api/projects/${id}/drawings`,
                  {
                    drawingNumber: form.number,
                    title: form.title,
                    discipline: form.discipline,
                  },
                  "Drawing added.",
                );
              if (modal === "revision")
                mutate(
                  `/api/drawings/${selected}`,
                  {
                    action: "CREATE_VERSION",
                    versionLabel: form.versionLabel,
                    fileId: form.fileId,
                    submissionNote: form.note,
                    requiredConsultantIds: form.reviewers,
                  },
                  "Revision saved as a draft.",
                );
              if (modal === "review")
                mutate(
                  `/api/drawings/versions/${version.id}`,
                  {
                    action: "CONSULTANT_DECISION",
                    decision: form.decision,
                    reason: form.reason,
                  },
                  "Your decision was recorded for this revision.",
                );
            }}
          >
            {error && <ErrorState message={error} />}{" "}
            {modal === "drawing" ? (
              <>
                <Field label="Drawing number">
                  <input
                    required
                    value={form.number}
                    onChange={(e) => field("number", e.target.value)}
                  />
                </Field>
                <Field label="Title">
                  <input
                    required
                    value={form.title}
                    onChange={(e) => field("title", e.target.value)}
                  />
                </Field>
                <Field label="Discipline">
                  <select
                    value={form.discipline}
                    onChange={(e) => field("discipline", e.target.value)}
                  >
                    {disciplines.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : modal === "revision" ? (
              <>
                <Field label="Revision label">
                  <input
                    required
                    value={form.versionLabel}
                    placeholder="e.g. C"
                    onChange={(e) => field("versionLabel", e.target.value)}
                  />
                </Field>
                <Field
                  label="Completed project file"
                  help="Upload a file in Documents before adding a revision."
                >
                  <select
                    required
                    value={form.fileId}
                    onChange={(e) => field("fileId", e.target.value)}
                  >
                    <option value="">Select a file</option>
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.file_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <fieldset>
                  <legend>Required consultants</legend>
                  {participants.length ? (
                    participants.map((p) => (
                      <label className={ui.checkbox} key={p.id}>
                        <input
                          type="checkbox"
                          checked={form.reviewers.includes(p.id)}
                          onChange={(e) =>
                            field(
                              "reviewers",
                              e.target.checked
                                ? [...form.reviewers, p.id]
                                : form.reviewers.filter((id) => id !== p.id),
                            )
                          }
                        />
                        {p.name}
                      </label>
                    ))
                  ) : (
                    <p>
                      No consultants are assigned to this project. Ask an
                      administrator to assign a reviewer.
                    </p>
                  )}
                </fieldset>
                <Field label="Revision notes">
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => field("note", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Decision">
                  <select
                    value={form.decision}
                    onChange={(e) => field("decision", e.target.value)}
                  >
                    <option value="APPROVED">Approve this revision</option>
                    <option value="CHANGES_REQUESTED">Request changes</option>
                    <option value="REJECTED">Reject revision</option>
                  </select>
                </Field>
                <Field label="Decision notes">
                  <textarea
                    required
                    value={form.reason}
                    rows={4}
                    onChange={(e) => field("reason", e.target.value)}
                  />
                </Field>
              </>
            )}
            <div className={ui.actions}>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : modal === "review"
                    ? `Record decision for revision ${version.version_label}`
                    : "Save"}
              </Button>
              <Button secondary type="button" onClick={() => setModal(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
