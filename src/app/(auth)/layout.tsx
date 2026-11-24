import { AuthShell } from "@/components/shells";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
