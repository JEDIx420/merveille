"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, readResponse } from "@/components/ui";
import { useTaskPanel } from "./task-panel";
import { Avatar } from "./studio-controls";
import styles from "./workspace.module.css";
export function QuickNavigation() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  const router = useRouter(),
    path = usePathname(),
    panel = useTaskPanel();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const project = path.match(/^\/projects\/([^/]+)/)?.[1];
    Promise.all([
      fetch("/api/projects").then(readResponse),
      fetch(project ? `/api/projects/${project}/tasks` : "/api/my-tasks")
        .then(readResponse)
        .catch(() => ({ items: [] })),
    ])
      .then(([p, t]) => {
        if (current)
          setItems([
            ...(p.projects || []).map((v: any) => ({
              id: v.id,
              name: v.name,
              detail: v.code,
              url: `/projects/${v.id}/overview`,
            })),
            ...(t.items || t.tasks || []).map((v: any) => ({
              id: v.id,
              name: v.title,
              detail: v.projectName || "Task",
              task: { id: v.id, scope: v.scope || "PROJECT" },
            })),
          ]);
      })
      .catch((e: Error) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [open, path]);
  return (
    <>
      <button
        className={styles.chip}
        onClick={() => {
          setOpen(true);
          setSearch("");
          setError("");
        }}
      >
        <Search size={16} />
        <span>Find anything</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <Dialog title="Find your work" onClose={() => setOpen(false)}>
          <div className={styles.stack}>
            <input
              autoFocus
              type="search"
              aria-label="Find projects and tasks"
              placeholder="Search projects and tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
            />
            <small className={styles.muted}>
              Your permitted projects and{" "}
              {path.includes("/projects/")
                ? "this project's tasks"
                : "your tasks"}
              .
            </small>
            {items
              .filter((v) =>
                `${v.name} ${v.detail}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 12)
              .map((v) => (
                <button
                  key={(v.task ? "task" : "project") + v.id}
                  className={styles.searchResult}
                  onClick={() => {
                    setOpen(false);
                    if (v.task) setTimeout(() => panel.open(v.task), 0);
                    else router.push(v.url);
                  }}
                >
                  <Avatar name={v.name} />
                  <span>
                    {v.name}
                    <small>{v.detail}</small>
                  </span>
                </button>
              ))}
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </>
  );
}
