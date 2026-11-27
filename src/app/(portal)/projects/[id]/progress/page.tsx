"use client";
import { useParams } from "next/navigation";
import { ProjectProgress } from "@/components/workspace/progress";
export default function Progress() {
  const { id } = useParams<{ id: string }>();
  return <ProjectProgress projectId={id} />;
}
