"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, ChevronLeft, Compass, House, Inbox, LayoutDashboard, Library, School, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import { Avatar as PhotoAvatar } from "@/components/dash/Avatar";
import type { FeatureMap } from "@/lib/features";
import "./mobile-app.css";

// The phone app (under 860px): a slim top bar, a big title with section switches on the main screens, and five tabs
// at the bottom. No sidebar. Desktop keeps the sidebar layout; Shell renders both and CSS shows the right one.

type Tab = { label: string; href: string; icon: LucideIcon; match: (p: string) => boolean };
type Segment = { label: string; href: string; match: (p: string) => boolean };
type Section = { title: string; match: (p: string) => boolean; segments?: Segment[] };

const starts = (p: string, ...prefixes: string[]) => prefixes.some((x) => p === x || p.startsWith(`${x}/`));

// Campus takes the fourth tab; Messages and Announcements then live on the Me screen. With Campus off, it's Inbox again.
const learnTabs = (inbox: string, campus: boolean): Tab[] => [
  { label: "Home", href: "/learn", icon: House, match: (p) => p === "/learn" },
  { label: "Learn", href: "/learn/courses", icon: BookOpen, match: (p) => starts(p, "/learn/courses", "/learn/browse", "/learn/library", "/profile/saved") },
  { label: "Explore", href: "/learn/explore", icon: Compass, match: (p) => starts(p, "/learn/explore") },
  campus
    ? { label: "Campus", href: "/campus", icon: School, match: (p) => starts(p, "/campus") }
    : { label: "Inbox", href: inbox, icon: Inbox, match: (p) => starts(p, "/learn/messages", "/learn/announcements") },
  {
    label: "Me",
    href: "/me",
    icon: UserRound,
    match: (p) => (starts(p, "/me", "/profile", "/settings", "/support", "/learn/wallet", "/learn/sessions", "/communities") || (campus && starts(p, "/learn/messages", "/learn/announcements"))) && !starts(p, "/profile/saved"),
  },
];

const teachTabs = (canTeach: boolean, coach: boolean, messages: boolean): Tab[] => [
  { label: "Home", href: "/teach", icon: LayoutDashboard, match: (p) => p === "/teach" },
  ...(canTeach
    ? [
        { label: "Courses", href: "/teach/courses", icon: BookOpen, match: (p: string) => starts(p, "/teach/courses", "/teach/products") },
        { label: "Students", href: "/teach/students", icon: Users, match: (p: string) => starts(p, "/teach/students") },
      ]
    : []),
  ...(coach ? [{ label: "Coaching", href: "/teach/coaching", icon: Library, match: (p: string) => starts(p, "/teach/coaching") }] : []),
  ...(messages && canTeach ? [{ label: "Inbox", href: "/teach/messages", icon: Inbox, match: (p: string) => starts(p, "/teach/messages") }] : [{ label: "Earnings", href: "/teach/earnings", icon: Wallet, match: (p: string) => starts(p, "/teach/earnings") }]),
  { label: "Me", href: "/me", icon: UserRound, match: (p) => starts(p, "/me", "/profile", "/settings", "/support") },
];

const sections = (messages: boolean): Section[] => [
  {
    title: "Learn",
    match: (p) => ["/learn/courses", "/learn/browse", "/learn/library", "/profile/saved"].includes(p),
    segments: [
      { label: "My courses", href: "/learn/courses", match: (p) => p === "/learn/courses" },
      { label: "Browse", href: "/learn/browse", match: (p) => p === "/learn/browse" },
      { label: "Library", href: "/learn/library", match: (p) => p === "/learn/library" },
      { label: "Saved", href: "/profile/saved", match: (p) => p === "/profile/saved" },
    ],
  },
  { title: "Explore", match: (p) => p === "/learn/explore" },
  { title: "Campus", match: (p) => p === "/campus" },
  {
    title: "Inbox",
    match: (p) => p === "/learn/messages" || p === "/learn/announcements",
    segments: messages
      ? [
          { label: "Messages", href: "/learn/messages", match: (p) => p === "/learn/messages" },
          { label: "Announcements", href: "/learn/announcements", match: (p) => p === "/learn/announcements" },
        ]
      : undefined,
  },
  {
    title: "Courses",
    match: (p) => p === "/teach/courses" || p === "/teach/products",
    segments: [
      { label: "Courses", href: "/teach/courses", match: (p) => p === "/teach/courses" },
      { label: "Products", href: "/teach/products", match: (p) => p === "/teach/products" },
    ],
  },
];

