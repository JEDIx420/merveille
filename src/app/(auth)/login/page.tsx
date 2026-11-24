"use client";
import { useSession } from "@/components/session";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const { principal } = useSession();
  const router = useRouter();
  const [setupPending, setSetupPending] = useState(false);
  useEffect(() => {
    setSetupPending(
      new URLSearchParams(window.location.search).get("setup") === "pending",
    );
  }, []);
  useEffect(() => {
    if (principal) router.replace("/overview");
  }, [principal, router]);
  if (setupPending)
    return (
      <>
        <h1>Sign-in is being prepared</h1>
        <p>
          Your administrator needs to finish Google account setup before this
          workspace can be opened.
        </p>
        <p className="auth-help">
          Your records remain private. Ask your administrator to complete access
          setup and share your invitation when it is ready.
        </p>
      </>
    );
  return (
    <>
      <h1>Your projects, together.</h1>
      <p>
        Sign in with the Google account invited by your administrator to access
        your Merveille Designs workspace.
      </p>
      <a
        className="btn-primary auth-action"
        href="/api/auth/login?returnTo=/overview"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.5 2.9-7.7ZM12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3v2.7A10 10 0 0 0 12 22ZM6.4 13.6a6 6 0 0 1 0-3.2V7.7H3a10 10 0 0 0 0 8.6l3.4-2.7ZM12 6.2c1.5 0 2.8.5 3.8 1.5L18.7 5A10 10 0 0 0 3 7.7l3.4 2.7A5.9 5.9 0 0 1 12 6.2Z"
          />
        </svg>
        Continue with Google
      </a>
      <p className="auth-help">
        Invitation-only access. Your Google inbox is never accessed. If you need
        an invitation, contact your project administrator.
      </p>
    </>
  );
}
