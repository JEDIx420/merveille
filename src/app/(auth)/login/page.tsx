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
          Your administrator needs to finish secure sign-in setup before this
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
        Sign in with the email account invited by your administrator to access
        your Merveille Designs workspace.
      </p>
      <a
        className="btn-primary auth-action"
        href="/api/auth/login?returnTo=/overview"
      >
        Continue securely
      </a>
      <p className="auth-help">
        Invitation-only access. Your inbox is never accessed. If you need
        an invitation, contact your project administrator.
      </p>
    </>
  );
}
