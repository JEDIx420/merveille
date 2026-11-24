"use client";
import { useState, useEffect } from "react";
import { Button, ErrorState, readResponse } from "@/components/ui";
export default function InvitationPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const value =
      new URLSearchParams(location.search).get("token") ||
      new URLSearchParams(location.hash.slice(1)).get("token") ||
      location.hash.slice(1);
    if (value) {
      setToken(value);
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await readResponse(
        await fetch("/api/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      );
      setAccepted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>
        {accepted ? "Welcome to your workspace" : "Join Merveille Designs"}
      </h1>
      <p>
        {accepted
          ? "Your invitation has been accepted. You can now open your permitted projects."
          : "Use the exact email account your administrator invited. Accepting this invitation activates only the access they assigned."}
      </p>
      {error && <ErrorState message={error} />}{" "}
      {accepted ? (
        <a href="/overview" className="btn-primary">
          Open workspace
        </a>
      ) : token ? (
        <Button onClick={accept} disabled={busy}>
          {busy ? "Accepting…" : "Accept invitation"}
        </Button>
      ) : (
        <ErrorState message="This invitation link is incomplete. Ask your administrator for a new link." />
      )}
      <p className="auth-help">
        Wrong email account? <a href="/api/auth/logout">Sign out</a> and open
        your invitation again with the invited account.
      </p>
    </>
  );
}
