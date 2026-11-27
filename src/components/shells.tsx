"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ListTodo,
  Archive,
  Wallet,
  Users,
  ChartNoAxesCombined,
  Inbox,
  Menu,
  X,
  Building2,
  MessageSquare,
} from "lucide-react";
import { BRAND_CONFIG } from "@/shared/config";
import { hasCapability } from "@/server/auth/principal";
import { useSession } from "./session";
import {
  Button,
  LoadingState,
  ErrorState,
  FeedbackProvider,
  Badge,
  readResponse,
} from "./ui";
import styles from "./shell.module.css";
import { AppearanceControl } from "./experience/controls";
import { ProjectContext } from "./project-context";
function Brand() {
  return (
    <>
      <img src={BRAND_CONFIG.logoPath} alt="" />
      <strong>
        Merveille Designs<small>Consultancy and interiors</small>
      </strong>
    </>
  );
}
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.auth}>
      <header className={styles.authHeader}>
        <img src={BRAND_CONFIG.logoPath} alt="" />
        <strong>Merveille Designs</strong>
        <AppearanceControl />
      </header>
      <main className={styles.authBody}>{children}</main>
    </div>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { principal, loading, error } = useSession();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const first = drawer.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
      if (e.key === "Tab") {
        const targets = Array.from(
          drawer.current?.querySelectorAll<HTMLElement>("a,button") || [],
        );
        const first = targets[0],
          last = targets[targets.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);
  if (loading)
    return (
      <AuthShell>
        <LoadingState label="Opening your workspace…" />
      </AuthShell>
    );
  if (!principal)
    return (
      <AuthShell>
        <h1>Sign in to continue</h1>
        <p>
          Your session is unavailable or has expired. Sign in with your invited
          email account.
        </p>
        <a className="btn-primary" href="/api/auth/login?returnTo=/overview">
          Continue securely
        </a>
        {error && !/session|Unauthorized/i.test(error) && <p>{error}</p>}
      </AuthShell>
    );
  const roles = principal.roles || [];
  const internal =
    roles.some((r) => ["ADMIN", "OWNER"].includes(r)) ||
    principal.projectMemberships.some((m) =>
      (m.roles || [m.projectRole]).some((r) =>
        ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""),
      ),
    );
  const isConsultant =
    !internal &&
    principal.projectMemberships.some((m) =>
      (m.roles || [m.projectRole]).includes("CONSULTANT"),
    );

  const links: [string, string, any][] = internal
    ? [
        ["/overview", "Today", LayoutDashboard],
        ["/waiting", "My Tasks", ListTodo],
        ["/projects", "Projects", FolderOpen],
        ["/notifications", "Inbox", Inbox],
      ]
    : isConsultant
      ? [
          ["/projects", "Assigned Projects", FolderOpen],
          ["/reviews", "Reviews", ListTodo],
          ["/notifications", "Inbox", Inbox],
          ["/archive", "Archive", Archive],
        ]
      : [
          ["/projects", "My Projects", FolderOpen],
          ["/notifications", "Inbox", Inbox],
          ["/archive", "Archive", Archive],
        ];

  if (
    internal &&
    (principal.intakeAccess ||
      hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "OWNER"))
  )
    links.splice(3, 0, ["/enquiries", "Leads", Building2]);
  if (internal) links.push(["/archive", "Archive", Archive]);
  if (hasCapability(principal, "ADMIN"))
    links.push(["/people", "People & access", Users]);
  if (hasCapability(principal, "OWNER"))
    links.push(["/performance", "Performance", ChartNoAxesCombined]);
  if (hasCapability(principal, "ADMIN") || hasCapability(principal, "OWNER"))
    links.push(["/finance", "Commercial History", Wallet]);
  return (
    <FeedbackProvider>
      <div className={styles.workspace}>
        <a href="#main-content" className={styles.skip}>
          Skip to content
        </a>
        {open && (
          <button
            className={styles.scrim}
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
        )}
        <aside
          ref={drawer}
          className={[styles.sidebar, open ? styles.open : ""].join(" ")}
          aria-label="Workspace navigation"
        >
          <Link href="/overview" className={styles.identity}>
            <Brand />
          </Link>
          <nav className={styles.nav}>
            {links.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  path === href || path.startsWith(href + "/")
                    ? "page"
                    : undefined
                }
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className={styles.account}>
            <strong>{principal.name}</strong>
            <span>{principal.email}</span>
            <a href="/api/auth/logout">Sign out</a>
          </div>
        </aside>
        <div className={styles.body}>
          <div className={styles.mobileBar}>
            <Link className={styles.mobileBrand} href="/overview">
              <img src={BRAND_CONFIG.logoPath} alt="" />
              Merveille Designs
            </Link>
            <div className={styles.mobileActions}>
            <AppearanceControl />
            <Link href="/notifications" className="btn-secondary" aria-label="Notifications"><Inbox size={20} aria-hidden="true" /></Link>
            <button
              ref={menu}
              className="btn-secondary"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? "Close navigation" : "Open navigation"}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            </div>
          </div>
          <header className={styles.topbar}>
            <p>Your project workspace</p>
            <div className={styles.desktopActions}><AppearanceControl />
            <Link href="/notifications">
              <Inbox size={18} aria-hidden="true" />
              Notifications
            </Link></div>
          </header>
          <main className={styles.content} id="main-content">
            <div key={path} className={styles.route}>{children}</div>
          </main>
        </div>
      </div>
    </FeedbackProvider>
  );
}
export function ProjectShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { principal } = useSession();
  const [project, setProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setProject(null);
    setError("");
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}`, { signal: controller.signal })
      .then(readResponse)
      .then((d) => setProject(d.project))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    fetch("/api/projects", { signal: controller.signal })
      .then(readResponse)
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
    return () => controller.abort();
  }, [projectId]);
  if (!principal) return null;
  if (error) return <ErrorState message={error} />;
  if (!project) return <LoadingState label="Loading project…" />;
  const grant = principal.projectMemberships.find(
    (m) => m.projectId === projectId,
  );
  const roles = grant?.roles || [grant?.projectRole];
  const internal =
    hasCapability(principal, "ADMIN") ||
    hasCapability(principal, "OWNER") ||
    roles.some((r) => ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(r || ""));
  const finance =
    hasCapability(principal, "ADMIN") ||
    hasCapability(principal, "OWNER") ||
    grant?.financeAccess ||
    roles.some((r) =>
      ["MANAGER", "CONSULTANT", "MAIN_CLIENT"].includes(r || ""),
    );
  const sections = [
    ["overview", "Overview"],
    ["drawings", "Drawings"],
    ["updates", "Updates"],
    ["documents", "Documents"],
    ["permits", "Permits"],
    ["selections", "Materials & references"],
    ["changes", "Changes"],
    ["snags", "Site issues"],
  ];
  if (internal) sections.splice(1, 0, ["tasks", "Tasks"]);
  if (finance) sections.splice(5, 0, ["finance", "Finance"]);
  return (
    <ProjectContext.Provider value={project}>
      <section className={styles.project}>
        <div className={styles.projectIdentity}>
          <div>
            <span className={styles.projectCode}>{project.code}</span>
            <h2>{project.name}</h2>
            <div className="project-meta">
              <span>{project.stage?.replaceAll("_", " ")}</span>
              <Badge>{project.status}</Badge>
            </div>
          </div>
          {projects.length > 1 && (
            <label className={styles.projectSelect}>
              <span className="sr-only">Switch project</span>
              <select
                value={projectId}
                onChange={(e) =>
                  router.push(`/projects/${e.target.value}/overview`)
                }
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {project.is_archived === 1 && (
          <div className={styles.archive}>
            Archived project — records are available to view and download.
            Project work is read-only.
          </div>
        )}
        <nav className={styles.projectNav} aria-label="Project sections">
          {sections.map(([slug, label]) => (
            <Link
              href={`/projects/${projectId}/${slug}`}
              key={slug}
              aria-current={path.endsWith("/" + slug) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>
      {children}
    </ProjectContext.Provider>
  );
}
