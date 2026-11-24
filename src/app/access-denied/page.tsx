import { AuthShell } from "@/components/shells";
export default function AccessDenied() {
  return (
    <AuthShell>
      <h1>Access isn’t available</h1>
      <p>
        Your account does not have access to this workspace. Ask your
        administrator to check your invitation and project permissions.
      </p>
      <a href="/api/auth/logout" className="btn-primary">
        Sign out
      </a>
      <p>
        <a href="/overview">Return to workspace</a>
      </p>
    </AuthShell>
  );
}
