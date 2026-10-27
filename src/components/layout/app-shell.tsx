"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Dumbbell,
  House,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth-buttons";

type Icon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;
type Role = "USER" | "COACH" | "ADMIN";
export type ShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  isDemo: boolean;
};
type NavItem = { label: string; href: string; icon: Icon; exact?: boolean };

type NavGroup = { label: string; items: NavItem[] };
const athleteNav: NavGroup[] = [
  {
    label: "TRAINING",
    items: [
      { label: "Overview", href: "/dashboard", icon: House, exact: true },
      { label: "My programs", href: "/plans", icon: ClipboardList },
      {
        label: "Workout history",
        href: "/workouts/history",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "INSIGHTS & ACCOUNT",
    items: [
      {
        label: "Progress",
        href: "/dashboard/progress",
        icon: ChartNoAxesCombined,
      },
      {
        label: "Activity heatmaps",
        href: "/dashboard/heatmaps",
        icon: Activity,
      },
      { label: "My coaches", href: "/dashboard/coaches", icon: Users },
      { label: "Exercise library", href: "/exercises", icon: BookOpen },
    ],
  },
];
const coachNav: NavGroup[] = [
  {
    label: "COACHING",
    items: [
      { label: "Overview", href: "/coach", icon: LayoutDashboard, exact: true },
      { label: "Clients", href: "/coach/clients", icon: Users },
      {
        label: "Program templates",
        href: "/coach/programs",
        icon: ClipboardList,
      },
      { label: "Assignments", href: "/coach/assignments", icon: CalendarDays },
    ],
  },
  {
    label: "MY TRAINING & TOOLS",
    items: [
      {
        label: "Personal dashboard",
        href: "/dashboard",
        icon: Dumbbell,
        exact: true,
      },
      {
        label: "Workout history",
        href: "/workouts/history",
        icon: CalendarDays,
      },
      {
        label: "Progress",
        href: "/dashboard/progress",
        icon: ChartNoAxesCombined,
      },
      { label: "Exercise library", href: "/exercises", icon: BookOpen },
    ],
  },
];
const adminNav: NavGroup[] = [
  {
    label: "ADMINISTRATION",
    items: [
      { label: "Manage coaches", href: "/admin/coaches", icon: ShieldCheck },
      {
        label: "Coach workspace",
        href: "/coach",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "PERSONAL TRAINING",
    items: [
      { label: "My dashboard", href: "/dashboard", icon: House, exact: true },
      { label: "My programs", href: "/plans", icon: ClipboardList },
    ],
  },
];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/exercises" ||
    pathname.startsWith("/exercises/")
  );
}

function navGroups(role: Role): NavGroup[] {
  return role === "COACH" ? coachNav : role === "ADMIN" ? adminNav : athleteNav;
}

function isActive(pathname: string, item: NavItem) {
  return (
    pathname === item.href ||
    (!item.exact && pathname.startsWith(`${item.href}/`))
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${compact ? "brand-compact" : ""}`}
      aria-label="GymTrack Pro home"
    >
      <span className="brand-symbol">
        <Activity size={20} strokeWidth={2.5} aria-hidden />
      </span>
      <span className="brand-wordmark">
        GymTrack <span>Pro</span>
      </span>
    </Link>
  );
}

function PublicShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: ReactNode;
}) {
  const target =
    user?.role === "COACH"
      ? "/coach"
      : user?.role === "ADMIN"
        ? "/admin/coaches"
        : "/dashboard";
  return (
    <div className="public-shell">
      <a href="#main-content" className="skip">
        Skip to content
      </a>
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav aria-label="Public navigation" className="public-nav">
            <Link href="/exercises">Exercise library</Link>
            {user ? (
              <Link className="btn btn-small" href={target}>
                Open workspace <ArrowUpRight size={15} aria-hidden />
              </Link>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link className="btn btn-small" href="/register">
                  Get started <ArrowUpRight size={15} aria-hidden />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="public-footer">
        <span>GymTrack Pro · Designed around better coaching decisions.</span>
        <span>Training insights are informational, not medical advice.</span>
      </footer>
    </div>
  );
}

function Navigation({
  pathname,
  groups,
  close,
}: {
  pathname: string;
  groups: NavGroup[];
  close: () => void;
}) {
  return (
    <nav
      id="workspace-navigation"
      className="workspace-navigation"
      aria-label="Workspace navigation"
    >
      {groups.map((group) => (
        <div key={group.label} className="nav-group">
          <p className="nav-group-label">{group.label}</p>
          {group.items.map((item) => {
            const IconComponent = item.icon;
            const selected = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`workspace-link ${selected ? "is-active" : ""}`}
                aria-current={selected ? "page" : undefined}
              >
                <IconComponent
                  size={18}
                  strokeWidth={selected ? 2.35 : 1.9}
                  aria-hidden
                />
                <span>{item.label}</span>
                {selected ? (
                  <span className="nav-active-mark" aria-hidden />
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function WorkspaceShell({
  user,
  pathname,
  children,
}: {
  user: ShellUser;
  pathname: string;
  children: ReactNode;
}) {
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const mobileOpen = openForPath === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const groups = navGroups(user.role);
  const active = groups
    .flatMap((g) => g.items)
    .find((item) => isActive(pathname, item));
  const workspaceLabel =
    user.role === "COACH"
      ? "Coach workspace"
      : user.role === "ADMIN"
        ? "Administration"
        : "Athlete workspace";

  useEffect(() => {
    if (mobileOpen)
      sidebarRef.current
        ?.querySelector<HTMLElement>(".workspace-link")
        ?.focus();
  }, [mobileOpen]);
  const closeMenu = useCallback(() => {
    setOpenForPath(null);
    toggleRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, closeMenu]);

  return (
    <div className="workspace-shell">
      <a href="#main-content" className="skip">
        Skip to content
      </a>
      {mobileOpen ? (
        <button
          className="workspace-backdrop"
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      ) : null}
      <aside
        ref={sidebarRef}
        className={`workspace-sidebar ${mobileOpen ? "mobile-open" : ""}`}
      >
        <div className="sidebar-brand-row">
          <Brand compact />
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <p className="sidebar-workspace-label">{workspaceLabel}</p>
        <Navigation pathname={pathname} groups={groups} close={closeMenu} />
        <div className="sidebar-bottom">
          {user.isDemo && (
            <div className="sidebar-demo">
              <ShieldCheck size={17} aria-hidden /> Read-only demo
            </div>
          )}
          <div className="sidebar-profile">
            <div className="profile-avatar" aria-hidden>
              {(user.name ?? user.email ?? "GT").slice(0, 2).toUpperCase()}
            </div>
            <div className="profile-copy">
              <strong>{user.name ?? "GymTrack member"}</strong>
              <span>{user.email ?? user.role}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-topbar">
          <div className="topbar-leading">
            <button
              ref={toggleRef}
              type="button"
              className="icon-button mobile-menu-button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-controls="workspace-navigation"
              aria-expanded={mobileOpen}
              onClick={() =>
                setOpenForPath((v) => (v === pathname ? null : pathname))
              }
            >
              {mobileOpen ? (
                <X size={22} aria-hidden />
              ) : (
                <Menu size={22} aria-hidden />
              )}
            </button>
            <div className="topbar-location">
              <span>{workspaceLabel}</span>
              <strong>{active?.label ?? "Workspace"}</strong>
            </div>
          </div>
          <div className="topbar-trailing">
            {user.isDemo ? <span className="badge">Demo mode</span> : null}
            <span className="topbar-role">
              {user.role === "USER"
                ? "Athlete"
                : user.role === "COACH"
                  ? "Coach"
                  : "Admin"}
            </span>
            <span
              className="profile-avatar profile-avatar-small"
              aria-label={`Signed in as ${user.name ?? user.email ?? "member"}`}
            >
              {(user.name ?? user.email ?? "GT").slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          GymTrack Pro · Your progress, your data.
        </footer>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (
    !user ||
    (isPublicPath(pathname) &&
      pathname !== "/exercises" &&
      !pathname.startsWith("/exercises/"))
  )
    return <PublicShell user={user}>{children}</PublicShell>;
  return (
    <WorkspaceShell user={user} pathname={pathname}>
      {children}
    </WorkspaceShell>
  );
}
