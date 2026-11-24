import { ProjectShell } from "@/components/shells";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectShell projectId={id}>{children}</ProjectShell>;
}
