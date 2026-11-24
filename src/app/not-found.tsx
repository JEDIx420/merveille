import { AuthShell } from "@/components/shells";
export default function NotFound() {
  return (
    <AuthShell>
      <h1>Page not found</h1>
      <p>
        The page may have moved, or the link is incomplete. Your projects are
        available in your workspace.
      </p>
      <a href="/overview" className="btn-primary">
        Open workspace
      </a>
    </AuthShell>
  );
}
