"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readResponse } from "@/components/ui";
export function FavoriteProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => {
    const load = () =>
      Promise.all([
        fetch("/api/workspace").then(readResponse),
        fetch("/api/projects").then(readResponse),
      ])
        .then(([p, d]) =>
          setProjects(
            (d.projects || []).filter((x: any) => p.favorites?.includes(x.id)),
          ),
        )
        .catch(() => {});
    load();
    window.addEventListener("workspace:preferences", load);
    return () => window.removeEventListener("workspace:preferences", load);
  }, []);
  if (!projects.length) return null;
  return (
    <nav
      aria-label="Favorite projects"
      style={{
        padding: "8px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <small style={{ color: "var(--ui-text-muted)" }}>Favorites</small>
      {projects.map((p) => (
        <Link
          style={{
            fontSize: 13,
            color: "var(--ui-text-secondary)",
            overflowWrap: "anywhere",
          }}
          key={p.id}
          href={`/projects/${p.id}/tasks`}
        >
          {p.code} · {p.name}
        </Link>
      ))}
    </nav>
  );
}
