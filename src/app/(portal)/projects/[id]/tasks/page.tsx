"use client";
import { useParams } from "next/navigation";
import { TaskWorkspace } from "@/components/workspace/task-workspace";
import { useProject } from "@/components/project-context";
export default function Tasks() {
  const { id } = useParams<{ id: string }>();
  const project = useProject();
  return <TaskWorkspace projectId={id} readOnly={!!project?.is_archived} />;
}
