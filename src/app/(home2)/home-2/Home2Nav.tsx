"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  GraduationCap,
  LifeBuoy,
  Mail,
  Menu,
  MessagesSquare,
  Newspaper,
  Scale,
  Sparkles,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";

type Item = { href: string; icon: typeof BookOpen; title: string; body: string; tag?: string };
type Mega = {
  id: string;
  label: string;
  columns: { title: string; items: Item[] }[];
  card: { kicker: string; body: string; title: string; tone: string; href: string; cta: string };
};

const MENUS: Mega[] = [
  {
    id: "platform",
    label: "Platform",
    columns: [
      {
        title: "Learn",
        items: [
          { href: "/explore", icon: BookOpen, title: "Courses", body: "Practical courses with lessons, quizzes and a certificate at the end." },
          { href: "#communities", icon: Users, title: "Communities", body: "Join people learning the same things as you, or start your own." },
          { href: "#campus", icon: MessagesSquare, title: "Campus", body: "The Etivio feed. Share wins, ask questions and mention classmates.", tag: "New" },
          { href: "#features", icon: Sparkles, title: "Etivio AI", body: "A study partner that explains, quizzes you and knows your lessons." },
        ],
      },
      {
        title: "Grow",
        items: [
          { href: "/coaches", icon: Video, title: "Coaches", body: "Book a 1-on-1 video session for advice, reviews or a push." },
          { href: "/tutors", icon: GraduationCap, title: "Tutors", body: "Meet the people who teach on Etivio and see what they offer." },
          { href: "/certificate", icon: BadgeCheck, title: "Certificates", body: "Every certificate has an ID anyone can check in seconds." },
          { href: "/teach-on-etivio", icon: Wallet, title: "Teach and earn", body: "Sell courses, templates and e-books, and get paid out to your bank." },
        ],
      },
    ],
    card: {
      kicker: "Start for free",
      body: "Create an account, set your learning goals and get course and community picks made for you.",
      title: "Your next skill starts today.",
      tone: "is-blue",
      href: "/signup",
      cta: "Create your account",
    },
  },
  {
    id: "resources",
    label: "Resources",
    columns: [
      {
        title: "Resources",
        items: [
          { href: "/blog", icon: Newspaper, title: "Blog", body: "Stories, guides and news from the Etivio team and our tutors." },
          { href: "/help", icon: LifeBuoy, title: "Help centre", body: "Answers about accounts, payments, courses and certificates." },
          { href: "/explore?type=template", icon: FileText, title: "Templates and e-books", body: "Ready-made tools and guides from creators across Africa." },
          { href: "/explore", icon: Compass, title: "Explore", body: "Browse everything on the Etivio marketplace in one place." },
        ],
      },
      {
        title: "Company",
        items: [
          { href: "/about", icon: Users, title: "About us", body: "Who we are, why we built Etivio and where we are heading." },
          { href: "/coaches/apply", icon: Video, title: "Become a coach", body: "Share what you know in paid 1-on-1 sessions on your own hours.", tag: "Now open" },
          { href: "/contact", icon: Mail, title: "Contact", body: "Questions, partnerships or press. Our team will get back to you." },
          { href: "/terms", icon: Scale, title: "Legal", body: "Our terms, privacy policy and refund policy." },
        ],
      },
    ],
    card: {
      kicker: "Teach on Etivio",
      body: "Build a course with our tools, set your price and reach learners across Africa.",
      title: "Know something worth teaching? Get paid for it.",
      tone: "is-amber",
      href: "/teach-on-etivio",
      cta: "Start teaching",
    },
  },
];

// Solid colour behind each menu icon, so every item reads at a glance.
const ICON_COLORS: Record<string, string> = {
  Courses: "#2563eb",
  Communities: "#15803d",
  Campus: "#7c3aed",
  "Etivio AI": "#0891b2",
  Coaches: "#e11d48",
  Tutors: "#4f46e5",
  Certificates: "#0d9488",
  "Teach and earn": "#ea580c",
  Blog: "#db2777",
  "Help centre": "#0284c7",
  "Templates and e-books": "#9333ea",
  Explore: "#16a34a",
  "About us": "#1d4ed8",
  "Become a coach": "#e11d48",
  Contact: "#0f766e",
  Legal: "#475569",
};

