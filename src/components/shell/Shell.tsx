"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FileText,
  LifeBuoy,
  MessagesSquare,
  Newspaper,
  ShieldCheck,
  Wallet,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Plus,
  Presentation,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  X,
  type LucideIcon,
  Heart,
  Mail,
  FolderDown,
  Store,
  House,
} from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";
import { signOut } from "@/app/(app)/actions";
import { adminSignOut } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import TipLayer from "./TipLayer";
import { BadgeCelebration } from "@/components/dash/BadgeCelebration";
import { Onboarding } from "@/components/dash/Onboarding";
import { ROLE_LABELS, canAccess, canTeach, isStaff, primaryRole, type AdminArea, type AppRole } from "@/lib/roles";
import { Avatar as PhotoAvatar } from "@/components/dash/Avatar";
import { CartButton } from "@/components/market/CartButton";

export type ShellUser = { id: string; name: string; email: string; roles: AppRole[]; avatarUrl: string | null; showTeach?: boolean };
type SubItem = { label: string; href: string; badge?: number };
type Item = { label: string; href: string; icon: LucideIcon; exact?: boolean; badge?: number; area?: AdminArea; children?: SubItem[] };
type Group = { label: string; items: Item[] };

const account: Group = {
  label: "Account",
  items: [
    { label: "Profile", href: "/profile", icon: UserRound },
    { label: "Support", href: "/support", icon: LifeBuoy },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};

const adminNav = (roles: AppRole[], badges: Record<string, number>): Group[] =>
  (
    [
      { label: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true, area: "dashboard" }] },
      {
        label: "Manage",
        items: [
          { label: "Users", href: "/admin/users", icon: Users, area: "users", badge: badges.applications },
          {
            label: "Courses",
            href: "/admin/courses",
            icon: BookOpen,
            area: "courses",
            badge: badges.reviews,
            children: [
              { label: "All courses", href: "/admin/courses" },
              { label: "New course", href: "/admin/courses/new" },
              { label: "Categories", href: "/admin/courses/categories" },
              { label: "Students", href: "/admin/courses/students" },
              { label: "Course metrics", href: "/admin/courses/metrics" },
              { label: "Quizzes", href: "/admin/courses/quizzes" },
              { label: "Reviews", href: "/admin/courses/reviews", badge: badges.reviews },
              { label: "Certificates", href: "/admin/courses/certificates" },
            ],
          },
          {
            label: "Marketplace",
            href: "/admin/marketplace",
            icon: Store,
            area: "marketplace",
            badge: badges.products,
            children: [
              { label: "All products", href: "/admin/marketplace" },
              { label: "New product", href: "/admin/marketplace/new" },
              { label: "Needs review", href: "/admin/marketplace?status=pending", badge: badges.products },
              { label: "Orders", href: "/admin/marketplace/orders" },
            ],
          },
          { label: "Announcements", href: "/admin/announcements", icon: Megaphone, area: "announcements" },
          {
            label: "Blog",
            href: "/admin/blog",
            icon: Newspaper,
            area: "blog",
            badge: badges.comments,
            children: [
              { label: "All posts", href: "/admin/blog" },
              { label: "New post", href: "/admin/blog/new" },
              { label: "Categories", href: "/admin/blog/categories" },
              { label: "Archives", href: "/admin/blog/archives" },
              { label: "Post metrics", href: "/admin/blog/metrics" },
              { label: "Comments", href: "/admin/blog/comments", badge: badges.comments },
              { label: "Curated", href: "/admin/blog/curated" },
            ],
          },
          { label: "Documents", href: "/admin/documents", icon: FileText, area: "documents" },
          { label: "Chats", href: "/admin/chats", icon: MessagesSquare, area: "chats", badge: badges.chats },
        ],
      },
      {
        label: "Insights",
        items: [
          { label: "Tracking", href: "/admin/tracking", icon: BarChart3, area: "tracking" },
          { label: "Financials", href: "/admin/financials", icon: Wallet, area: "financials" },
        ],
      },
      {
        label: "System",
        items: [
          { label: "Team", href: "/admin/team", icon: ShieldCheck, area: "team" },
          {
            label: "Emails",
            href: "/admin/emails",
            icon: Mail,
            area: "emails",
            children: [
              { label: "Overview", href: "/admin/emails" },
              { label: "Templates", href: "/admin/emails/templates" },
            ],
          },
          { label: "Settings", href: "/admin/settings", icon: Settings, area: "settings" },
        ],
      },
    ] satisfies Group[]
  )
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(roles, i.area)) }))
    .filter((g) => g.items.length);

