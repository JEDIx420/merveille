"use client";
import { useProject } from "./project-context";
/** Archived projects retain browsing, filtering and downloads, but hide new work actions. */
export function ProjectMutation({ children }: { children: React.ReactNode }) {
  const project = useProject();
  return project?.is_archived === 1 || project?.status === "ARCHIVED"
    ? null
    : children;
}
