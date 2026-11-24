"use client";
import { ProjectMutation } from "@/components/project-mutation";
import { useProject } from "@/components/project-context";
import { useSession } from "@/components/session";
import { hasCapability } from "@/server/auth/principal";
import { cx } from "@/components/utilities";
import { Dialog, FilePreview, readResponse } from "@/components/ui";
import layout from "./page.module.css";
import { useFeedback } from "@/components/ui";

import { useState, useEffect, use } from "react";
import { formatBusinessDate } from "@/shared/config";

interface ProjectFile {
  id: string;
  project_id: string;
  uploaded_by_name: string | null;
  file_class: "IMAGE" | "PDF" | "CAD" | "VIDEO" | "DOCUMENT";
  file_name: string;
  mime_type: string;
  size_bytes: number;
  reference_type: string;
  is_internal_only: number;
  is_referenced: number;
  created_at: number;
}

const CATEGORIES = ["ALL", "SITE_IMAGE", "FEASIBILITY", "DRAWING", "GENERAL"];

export default function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const feedback = useFeedback();
  const project = useProject();
  const { principal } = useSession();
  const archived = project?.is_archived === 1 || project?.status === "ARCHIVED";
  const settlementUpload = archived && hasCapability(principal, "ADMIN");
  const { id: projectId } = use(params);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("ALL");
  const [actionSuccess, setActionSuccess] = useState("");

  // Upload Form State
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileClass, setFileClass] = useState<
    "IMAGE" | "PDF" | "CAD" | "VIDEO" | "DOCUMENT"
  >("DOCUMENT");
  const [referenceType, setReferenceType] = useState<
    "SITE_IMAGE" | "FEASIBILITY" | "DRAWING" | "GENERAL"
  >("GENERAL");
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [projectId, category]);

  async function loadFiles() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/files?category=${category}`,
      );
      const json: any = await readResponse(res);
      if (!res.ok)
        throw new Error(json.error || "Failed to load project documents");
      setFiles(json.files || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Auto-detect file class from extension / MIME
    const name = file.name.toLowerCase();
    if (
      name.endsWith(".dwg") ||
      name.endsWith(".dxf") ||
      name.endsWith(".ifc")
    ) {
      setFileClass("CAD");
    } else if (file.type.startsWith("image/")) {
      setFileClass("IMAGE");
    } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      setFileClass("PDF");
    } else if (
      file.type.startsWith("video/") ||
      name.endsWith(".mp4") ||
      name.endsWith(".webm")
    ) {
      setFileClass("VIDEO");
    } else {
      setFileClass("DOCUMENT");
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setActionSuccess("");
    setUploadProgress(0);
    setUploadStatusText("Preparing upload…");

    try {
      // 1. Init Session
      const initRes = await fetch("/api/files/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          sizeBytes: selectedFile.size,
          fileClass,
          referenceType,
          isInternalOnly: settlementUpload ? true : isInternalOnly,
          isSettlementEvidence: settlementUpload,
        }),
      });

      const initData: any = await readResponse(initRes);
      if (!initRes.ok)
        throw new Error(initData.error || "Failed to initialize upload");

      const { sessionId, chunkSize } = initData;
      const totalBytes = selectedFile.size;
      const CHUNK_SIZE = chunkSize || 8 * 1024 * 1024;
      const totalParts = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
      const parts: Array<{ partNumber: number; etag: string }> = [];

      // 2. Chunk and upload parts with bounded retry
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const slice = selectedFile.slice(start, end);
        const chunkBuffer = await slice.arrayBuffer();

        setUploadStatusText(
          `Uploading chunk ${partNumber} of ${totalParts}...`,
        );

        let partSuccess = false;
        let lastPartErr = "";

        // Bounded retry loop (up to 3 attempts)
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const partRes = await fetch(
              `/api/files/part?sessionId=${encodeURIComponent(sessionId)}&partNumber=${partNumber}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/octet-stream" },
                body: chunkBuffer,
              },
            );

            const partData: any = await readResponse(partRes);
            if (!partRes.ok)
              throw new Error(partData.error || `Part ${partNumber} failed`);

            parts.push({ partNumber, etag: partData.etag });
            partSuccess = true;
            break;
          } catch (pErr: any) {
            lastPartErr = pErr.message;
            setUploadStatusText(
              `Part ${partNumber} failed, retrying online (attempt ${attempt}/3)...`,
            );
            await new Promise((r) => setTimeout(r, 600));
          }
        }

        if (!partSuccess) {
          throw new Error(
            `Failed to upload chunk ${partNumber} after retries: ${lastPartErr}`,
          );
        }

        setUploadProgress(Math.round((partNumber / totalParts) * 100));
      }

      // 3. Complete Upload
      setUploadStatusText("Checking upload…");
      const completeRes = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, parts }),
      });

      const completeData: any = await readResponse(completeRes);
      if (!completeRes.ok)
        throw new Error(completeData.error || "Failed to finalize upload");

      setActionSuccess(
        `File '${selectedFile.name}' successfully uploaded and secured.`,
      );
      setSelectedFile(null);
      setUploadProgress(null);
      setUploadStatusText("");
      loadFiles();
    } catch (err: any) {
      setError(err.message);
      setUploadProgress(null);
      setUploadStatusText("");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: ProjectFile) {
    if (
      !(await feedback.confirm(
        `Are you sure you want to delete '${file.file_name}'?`,
      ))
    )
      return;

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });

      const json: any = await readResponse(res);
      if (!res.ok) throw new Error(json.error || "Failed to delete file");

      setActionSuccess(`File '${file.file_name}' deleted.`);
      loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className={cx(layout.block1)}>
      {/* Breadcrumb */}
      <nav className={cx(layout.block2)}>
        <a href="/projects" className={cx(layout.block3)}>
          Projects
        </a>
        <span>/</span>
        <a
          href={`/projects/${projectId}/overview`}
          className={cx(layout.block4)}
        >
          Overview
        </a>
        <span>/</span>
        <span className={cx(layout.block5)}>Documents & Media</span>
      </nav>

      {/* Header */}
      <header className={cx(layout.block6)}>
        <div>
          <h1 className={cx("text-display")}>
            Documents, Drawings & Site Media
          </h1>
          <p className={cx(["text-muted", layout.block7].join(" "))}>
            Secure private repository for architectural drawings, site surveys,
            and reference media.
          </p>
        </div>
      </header>

      {/* Honest Storage & Security Notice */}
      <div
        className={cx("card")}
        style={{
          borderLeft: "3px solid var(--ui-action)",
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          backgroundColor: "var(--ui-surface-subtle)",
        }}
      >
        <strong
          style={{
            color: "var(--ui-action)",
            display: "block",
            marginBottom: "0.25rem",
          }}
        >
          Private project files
        </strong>
        <p style={{ color: "var(--ui-text)", margin: 0, lineHeight: 1.5 }}>
          Only people with permission can open these files. Drawings and
          published records keep their version history.
        </p>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className={cx(layout.block8)}>{actionSuccess}</div>
      )}

      {error && <div className={cx(layout.block9)}>{error}</div>}

      {/* Upload Box */}
      {(!archived || settlementUpload) && (
        <div className={cx("card")}>
          <h2 className={cx(layout.block10)}>
            {settlementUpload
              ? "Upload settlement evidence"
              : "Upload document or media"}
          </h2>
          <p className={cx(["text-muted", layout.block11].join(" "))}>
            Upload while online. Progress is shown below, and interrupted
            uploads can be retried.
          </p>

          <form onSubmit={handleUploadSubmit} className={cx(layout.block12)}>
            <div>
              <input
                type="file"
                required
                onChange={handleFileSelect}
                disabled={uploading}
                className={cx(layout.block13)}
              />
            </div>

            <div className={cx(layout.block14)}>
              <div>
                <label className={cx(layout.block15)} htmlFor="referenceType">
                  Document Category
                </label>
                <select
                  value={referenceType}
                  onChange={(e) => setReferenceType(e.target.value as any)}
                  disabled={uploading}
                  className={cx(layout.block16)}
                  id="referenceType"
                >
                  <option value="GENERAL">General Project Document</option>
                  <option value="SITE_IMAGE">Site Photo / Survey</option>
                  <option value="FEASIBILITY">
                    Feasibility Assessment Attachment
                  </option>
                  <option value="DRAWING">Architectural Drawing Draft</option>
                </select>
              </div>

              <div>
                <label className={cx(layout.block17)} htmlFor="fileClass">
                  Detected File Class
                </label>
                <select
                  value={fileClass}
                  onChange={(e) => setFileClass(e.target.value as any)}
                  disabled={uploading}
                  className={cx(layout.block18)}
                  id="fileClass"
                >
                  <option value="DOCUMENT">Document (Up to 50 MiB)</option>
                  <option value="IMAGE">Image (Up to 25 MiB)</option>
                  <option value="PDF">
                    PDF Drawing/Document (Up to 100 MiB)
                  </option>
                  <option value="CAD">
                    CAD Drawing DWG/DXF/IFC (Up to 250 MiB)
                  </option>
                  <option value="VIDEO">
                    Site Video MP4/WebM (Up to 1 GiB)
                  </option>
                </select>
              </div>

              <div className={cx(layout.block19)}>
                <label className={cx(layout.block20)}>
                  <input
                    type="checkbox"
                    checked={isInternalOnly}
                    onChange={(e) => setIsInternalOnly(e.target.checked)}
                    disabled={uploading}
                  />
                  Mark Internal Practice Only (Hide from Client)
                </label>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <div className={cx(layout.block21)}>
                <div className={cx(layout.block22)}>
                  <span className={cx(layout.block23)}>{uploadStatusText}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className={cx(layout.block24)}>
                  <div
                    style={{ width: `${uploadProgress}%` }}
                    className={cx(layout.block25)}
                  />
                </div>
              </div>
            )}

            <div className={cx(layout.block26)}>
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className={cx("btn-primary")}
              >
                {uploading ? "Uploading…" : "Upload File"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Tabs */}
      <div className={cx(layout.block27)}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              backgroundColor:
                category === cat ? "var(--ui-surface-subtle)" : "transparent",
              color:
                category === cat ? "var(--ui-action)" : "var(--ui-text-muted)",
            }}
            className={cx(layout.block28)}
          >
            {cat === "ALL" ? "All Files" : cat.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Files List & Previews */}
      {loading ? (
        <div className={cx(["card text-muted", layout.block29].join(" "))}>
          Loading project files...
        </div>
      ) : error ? null : files.length === 0 ? (
        <div className={cx(["card text-muted", layout.block30].join(" "))}>
          No files matching this category.
        </div>
      ) : (
        <div className={cx(layout.block31)}>
          {files.map((file) => {
            const isCAD = file.file_class === "CAD";
            const isImage = file.file_class === "IMAGE";
            const isVideo = file.file_class === "VIDEO";
            const isPDF = file.file_class === "PDF";
            const downloadUrl = `/api/files/${file.id}/download`;

            return (
              <div
                key={file.id}
                className={cx(["card", layout.block32].join(" "))}
              >
                <div>
                  {/* Preview Area */}
                  <div className={cx(layout.block33)}>
                    {isImage ? (
                      <img
                        src={downloadUrl}
                        alt={file.file_name}
                        className={cx(layout.block34)}
                      />
                    ) : isCAD ? (
                      <div className={cx(layout.block35)}>
                        <span className={cx(layout.block36)}>📐</span>
                        <div className={cx(layout.block37)}>
                          CAD Drawing (
                          {file.file_name.split(".").pop()?.toUpperCase()})
                        </div>
                        <div className={cx(layout.block38)}>
                          Preview unavailable in browser (Download-only)
                        </div>
                      </div>
                    ) : isVideo ? (
                      <video
                        controls
                        preload="metadata"
                        className={cx(layout.block39)}
                      >
                        <source src={downloadUrl} type={file.mime_type} />
                        Your browser does not support video playback.
                      </video>
                    ) : isPDF ? (
                      <div className={cx(layout.block40)}>
                        <span className={cx(layout.block41)}>📄</span>
                        <div className={cx(layout.block42)}>PDF Document</div>
                        <div className={cx(layout.block43)}>
                          Open the preview to read this PDF
                        </div>
                      </div>
                    ) : (
                      <div className={cx(layout.block44)}>
                        <span className={cx(layout.block45)}>📁</span>
                        <div className={cx(layout.block46)}>
                          Office Document
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPreviewFile(file)}
                  >
                    Preview file
                  </button>
                  <div className={cx(layout.block47)}>
                    <h3 className={cx(layout.block48)}>{file.file_name}</h3>
                  </div>

                  <div className={cx(layout.block49)}>
                    <span
                      className={cx(
                        ["badge badge-draft", layout.block50].join(" "),
                      )}
                    >
                      {file.file_class}
                    </span>
                    <span
                      className={cx(
                        ["badge badge-draft", layout.block51].join(" "),
                      )}
                    >
                      {file.reference_type}
                    </span>
                    {file.is_internal_only === 1 && (
                      <span
                        className={cx(
                          ["badge badge-paused", layout.block52].join(" "),
                        )}
                      >
                        INTERNAL ONLY
                      </span>
                    )}
                    {file.is_referenced === 1 && (
                      <span
                        className={cx(
                          ["badge badge-active", layout.block53].join(" "),
                        )}
                      >
                        RETAINED RECORD
                      </span>
                    )}
                  </div>

                  <div className={cx(layout.block54)}>
                    <div>
                      Size: {(file.size_bytes / (1024 * 1024)).toFixed(2)} MiB
                    </div>
                    <div>
                      Uploaded by: {file.uploaded_by_name || "Practice Member"}
                    </div>
                    <div>Date: {formatBusinessDate(file.created_at)}</div>
                  </div>
                </div>

                <div className={cx(layout.block55)}>
                  <a
                    href={downloadUrl}
                    download={file.file_name}
                    className={cx(["btn-primary", layout.block56].join(" "))}
                  >
                    Download
                  </a>

                  {file.is_referenced === 0 && (
                    <ProjectMutation>
                      <button
                        onClick={() => handleDelete(file)}
                        className={cx(layout.block57)}
                      >
                        Delete
                      </button>
                    </ProjectMutation>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {previewFile && (
        <Dialog
          title={previewFile.file_name}
          onClose={() => setPreviewFile(null)}
        >
          <FilePreview
            fileId={previewFile.id}
            name={previewFile.file_name}
            mimeType={previewFile.mime_type}
          />
        </Dialog>
      )}
    </div>
  );
}