const learnNav: Group[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/learn", icon: LayoutDashboard, exact: true },
      { label: "Announcements", href: "/learn/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "My courses", href: "/learn/courses", icon: Library },
      { label: "Browse courses", href: "/learn/browse", icon: Compass },
      { label: "Library", href: "/learn/library", icon: FolderDown },
      { label: "Saved", href: "/profile/saved", icon: Heart },
      { label: "Marketplace", href: "/explore", icon: Store },
    ],
  },
  account,
];

const teachNav = (canTeach: boolean): Group[] => [
  { label: "Overview", items: [{ label: "Dashboard", href: "/teach", icon: LayoutDashboard, exact: true }] },
  ...(canTeach
    ? [
        {
          label: "Teaching",
          items: [
            { label: "Courses", href: "/teach/courses", icon: BookOpen, exact: true },
            { label: "New course", href: "/teach/courses/new", icon: Plus },
            { label: "Products", href: "/teach/products", icon: Store },
            { label: "Students", href: "/teach/students", icon: Users },
            { label: "Earnings", href: "/teach/earnings", icon: Wallet },
          ],
        },
      ]
    : []),
  account,
];

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export default function Shell({
  user,
  mode = "app",
  badges = {},
  unseenBadges = "",
  needsOnboarding = false,
  children,
}: {
  user: ShellUser;
  mode?: "app" | "admin";
  badges?: Record<string, number>;
  // Comma-joined ids of earned-but-uncelebrated badges, from the server layout.
  unseenBadges?: string;
  // Show the welcome guide (new learners, until finished or skipped).
  needsOnboarding?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const admin = mode === "admin";
  const { light } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  // Captured once: stays open through the guide's final screen even after the server marks it done.
  const [guideOpen, setGuideOpen] = useState(needsOnboarding);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const profileRef = useOutside<HTMLDivElement>(profileOpen, () => setProfileOpen(false));
  const userRef = useOutside<HTMLDivElement>(userOpen, () => setUserOpen(false));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCollapsed(false);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Page views feed admin tracking. Admin pages aren't tracked, and the same page isn't sent again
  // within 10 minutes (the database skips those too) to keep the table small.
  useEffect(() => {
    if (admin) return;
    try {
      const seen = JSON.parse(sessionStorage.getItem("et-views") ?? "{}") as Record<string, number>;
      if (Date.now() - (seen[pathname] ?? 0) < 10 * 60_000) return;
      seen[pathname] = Date.now();
      sessionStorage.setItem("et-views", JSON.stringify(seen));
    } catch {}
    createClient()
      .from("activity_events")
      .insert({ user_id: user.id, type: "page_view", path: pathname })
      .then(() => {});
  }, [admin, pathname, user.id]);

  const teachMode = pathname.startsWith("/teach");
  const groups = admin ? adminNav(user.roles, badges) : teachMode ? teachNav(canTeach(user.roles)) : learnNav;
  const matches = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));
  const flat = groups.flatMap((g) => g.items);
  // When two links match (Profile and Saved on /profile/saved), only the more specific one lights up.
  const isActive = (i: Item) => matches(i) && !flat.some((o) => o !== i && o.href.length > i.href.length && o.href.startsWith(`${i.href}/`) && matches(o));
  const results = search ? flat.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) : null;

  const display = user.name || user.email;
  const first = display.split(/[\s@]/)[0];
  const initial = display.charAt(0).toUpperCase();

  return (
    <div className={`et-app${light ? " is-light" : ""}${collapsed ? " is-collapsed" : ""}`}>
      {mobileOpen && <button className="et-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`et-sidebar${mobileOpen ? " is-open" : ""}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMobileOpen(false);
        }}
      >
        <div className="et-sidebar-top">
          <Link href={admin ? "/admin" : "/learn"} className="et-brand" title="Etivio">
            <img src="/etivio-mark.svg" alt="" className="et-brand-mark" />
            <span className="et-brand-text">
              <img src="/etiviologo.svg" alt="Etivio" className="et-brand-logo" />
              <small>{admin ? ROLE_LABELS[primaryRole(user.roles)] : teachMode ? "Teach" : "Learn"}</small>
            </span>
          </Link>
          <button
            className="et-icon-btn et-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
          <button className="et-icon-btn et-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="et-nav" aria-label="Dashboard navigation">
          {!admin && user.showTeach && <div className="et-switch" role="tablist" aria-label="Switch dashboard">
            <Link href="/learn" role="tab" aria-selected={!teachMode} className={teachMode ? "" : "is-on"}>
              <GraduationCap size={13} />
              Learn
            </Link>
            <Link href="/teach" role="tab" aria-selected={teachMode} className={teachMode ? "is-on" : ""}>
              <Presentation size={13} />
              Teach
            </Link>
          </div>}
          <div className="et-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              aria-label="Search menu"
            />
            <kbd>⌘K</kbd>
          </div>
          {results
            ? results.length
              ? results.map((i) => <NavLink key={i.href} item={i} active={isActive(i)} />)
              : <p className="et-nav-empty">No results</p>
            : groups.map((g, gi) => (
                <div key={g.label} className="et-nav-group">
                  {gi > 0 && <p className="et-nav-label">{g.label}</p>}
                  {g.items.map((i) =>
                    i.children ? (
                      <NavGroup key={i.href} item={i} active={isActive(i)} pathname={pathname} />
                    ) : (
                      <NavLink key={i.href} item={i} active={isActive(i)} />
                    ),
                  )}
                </div>
              ))}
        </nav>

        <div className="et-sidebar-foot" ref={userRef}>
          <button className="et-user" onClick={() => setUserOpen((v) => !v)}>
            <Avatar user={user} initial={initial} />
            <span className="et-user-text">
              <strong>{user.name || "Your account"}</strong>
              <small>{user.email}</small>
            </span>
            <ChevronDown size={13} className={`et-chev${userOpen ? " is-open" : ""}`} />
          </button>
          {userOpen && (
            <div className="et-menu et-menu-up">
              <MenuBody user={user} initial={initial} admin={admin} close={() => setUserOpen(false)} />
            </div>
          )}
        </div>
      </aside>

      <div className="et-body">
        <header className="et-header">
          <div className="et-header-left">
            <button className="et-icon-btn et-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
            <p>
              Welcome back, <span>{first}</span>
            </p>
          </div>
          <div className="et-header-right">
            {!admin && <CartButton />}
            <button
              className="et-icon-btn"
              onClick={() => writeTheme(!light)}
              aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
              data-tip={light ? "Dark mode" : "Light mode"}
            >
              {light ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <span className="et-header-divider" />
            <div className="et-profile" ref={profileRef}>
              <button className="et-profile-btn" onClick={() => setProfileOpen((v) => !v)} aria-label="Account menu">
                <Avatar user={user} initial={initial} />
                <ChevronDown size={13} className={`et-chev${profileOpen ? " is-open" : ""}`} />
              </button>
              {profileOpen && (
                <div className="et-menu et-menu-down">
                  <MenuBody user={user} initial={initial} admin={admin} close={() => setProfileOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={`et-main${admin ? "" : " has-bottom-nav"}`}>{children}</main>
        {!admin && <BottomNav pathname={pathname} />}
        <TipLayer />
        {!admin && guideOpen && <Onboarding name={user.name || user.email} onClosed={() => setGuideOpen(false)} />}
        {/* Badge celebrations wait until the welcome guide is out of the way. */}
        {!admin && !guideOpen && <BadgeCelebration trigger={unseenBadges} />}
      </div>
    </div>
  );
}

// Phone navigation for learners: the four places people go most. Everything else is in the menu.
const BOTTOM_NAV: { label: string; href: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { label: "Home", href: "/learn", icon: House, match: (p) => p === "/learn" },
  { label: "Courses", href: "/learn/courses", icon: BookOpen, match: (p) => /^\/learn\/(courses|browse)(\/|$)/.test(p) },
  { label: "Profile", href: "/profile", icon: UserRound, match: (p) => p === "/profile" || p.startsWith("/profile/") },
  { label: "Settings", href: "/settings", icon: Settings, match: (p) => p === "/settings" || p.startsWith("/settings/") },
];

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="et-bottom-nav" aria-label="Main">
      {BOTTOM_NAV.map(({ label, href, icon: Icon, match }) => {
        const on = match(pathname);
        return (
          <Link key={href} href={href} className={on ? "is-active" : undefined} aria-current={on ? "page" : undefined}>
            <Icon size={21} strokeWidth={on ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} title={item.label} className={`et-nav-item${active ? " is-active" : ""}`}>
      <Icon size={17} strokeWidth={1.8} />
      <span className="et-nav-text">{item.label}</span>
      {item.badge ? <span className="et-count">{item.badge}</span> : null}
    </Link>
  );
}

// A nav item with a dropdown of sub-pages (Blog). Opens by itself while you're inside that section.
function NavGroup({ item, active, pathname }: { item: Item; active: boolean; pathname: string }) {
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }
  const Icon = item.icon;
  return (
    <div className="et-nav-tree">
      <button type="button" title={item.label} className={`et-nav-item${active ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon size={17} strokeWidth={1.8} />
        <span className="et-nav-text">{item.label}</span>
        {item.badge && !open ? <span className="et-count">{item.badge}</span> : null}
        <ChevronDown size={13} className={`et-nav-chev${open ? " is-open" : ""}`} />
      </button>
      {open && (
        <div className="et-nav-sub">
          {item.children!.map((c) => {
            const on = pathname === c.href || (c.href !== item.href && pathname.startsWith(`${c.href}/`)) || (c.href === item.href && new RegExp(`^${item.href}/[0-9a-f-]{36}(/|$)`).test(pathname));
            return (
              <Link key={c.href} href={c.href} className={on ? "is-active" : ""} aria-current={on ? "page" : undefined}>
                {c.label}
                {c.badge ? <span className="et-count">{c.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Avatar({ user, initial, size }: { user: ShellUser; initial: string; size?: "lg" }) {
  return <PhotoAvatar src={user.avatarUrl} initial={initial} className={`et-avatar${size ? ` et-avatar-${size}` : ""}`} />;
}

function MenuBody({ user, initial, admin, close }: { user: ShellUser; initial: string; admin: boolean; close: () => void }) {
  return (
    <>
      <div className="et-menu-head">
        <Avatar user={user} initial={initial} size="lg" />
        <div>
          <strong>{user.name || "Your account"}</strong>
          <small>{user.email}</small>
          {user.roles.some((r) => r !== "student") && <em>{user.roles.filter((r) => r !== "student").map((r) => ROLE_LABELS[r]).join(" · ")}</em>}
        </div>
      </div>
      {!admin && (
        <Link href="/profile" onClick={close} className="et-menu-item">
          <UserRound size={16} />
          Your profile
        </Link>
      )}
      <Link href={admin ? "/admin/settings" : "/settings"} onClick={close} className="et-menu-item">
        <Settings size={16} />
        Settings
      </Link>
      {admin ? (
        <Link href="/learn" onClick={close} className="et-menu-item">
          <GraduationCap size={16} />
          Open learner app
        </Link>
      ) : (
        isStaff(user.roles) && (
          <Link href="/admin" onClick={close} className="et-menu-item">
            <ShieldCheck size={16} />
            Admin dashboard
          </Link>
        )
      )}
      <div className="et-menu-sep" />
      <form action={admin ? adminSignOut : signOut}>
        <button type="submit" className="et-menu-item et-menu-danger">
          <LogOut size={16} />
          Sign out
        </button>
      </form>
    </>
  );
}