const LINKS = [
  { href: "/explore", label: "Courses" },
  { href: "/coaches", label: "Coaches" },
  { href: "/teach-on-etivio", label: "Teach" },
];

// Sticky header for Home 2 with mega menus. Menus open on hover or click; on phones everything folds into a sheet.
export function Home2Nav() {
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const closer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open && !mega) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setMega(null);
    };
    const onOutside = (e: PointerEvent) => !header.current?.contains(e.target as Node) && setMega(null);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, mega]);

  // A short delay before closing lets the pointer cross the gap between the trigger and the panel.
  const show = (id: string) => {
    if (closer.current) clearTimeout(closer.current);
    setMega(id);
  };
  const hide = () => {
    if (closer.current) clearTimeout(closer.current);
    closer.current = setTimeout(() => setMega(null), 140);
  };

  const active = MENUS.find((m) => m.id === mega);

  return (
    <header className={`et-h2-nav${active ? " is-mega" : ""}`} ref={header} onPointerLeave={(e) => e.pointerType === "mouse" && hide()}>
      <div className="et-h2-nav-in">
        <Link href="/home-2" className="et-h2-logo" aria-label="Etivio home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" />
        </Link>
        <nav className="et-h2-links" aria-label="Main">
          {MENUS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mega === m.id ? "is-on" : ""}
              aria-expanded={mega === m.id}
              aria-controls={`et-h2-mega-${m.id}`}
              onClick={() => setMega(mega === m.id ? null : m.id)}
              onPointerEnter={(e) => e.pointerType === "mouse" && show(m.id)}
            >
              {m.label} <ChevronDown size={15} aria-hidden="true" />
            </button>
          ))}
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onPointerEnter={(e) => e.pointerType === "mouse" && hide()}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="et-h2-nav-cta">
          <Link href="/login" className="et-h2-btn is-ghost">
            Log in
          </Link>
          <Link href="/signup" className="et-h2-btn is-ink">
            Get started <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button type="button" className="et-h2-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {active && (
        <div className="et-h2-mega" id={`et-h2-mega-${active.id}`} onPointerEnter={() => show(active.id)}>
          {active.columns.map((col) => (
            <div key={col.title} className="et-h2-mega-col">
              <span className="et-h2-mega-title">{col.title}</span>
              {col.items.map(({ href, icon: Icon, title, body, tag }) => (
                <Link key={title} href={href} className="et-h2-mega-item" onClick={() => setMega(null)}>
                  <span className="et-h2-mega-icon" style={{ ["--c" as string]: ICON_COLORS[title] }}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <b>
                      {title}
                      {tag && <em>{tag}</em>}
                    </b>
                    <small>{body}</small>
                  </span>
                </Link>
              ))}
            </div>
          ))}
          <aside className="et-h2-mega-card">
            <b>{active.card.kicker}</b>
            <p>{active.card.body}</p>
            <div className={`et-h2-mega-art ${active.card.tone}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/etivio-mark.svg" alt="" />
              <strong>{active.card.title}</strong>
            </div>
            <Link href={active.card.href} className="et-h2-mega-more" onClick={() => setMega(null)}>
              {active.card.cta} <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      )}

      {open && (
        <nav className="et-h2-sheet" aria-label="Menu">
          {MENUS.flatMap((m) => m.columns).map((col) => (
            <div key={col.title} className="et-h2-sheet-group">
              <span className="et-h2-mega-title">{col.title}</span>
              {col.items.map(({ href, icon: Icon, title }) => (
                <Link key={title} href={href} onClick={() => setOpen(false)}>
                  <span className="et-h2-mega-icon" style={{ ["--c" as string]: ICON_COLORS[title] }}>
                    <Icon size={17} />
                  </span>
                  {title}
                </Link>
              ))}
            </div>
          ))}
          <Link href="/login" className="et-h2-btn is-line is-lg" onClick={() => setOpen(false)}>
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
