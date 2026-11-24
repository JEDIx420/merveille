"use client";
import { AuthShell } from "@/components/shells";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <AuthShell>
      <h1>Unable to open this page</h1>
      <p>
        Your changes have not been confirmed. Try again, or return to your
        workspace.
      </p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
      <p>
        <a href="/overview">Return to workspace</a>
      </p>
    </AuthShell>
  );
}