// Screens a tab opens (no back arrow). Everything else is a pushed screen with a back arrow.
const rootPaths = ["/learn", "/teach", "/me", "/campus", "/learn/explore", "/learn/courses", "/learn/browse", "/learn/library", "/profile/saved", "/learn/messages", "/learn/announcements", "/teach/courses", "/teach/products", "/teach/students", "/teach/messages", "/teach/coaching", "/teach/earnings"];

export function mobileTabs({ teach, canTeach, coach, features }: { teach: boolean; canTeach: boolean; coach: boolean; features: Partial<FeatureMap> }) {
  const messages = features.messages !== false;
  return teach ? teachTabs(canTeach, coach, messages) : learnTabs(messages ? "/learn/messages" : "/learn/announcements", features.campus !== false);
}

export function MobileTabBar({ pathname, tabs }: { pathname: string; tabs: Tab[] }) {
  return (
    <div className="et-mdock">
    <nav className="et-mtabs" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(({ label, href, icon: Icon, match }) => {
        const on = match(pathname);
        return (
          <Link key={label} href={href} className={on ? "is-active" : undefined} aria-current={on ? "page" : undefined} data-tour={href}>
            <Icon size={23} strokeWidth={on ? 2.2 : 1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
    </div>
  );
}

// Top bar: back arrow on pushed screens, a small title that fades in once the big title scrolls away, and on Home the
// logo with Inbox and your photo.
export function MobileTopBar({
  pathname,
  tabs,
  user,
  features,
}: {
  pathname: string;
  tabs: Tab[];
  user: { name: string; avatarUrl: string | null; initial: string };
  features: Partial<FeatureMap>;
}) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [title, setTitle] = useState("");
  const home = pathname === "/learn" || pathname === "/teach";
  const root = rootPaths.includes(pathname);
  const section = sections(features.messages !== false).find((s) => s.match(pathname));

  useEffect(() => {
    const main = document.querySelector(".et-main");
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 56);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    // The screen's own heading becomes the small title. Watched, because the new page can render after this runs.
    const read = () => {
      setTitle(section?.title ?? main.querySelector(":is(.et-page-head,.et-tab-head) h1")?.textContent ?? "");
      // A tab strip wider than the screen scrolls; bring the open tab into view so the strip shows where you are.
      // Only the strip moves sideways; the page itself stays put.
      const on = main.querySelector<HTMLElement>(":is(.et-seg,.et-mseg) .is-on");
      const strip = on?.parentElement;
      if (on && strip) strip.scrollLeft += on.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - on.offsetWidth) / 2;
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(main, { childList: true, subtree: true });
    const stop = setTimeout(() => watch.disconnect(), 4000);
    return () => {
      main.removeEventListener("scroll", onScroll);
      watch.disconnect();
      clearTimeout(stop);
    };
  }, [pathname, section?.title]);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(tabs.find((t) => t.match(pathname))?.href ?? tabs[0].href);
  };

  return (
    <header className={`et-mtop${scrolled ? " is-scrolled" : ""}`}>
      <div className="et-mtop-side">
        {home ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/etiviologo.svg" alt="Etivio" className="et-mtop-logo" />
        ) : !root ? (
          <button type="button" className="et-mtop-back" onClick={back} aria-label="Back">
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
      <b className={`et-mtop-title${scrolled || (!root && !home) ? " is-on" : ""}`}>{home ? "" : title}</b>
      <div className="et-mtop-side is-right">
        {home && (
          <>
            <Link href={tabs.find((t) => t.label === "Inbox")?.href ?? "/learn/announcements"} className="et-mtop-icon" aria-label="Inbox">
              <Bell size={21} />
            </Link>
            <Link href="/me" className="et-mtop-me" aria-label="Me">
              <PhotoAvatar src={user.avatarUrl} initial={user.initial} seed={user.name} className="et-mtop-avatar" />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

// Big title and section switches at the top of a tab's main screens.
export function MobileSection({ pathname, features }: { pathname: string; features: Partial<FeatureMap> }) {
  const section = sections(features.messages !== false).find((s) => s.match(pathname));
  if (!section) return null;
  return (
    <div className="et-msection">
      <h1>{section.title}</h1>
      {section.segments && (
        <nav className="et-mseg" aria-label={section.title}>
          {section.segments.map((s) => (
            <Link key={s.href} href={s.href} className={s.match(pathname) ? "is-on" : undefined} replace>
              {s.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
