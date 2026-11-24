"use client";

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
  const { id: projectId } = use(params);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("ALL");
  const [actionSuccess, setActionSuccess] = useState("");

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileClass, setFileClass] = useState<"IMAGE" | "PDF" | "CAD" | "VIDEO" | "DOCUMENT">("DOCUMENT");
  const [referenceType, setReferenceType] = useState<"SITE_IMAGE" | "FEASIBILITY" | "DRAWING" | "GENERAL">("GENERAL");
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
      const res = await fetch(`/api/projects/${projectId}/files?category=${category}`);
      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load project documents");
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
    if (name.endsWith(".dwg") || name.endsWith(".dxf") || name.endsWith(".ifc")) {
      setFileClass("CAD");
    } else if (file.type.startsWith("image/")) {
      setFileClass("IMAGE");
    } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      setFileClass("PDF");
    } else if (file.type.startsWith("video/") || name.endsWith(".mp4") || name.endsWith(".webm")) {
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
    setUploadStatusText("Initializing multipart upload session...");

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
          isInternalOnly,
        }),
      });

      const initData: any = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to initialize upload");

      const { sessionId, chunkSize } = initData;
      const totalBytes = selectedFile.size;
      const CHUNK_SIZE = chunkSize || 8 * 1024 * 1024;
      const totalParts = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
      const parts: Array<{ partNumber: number; etag: string }> = [];

      // 2. Chunk and upload parts with bounded retry (AC-056)
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const slice = selectedFile.slice(start, end);
        const chunkBuffer = await slice.arrayBuffer();

        setUploadStatusText(`Uploading chunk ${partNumber} of ${totalParts}...`);

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
              }
            );

            const partData: any = await partRes.json();
            if (!partRes.ok) throw new Error(partData.error || `Part ${partNumber} failed`);

            parts.push({ partNumber, etag: partData.etag });
            partSuccess = true;
            break;
          } catch (pErr: any) {
            lastPartErr = pErr.message;
            setUploadStatusText(`Part ${partNumber} failed, retrying online (attempt ${attempt}/3)...`);
            await new Promise((r) => setTimeout(r, 600));
          }
        }

        if (!partSuccess) {
          throw new Error(`Failed to upload chunk ${partNumber} after retries: ${lastPartErr}`);
        }

        setUploadProgress(Math.round((partNumber / totalParts) * 100));
      }

      // 3. Complete Upload
      setUploadStatusText("Finalizing and validating storage integrity...");
      const completeRes = await fetch("/api/files/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, parts }),
      });

      const completeData: any = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error || "Failed to finalize upload");

      setActionSuccess(`File '${selectedFile.name}' successfully uploaded and secured.`);
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
    if (!confirm(`Are you sure you want to delete '${file.file_name}'?`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete file");

      setActionSuccess(`File '${file.file_name}' deleted.`);
      loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "0.875rem", color: "var(--merveille-muted)", display: "flex", gap: "0.5rem" }}>
        <a href="/projects" style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Projects
        </a>
        <span>/</span>
        <a href={`/projects/${projectId}/overview`} style={{ color: "var(--merveille-gold)", textDecoration: "none" }}>
          Overview
        </a>
        <span>/</span>
        <span style={{ color: "#fff" }}>Documents & Media</span>
      </nav>

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="text-display">Documents, Drawings & Site Media</h1>
          <p className="text-muted" style={{ marginTop: "0.25rem" }}>
            Secure private repository for architectural drawings, site surveys, and reference media.
          </p>
        </div>
      </header>

      {/* Honest Storage & Security Notice (AC-058) */}
      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--merveille-gold)",
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          backgroundColor: "rgba(197, 160, 89, 0.05)",
        }}
      >
        <strong style={{ color: "var(--merveille-gold)", display: "block", marginBottom: "0.25rem" }}>
          Storage & Integrity Policy
        </strong>
        <p style={{ color: "var(--merveille-foreground)", margin: 0, lineHeight: 1.5 }}>
          All project files are held in private Cloudflare R2 storage with current-authorization access control.
          Object types and sizes are validated upon upload. In accordance with practice standards, no automated
          antivirus scanning is implied or performed; untrusted active content (HTML/scripts) is rejected at ingestion.
        </p>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#86efac",
            fontSize: "0.875rem",
          }}
        >
          {actionSuccess}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#fca5a5",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Upload Box */}
      <div className="card">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>
          Upload New Document or Media
        </h2>
        <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Large uploads use streaming multipart chunks with bounded online retry (AC-056).
        </p>

        <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <input
              type="file"
              required
              onChange={handleFileSelect}
              disabled={uploading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                backgroundColor: "var(--merveille-charcoal)",
                border: "1px dashed rgba(255, 255, 255, 0.2)",
                color: "#fff",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                Document Category
              </label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value as any)}
                disabled={uploading}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  backgroundColor: "var(--merveille-charcoal)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.875rem",
                }}
              >
                <option value="GENERAL">General Project Document</option>
                <option value="SITE_IMAGE">Site Photo / Survey</option>
                <option value="FEASIBILITY">Feasibility Assessment Attachment</option>
                <option value="DRAWING">Architectural Drawing Draft</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
                Detected File Class
              </label>
              <select
                value={fileClass}
                onChange={(e) => setFileClass(e.target.value as any)}
                disabled={uploading}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  backgroundColor: "var(--merveille-charcoal)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "0.875rem",
                }}
              >
                <option value="DOCUMENT">Document (Up to 50 MiB)</option>
                <option value="IMAGE">Image (Up to 25 MiB)</option>
                <option value="PDF">PDF Drawing/Document (Up to 100 MiB)</option>
                <option value="CAD">CAD Drawing DWG/DXF/IFC (Up to 250 MiB)</option>
                <option value="VIDEO">Site Video MP4/WebM (Up to 1 GiB)</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", paddingTop: "1.25rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--merveille-muted)",
                  cursor: "pointer",
                }}
              >
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
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "var(--merveille-gold)" }}>{uploadStatusText}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${uploadProgress}%`, height: "100%", backgroundColor: "var(--merveille-gold)", transition: "width 0.2s ease" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="btn-primary"
            >
              {uploading ? "Uploading Chunks..." : "Upload File"}
            </button>
          </div>
        </form>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "0.5rem" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "4px",
              backgroundColor: category === cat ? "rgba(197, 160, 89, 0.2)" : "transparent",
              color: category === cat ? "var(--merveille-gold)" : "var(--merveille-muted)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {cat === "ALL" ? "All Files" : cat.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Files List & Previews */}
      {loading ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          Loading project files...
        </div>
      ) : files.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: "3rem" }}>
          No files matching this category.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {files.map((file) => {
            const isCAD = file.file_class === "CAD";
            const isImage = file.file_class === "IMAGE";
            const isVideo = file.file_class === "VIDEO";
            const isPDF = file.file_class === "PDF";
            const downloadUrl = `/api/files/${file.id}/download`;

            return (
              <div
                key={file.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "1.25rem",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  {/* Preview Area */}
                  <div
                    style={{
                      height: "140px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "0.875rem",
                      overflow: "hidden",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    {isImage ? (
                      <img
                        src={downloadUrl}
                        alt={file.file_name}
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    ) : isCAD ? (
                      <div style={{ textAlign: "center", padding: "1rem" }}>
                        <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.25rem" }}>📐</span>
                        <div style={{ fontSize: "0.75rem", color: "var(--merveille-gold)", fontWeight: 500 }}>
                          CAD Drawing ({file.file_name.split(".").pop()?.toUpperCase()})
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--merveille-muted)", marginTop: "0.2rem" }}>
                          Preview unavailable in browser (Download-only)
                        </div>
                      </div>
                    ) : isVideo ? (
                      <video
                        controls
                        preload="metadata"
                        style={{ maxWidth: "100%", maxHeight: "100%" }}
                      >
                        <source src={downloadUrl} type={file.mime_type} />
                        Your browser does not support video playback.
                      </video>
                    ) : isPDF ? (
                      <div style={{ textAlign: "center", padding: "1rem" }}>
                        <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.25rem" }}>📄</span>
                        <div style={{ fontSize: "0.8125rem", color: "#fff", fontWeight: 500 }}>
                          PDF Document
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--merveille-muted)" }}>
                          Sandboxed preview & download
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "1rem" }}>
                        <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.25rem" }}>📁</span>
                        <div style={{ fontSize: "0.8125rem", color: "#fff" }}>
                          Office Document
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <h3
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#fff",
                        wordBreak: "break-all",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {file.file_name}
                    </h3>
                  </div>

                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.35rem 0" }}>
                    <span className="badge badge-draft" style={{ fontSize: "0.7rem" }}>
                      {file.file_class}
                    </span>
                    <span className="badge badge-draft" style={{ fontSize: "0.7rem" }}>
                      {file.reference_type}
                    </span>
                    {file.is_internal_only === 1 && (
                      <span className="badge badge-paused" style={{ fontSize: "0.7rem" }}>
                        INTERNAL ONLY
                      </span>
                    )}
                    {file.is_referenced === 1 && (
                      <span className="badge badge-active" style={{ fontSize: "0.7rem" }}>
                        RETAINED RECORD
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--merveille-muted)", marginTop: "0.5rem" }}>
                    <div>Size: {(file.size_bytes / (1024 * 1024)).toFixed(2)} MiB</div>
                    <div>Uploaded by: {file.uploaded_by_name || "Practice Member"}</div>
                    <div>Date: {formatBusinessDate(file.created_at)}</div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    paddingTop: "0.75rem",
                    marginTop: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <a
                    href={downloadUrl}
                    download={file.file_name}
                    className="btn-primary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", textDecoration: "none" }}
                  >
                    Download
                  </a>

                  {file.is_referenced === 0 && (
                    <button
                      onClick={() => handleDelete(file)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#f87171",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
