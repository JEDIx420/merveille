"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  return (
    <div style={{ maxWidth: "500px", margin: "4rem auto", textAlign: "center" }}>
      <div className="card">
        <h1 className="text-section" style={{ fontSize: "1.75rem", color: "var(--merveille-danger)", marginBottom: "0.5rem" }}>
          Application Error (500)
        </h1>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          An unexpected error occurred during operation processing.
        </p>
        <button onClick={() => reset()} className="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}
