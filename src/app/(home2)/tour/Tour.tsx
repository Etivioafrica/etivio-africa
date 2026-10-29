"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Bell,
  BookCheck,
  Check,
  ChevronDown,
  ChevronsLeft,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  FolderDown,
  Globe,
  GraduationCap,
  Heart,
  ImagePlus,
  Layers,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Link2,
  ListPlus,
  Megaphone,
  MessagesSquare,
  Moon,
  PenLine,
  PlayCircle,
  Presentation,
  School,
  Search,
  Settings,
  ShoppingCart,
  Smile,
  Store,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { AiAvatar } from "@/components/learn/AiAvatar";
import { WelcomeHero } from "@/components/dash/WelcomeHero";
import { LearnBoard } from "@/components/dash/LearnBoard";
import type { Task } from "@/components/dash/LearnBoardClient";
import { BadgeSeal, Badges } from "@/components/dash/Badges";
import { ProfileHero } from "@/components/dash/ProfileView";
import { StatStrip } from "@/components/dash/ui";
import { PlayerFrame, type OutlineModule } from "@/components/learn/PlayerFrame";
import { LessonVideo } from "@/components/learn/LessonVideo";
import { LessonCompleteButton } from "@/components/learn/LessonCompleteButton";
import { PostCard, type CampusViewer } from "@/app/(app)/campus/PostCard";
import { KIND_STYLE } from "@/app/(app)/campus/kinds";
import { BADGE_INFO } from "@/lib/badges";
import type { CampusAuthor, CampusKind, CampusPost } from "@/lib/data/campus";
import type { CourseCard, MyCourse } from "@/lib/data/learn";
import type { HeatCell } from "@/lib/activity";
import type { ProfileDetails } from "@/lib/data/profile";
import "../../(app)/app.css";
import "../../(app)/campus/campus.css";
import "../../(auth)/auth.css";
import "./tour.css";

// The home page's product tour, played inside an iframe so the app's own CSS sees a desktop-sized window. Everything
// on screen is the real app: its components where they render without a session, and its exact markup and classes
// where they don't. A cursor walks a new learner from sign up to watching a lesson.

type SceneId = "intro" | "signup" | "welcome" | "username" | "badge" | "profile" | "campus" | "dashboard" | "player";
// `aim` moves the cursor to the first element matching that selector, `click` taps, `fx` turns on an effect, and
// `scroll` scrolls the app's main area to that position.
type Step = { at: number; aim?: string; click?: boolean; fx?: string; scroll?: number };
type Scene = { id: SceneId; chapter: number; length: number; steps: Step[] };

export const CHAPTERS = ["Sign up", "Username", "Badge", "Profile", "Campus", "Learn"];

const SCENES: Scene[] = [
  { id: "intro", chapter: 0, length: 6800, steps: [] },
  {
    id: "signup",
    chapter: 0,
    length: 7600,
    steps: [
      { at: 300, aim: "[data-demo=name]" },
      { at: 900, click: true, fx: "name" },
      { at: 1900, aim: "[data-demo=email]" },
      { at: 2400, click: true, fx: "email" },
      { at: 3800, aim: "[data-demo=pw]" },
      { at: 4300, click: true, fx: "pw" },
      { at: 5200, aim: ".et-auth-submit" },
      { at: 5800, click: true, fx: "submit" },
    ],
  },
  { id: "welcome", chapter: 1, length: 1800, steps: [] },
  {
    id: "username",
    chapter: 1,
    length: 7000,
    steps: [
      { at: 700, aim: ".et-ob-handle input" },
      { at: 1300, click: true, fx: "typing" },
      { at: 2700, fx: "available" },
      { at: 3500, aim: ".et-ob-username-foot .et-btn" },
      { at: 4200, click: true, fx: "claimed" },
    ],
  },
  {
    id: "badge",
    chapter: 2,
    length: 8600,
    steps: [
      { at: 6200, aim: ".et-celebrate-actions .et-btn-primary" },
      { at: 7400, click: true },
    ],
  },
  {
    id: "profile",
    chapter: 3,
    length: 9800,
    steps: [
      { at: 700, aim: ".et-pf-actions .et-btn-primary" },
      { at: 1400, click: true, fx: "photo" },
      { at: 2000, fx: "headline" },
      { at: 3000, fx: "bio" },
      { at: 5600, fx: "skills" },
      { at: 6600, aim: "[data-demo=copy]" },
      { at: 7300, click: true, fx: "copied" },
    ],
  },
  {
    id: "campus",
    chapter: 4,
    length: 13000,
    steps: [
      { at: 700, aim: ".et-cps-area textarea" },
      { at: 1300, click: true, fx: "open" },
      { at: 1900, aim: ".et-cps-types .is-win" },
      { at: 2500, click: true, fx: "win" },
      { at: 2900, fx: "typing" },
      { at: 5000, aim: ".et-cps-post-btn" },
      { at: 5600, click: true, fx: "posted" },
      { at: 7000, scroll: 700, fx: "play" },
      { at: 9800, scroll: 1500 },
    ],
  },
  {
    id: "dashboard",
    chapter: 5,
    length: 4600,
    steps: [
      { at: 2600, aim: ".et-lb-course .et-lb-resume" },
      { at: 3900, click: true },
    ],
  },
  {
    id: "player",
    chapter: 5,
    length: 11000,
    steps: [
      { at: 600, fx: "play" },
      { at: 5000, aim: ".et-pl-bar .et-btn-primary" },
      { at: 5800, click: true, fx: "done" },
    ],
  },
];

// When each chapter starts, and how long it runs (the parent page's tabs show this as a progress bar).
const chapterStart = (c: number) => SCENES.findIndex((s) => s.chapter === c);
const chapterLeft = (i: number) => SCENES.slice(i).filter((s) => s.chapter === SCENES[i].chapter).reduce((n, s) => n + s.length, 0);

// Loaded in the browser only (the tour's scenes after the intro never render on the server), so times are relative
// to when the visitor opened the page.
const T0 = typeof window === "undefined" ? 0 : Date.now();
const ago = (minutes: number) => new Date(T0 - minutes * 60_000).toISOString();

const ADA = { name: "Praise Eniola", first: "Praise", email: "praise.eniola@gmail.com", photo: "/home2/people-1.jpg", username: "praiseeniola" };
const BIO = "Designer in Lagos learning UI and product design. I love turning messy ideas into simple screens people enjoy using.";
const POST = "Just passed my first quiz on Etivio! 92% on Colour theory. Thanks @tobi for the tips 🎉 #uidesign";

function useTyped(text: string, on: boolean, speed = 45) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => clearInterval(t);
  }, [on, text, speed]);
  return on ? text.slice(0, n) : "";
}

export function Tour() {
  const cam = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const [fx, setFx] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState({ x: 900, y: 620 });
  const [tap, setTap] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Recording mode (/tour?wait): a blank screen until told to play, so a capture starts right at the intro.
  const [held, setHeld] = useState(false);
  const current = SCENES[scene];

  const go = useCallback((i: number) => {
    setFx(new Set());
    setScene(i);
  }, []);

  // The home page says when the tour is on screen, and which chapter a visitor picked.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "et-tour") return;
      if (typeof e.data.play === "boolean") {
        setPlaying(e.data.play);
        if (e.data.play) setHeld(false);
      }
      if (typeof e.data.chapter === "number") go(chapterStart(e.data.chapter));
    };
    window.addEventListener("message", on);
    // Opened on its own (not in the home page), it just plays.
    const wait = new URLSearchParams(window.location.search).has("wait");
    const alone = window.parent === window ? window.setTimeout(() => (wait ? setHeld(true) : setPlaying(true)), 0) : 0;
    if (!alone) window.parent.postMessage({ type: "et-tour", ready: true }, window.location.origin);
    return () => {
      window.removeEventListener("message", on);
      clearTimeout(alone);
    };
  }, [go]);

  // Tell the home page which chapter is showing, so its tabs follow along.
  useEffect(() => {
    if (window.parent === window) return;
    const first = SCENES.findIndex((s) => s.chapter === current.chapter) === scene;
    window.parent.postMessage({ type: "et-tour", at: current.chapter, ms: chapterLeft(scene), first }, window.location.origin);
  }, [scene, current.chapter]);

  useEffect(() => {
    if (!playing) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const aim = (selector: string) => {
      const frame = cam.current;
      const el = frame?.querySelector<HTMLElement>(selector);
      if (!frame || !el) return;
      const f = frame.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const s = f.width / frame.offsetWidth;
      setCursor({ x: (r.left - f.left + Math.min(r.width / 2, 70)) / s, y: (r.top - f.top + r.height * 0.6) / s });
    };
    for (const step of current.steps)
      at(step.at, () => {
        if (step.aim) aim(step.aim);
        if (step.click) setTap((t) => t + 1);
        if (step.fx) setFx((f) => new Set(f).add(step.fx!));
        if (step.scroll !== undefined) cam.current?.querySelector(".et-main")?.scrollTo({ top: step.scroll, behavior: "smooth" });
      });
    at(current.length, () => go((scene + 1) % SCENES.length));
    return () => timers.forEach(clearTimeout);
  }, [scene, playing, current, go]);

  const after = (id: SceneId) => scene >= SCENES.findIndex((s) => s.id === id);

  return (
    <div className="et-tour">
      <div ref={cam} className="et-tour-cam" hidden={held}>
        {current.id === "intro" && <Intro />}
        {current.id === "signup" && <Signup fx={fx} />}
        {["welcome", "username", "badge", "dashboard"].includes(current.id) && (
          <Shell active="dashboard" photo={after("profile") ? ADA.photo : null}>
            <Dashboard fresh={current.id !== "dashboard"} />
            {current.id === "username" && <UsernameModal fx={fx} />}
            {current.id === "badge" && <BadgeModal />}
          </Shell>
        )}
        {current.id === "profile" && (
          <Shell active="profile" photo={fx.has("photo") ? ADA.photo : null}>
            <Profile fx={fx} />
          </Shell>
        )}
        {current.id === "campus" && (
          <Shell active="campus" photo={ADA.photo}>
            <Campus fx={fx} />
          </Shell>
        )}
        {current.id === "player" && <Player fx={fx} />}
        <span className={`et-tour-cursor${current.id === "intro" ? " is-hidden" : ""}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden="true">
          {tap > 0 && <i key={tap} />}
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M4 2 L4 19 L8.6 14.6 L11.6 21.4 L14.6 20.1 L11.7 13.4 L18 13.2 Z" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// A blank screen, then the Etivio logo, letter by letter.
function Intro() {
  return (
    <div className="et-tour-intro">
      <div className="et-tour-word">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/etivio-mark.svg" alt="" />
        <span>
          {"etivio".split("").map((c, i) => (
            <i key={i} style={{ animationDelay: `${0.5 + i * 0.09}s` }}>
              {c}
            </i>
          ))}
        </span>
      </div>
      <p>Learn, connect and build your career.</p>
    </div>
  );
}

// The sign up page (AuthFrame + AuthForm in signup mode), in the light theme.
function Signup({ fx }: { fx: Set<string> }) {
  const name = useTyped(ADA.name, fx.has("name"), 55);
  const email = useTyped(ADA.email, fx.has("email"), 40);
  const pw = useTyped("••••••••••", fx.has("pw"), 70);
  return (
    <div className="et-auth is-light">
      <aside className="et-auth-hero">
        <div className="et-auth-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="" className="et-auth-logo" />
          <div className="et-auth-caption">
            <h2>Learn the skills that move you forward.</h2>
            <p>Courses from instructors across Africa, built for how you actually learn.</p>
          </div>
        </div>
      </aside>
      <section className="et-auth-panel">
        <header className="et-auth-top">
          <span />
          <span className="et-auth-theme">
            <Moon size={18} />
          </span>
          <p className="et-auth-switch">
            Already have an account? <a>Sign in</a>
          </p>
        </header>
        <div className="et-auth-main">
          <div className="et-auth-box">
            <h1>Create your account</h1>
            <p className="et-auth-sub">Start learning in minutes. It&apos;s free.</p>
            <button type="button" className="et-auth-google">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
              </svg>
              Sign up with Google
            </button>
            <div className="et-auth-or">
              <span className="et-auth-or-long">or with email</span>
            </div>
            <form onSubmit={(e) => e.preventDefault()}>
              <label>
                Full name
                <input data-demo="name" readOnly tabIndex={-1} value={name} placeholder="Ada Okafor" />
              </label>
              <label>
                Email
                <input data-demo="email" readOnly tabIndex={-1} value={email} placeholder="you@example.com" />
              </label>
              <label>
                Password
                <span className="et-auth-pw">
                  <input data-demo="pw" readOnly tabIndex={-1} value={pw} placeholder="Minimum 8 characters" />
                  <button type="button" tabIndex={-1}>
                    <Eye size={18} />
                  </button>
                </span>
              </label>
              <button type="button" className="et-auth-submit" tabIndex={-1}>
                {fx.has("submit") ? (
                  "Please wait…"
                ) : (
                  <>
                    Create account <ArrowRight size={16} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

// The learner sidebar and header (Shell.tsx), light theme.
const NAV: { label?: string; items: { label: string; icon: LucideIcon; key?: string }[] }[] = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
      { label: "Campus", icon: School, key: "campus" },
      { label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "My courses", icon: Library },
      { label: "Browse courses", icon: Compass },
      { label: "Library", icon: FolderDown },
      { label: "Saved", icon: Heart },
      { label: "Marketplace", icon: Store },
      { label: "Wallet", icon: Wallet },
      { label: "Messages", icon: MessagesSquare },
      { label: "Communities", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", icon: UserRound, key: "profile" },
      { label: "Support", icon: LifeBuoy },
      { label: "Settings", icon: Settings },
    ],
  },
];

function Shell({ active, photo, children }: { active: string; photo: string | null; children: React.ReactNode }) {
  const me = <Avatar src={photo} initial="A" seed={ADA.name} className="et-avatar" />;
  return (
    <div className="et-app is-light">
      <aside className="et-sidebar">
        <div className="et-sidebar-top">
          <span className="et-brand">
            <span className="et-brand-text">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/etiviologo.svg" alt="" className="et-brand-logo" />
              <small>Learn</small>
            </span>
          </span>
          <span className="et-icon-btn et-collapse">
            <ChevronsLeft size={16} />
          </span>
        </div>
        <nav className="et-nav">
          <div className="et-switch">
            <a className="is-on">
              <GraduationCap size={13} /> Learn
            </a>
            <a>
              <Presentation size={13} /> Teach
            </a>
          </div>
          <div className="et-search">
            <Search size={14} />
            <input readOnly tabIndex={-1} placeholder="Search menu…" />
            <kbd>⌘K</kbd>
          </div>
          {NAV.map((g, gi) => (
            <div key={gi} className="et-nav-group">
              {g.label && <p className="et-nav-label">{g.label}</p>}
              {g.items.map((i) => (
                <a key={i.label} className={`et-nav-item${i.key === active ? " is-active" : ""}`}>
                  <i.icon size={17} strokeWidth={1.8} />
                  <span className="et-nav-text">{i.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="et-sidebar-foot">
          <span className="et-user">
            {me}
            <span className="et-user-text">
              <strong>{ADA.name}</strong>
              <small>{ADA.email}</small>
            </span>
            <ChevronDown size={13} className="et-chev" />
          </span>
        </div>
      </aside>
      <div className="et-body">
        <header className="et-header">
          <div className="et-header-left">
            <p>
              Welcome back, <span>{ADA.first}</span>
            </p>
          </div>
          <div className="et-header-right">
            <span className="et-icon-btn">
              <ShoppingCart size={17} />
            </span>
            <span className="et-ai-btn">
              <AiAvatar size={22} />
              <span>Ask AI</span>
            </span>
            <span className="et-icon-btn">
              <MessagesSquare size={17} />
            </span>
            <span className="et-icon-btn">
              <Bell size={17} />
            </span>
            <span className="et-icon-btn">
              <Moon size={17} />
            </span>
            <span className="et-header-divider" />
            <span className="et-profile-btn">
              {me}
              <ChevronDown size={13} className="et-chev" />
            </span>
          </div>
        </header>
        <main className="et-main">{children}</main>
      </div>
    </div>
  );
}

// Dashboard data: an empty one right after sign up, and one a few weeks in.
const weeks = (busy: boolean): HeatCell[][] =>
  Array.from({ length: 30 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const count = busy && w > 8 ? ((w * 7 + d * 3) % 9 > 3 ? ((w + d) % 4) + 1 : 0) : 0;
      return { date: `w${w}d${d}`, count, level: Math.min(4, count) as HeatCell["level"], future: w === 29 && d > 3 };
    }),
  );
const COVERS = ["/home2/people-3.jpg", "/home2/people-6.jpg", "/home2/people-7.jpg", "/home2/people-4.jpg"];
const AVAILABLE: CourseCard[] = [
  ["Product Management Basics", "Ngozi Obi", "beginner", 1200000, 14, 4.8],
  ["Figma in a Weekend", "Tobi Adeyemi", "beginner", 850000, 9, 4.9],
  ["Python for Data", "Kunle Bello", "intermediate", 0, 22, 4.7],
  ["Public Speaking", "Zainab Musa", "beginner", 600000, 11, null],
  ["Excel for Analysts", "Amaka Eze", "intermediate", 900000, 16, 4.6],
].map(([title, instructor, level, priceMinor, lessonCount, rating], i) => ({
  id: `c${i}`,
  title: title as string,
  slug: `c${i}`,
  summary: null,
  coverUrl: COVERS[i % COVERS.length],
  level: level as string,
  priceMinor: priceMinor as number,
  currency: "NGN",
  instructor: instructor as string,
  lessonCount: lessonCount as number,
  category: "Design",
  skills: [],
  rating: rating as number | null,
  reviews: 12,
}));
const CURRENT = {
  id: "ui",
  title: "UI Design Foundations",
  instructor: "Tobi Adeyemi",
  lessonCount: 18,
  done: 11,
  progress: 64,
  secondsLeft: 4800,
  lessonsLeft: 7,
} as MyCourse;

function Dashboard({ fresh }: { fresh: boolean }) {
  const tasks: Task[] = fresh
    ? [
        { key: "u", label: "Choose your username", hint: "So people can find and @mention you", done: false, href: "#" },
        { key: "p", label: "Add a profile photo", hint: "Help people recognise you", done: false, href: "#" },
        { key: "c", label: "Enrol in your first course", hint: "Browse courses from creators across Africa", done: false, href: "#" },
        { key: "s", label: "Say hello on Campus", hint: "Meet learners on the same path", done: false, href: "#" },
        { key: "t", label: "Take the tour", hint: "A quick look around Etivio", done: false, href: "#" },
      ]
    : [
        { key: "a", label: "Continue UI Design Foundations", hint: "7 lessons left", done: false, href: "#" },
        { key: "b", label: "Pass Colour theory quiz", hint: "UI Design Foundations", done: false, href: "#" },
        { key: "c", label: "Join a community", hint: "Meet learners on the same path", done: false, href: "#" },
        { key: "d", label: "Choose your username", hint: "Done", done: true },
        { key: "e", label: "Add a profile photo", hint: "Done", done: true },
        { key: "f", label: "Say hello on Campus", hint: "Done", done: true },
      ];
  return (
    <div className="et-page et-home">
      <WelcomeHero
        name={ADA.first}
        date=""
        message={fresh ? "Find your first course and start learning today. Your progress, badges, and certificates start here." : "You're 64% through UI Design Foundations. Keep going to reach your goal."}
        cta={fresh ? { label: "Browse courses", href: "#" } : { label: "Continue learning", href: "#" }}
        variant="strip"
        avatar={{ src: fresh ? null : ADA.photo, seed: ADA.name }}
        stat={fresh ? null : { value: 64, label: "Overall progress" }}
      />
      <LearnBoard
        current={fresh ? null : CURRENT}
        weeks={weeks(!fresh)}
        secondsLearned={fresh ? 0 : 24000}
        streak={fresh ? 0 : 12}
        quiz={fresh ? { taken: 0, average: 0, highest: 0, lowest: 0, passed: 0 } : { taken: 3, average: 86, highest: 98, lowest: 74, passed: 3 }}
        quizzes={
          fresh
            ? []
            : [
                { id: "q1", title: "Colour theory", courseId: "ui", courseTitle: "UI Design Foundations", questions: 10, passMark: 70 },
                { id: "q2", title: "Spacing systems", courseId: "ui", courseTitle: "UI Design Foundations", questions: 8, passMark: 70 },
              ]
        }
        quizTotal={fresh ? 0 : 5}
        quizPassed={fresh ? 0 : 3}
        tasks={tasks}
        campus={{
          postsToday: 24,
          communities: [
            { id: "1", slug: "a", name: "Designers Lagos", members: 2140, posts: 12, joined: true },
            { id: "2", slug: "b", name: "Data Nigeria", members: 860, posts: 7, joined: false },
          ],
        }}
        campusOn
        badges={fresh ? [] : [{ id: "early", label: "Pioneer" }, { id: "first_lesson", label: "First steps" }, { id: "streak_7", label: "7 day streak" }]}
        next={{ badge: BADGE_INFO.finisher, earned: false, current: fresh ? 0 : 11, target: 18, unit: "lessons" }}
        available={AVAILABLE}
      />
    </div>
  );
}

// Onboarding's first step (Onboarding.tsx, UsernameStep), over the new dashboard.
function UsernameModal({ fx }: { fx: Set<string> }) {
  const handle = useTyped(ADA.username, fx.has("typing"), 70);
  const status = fx.has("available") ? "available" : fx.has("typing") ? "checking" : "idle";
  return (
    <div className="et-tour-scrim">
      <dialog open className="et-modal et-onboarding">
        <div className="et-ob-top">
          <div className="et-ob-progress">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={i === 0 ? "is-on" : ""} />
            ))}
          </div>
        </div>
        <div className="et-ob-body">
          <form className="et-ob-username" onSubmit={(e) => e.preventDefault()}>
            <p className="et-ob-kicker">Welcome to Etivio, {ADA.first}</p>
            <h2>Choose your username</h2>
            <p className="et-ob-sub">It&apos;s how people find and @mention you on Campus, and the link to your public profile. You can change it later in Settings.</p>
            <div className={`et-ob-handle is-${status}`}>
              <AtSign size={18} />
              <input readOnly tabIndex={-1} value={handle} placeholder={ADA.username} />
              <i aria-hidden="true">{status === "available" && <Check size={16} />}</i>
            </div>
            <p className={`et-ob-handle-msg is-${status}`}>
              {status === "available" ? `etivio.co/@${ADA.username} is yours if you want it.` : status === "checking" ? "Checking…" : "3 to 30 characters: lowercase letters, numbers and underscores."}
            </p>
            <div className="et-ob-username-foot">
              <button type="button" tabIndex={-1} className="et-btn et-btn-primary" disabled={status !== "available"}>
                {fx.has("claimed") ? "Saving…" : "Continue"} <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

const CONFETTI = ["#2563eb", "#c026d3", "#f59e0b", "#0f766e", "#ea580c", "#f9c6d3", "#5eead4"];

// The badge celebration (BadgeCelebration.tsx), as a new learner gets Pioneer.
function BadgeModal() {
  const info = BADGE_INFO.early;
  return (
    <div className="et-tour-scrim">
      <dialog open className="et-modal et-modal-sm et-celebrate">
        <div className="et-confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `${(i % 9) * 0.07}s`,
                animationDuration: `${1.6 + (i % 5) * 0.25}s`,
                ["--spin" as string]: `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
              }}
            />
          ))}
        </div>
        <div className="et-celebrate-seals">
          <BadgeSeal id="early" size={168} />
        </div>
        <p className="et-celebrate-kicker">Congratulations!</p>
        <h2>You earned the {info.label} badge</h2>
        <p className="et-celebrate-sub">{info.hint}. Keep going, there are more to unlock.</p>
        <div className="et-celebrate-actions">
          <span className="et-btn et-btn-ghost">Keep learning</span>
          <span className="et-btn et-btn-primary">View my badges</span>
        </div>
      </dialog>
    </div>
  );
}

// Your profile (profile/layout.tsx + ProfileHero), filling in as she sets it up.
function Profile({ fx }: { fx: Set<string> }) {
  const headline = useTyped("Product Designer", fx.has("headline"), 50);
  const bio = useTyped(BIO, fx.has("bio"), 18);
  const skills = fx.has("skills") ? ["UI design", "Figma", "User research", "Prototyping"] : [];
  const profile: ProfileDetails = {
    id: "praise",
    username: ADA.username,
    profilePublic: true,
    name: ADA.name,
    avatarUrl: fx.has("photo") ? ADA.photo : null,
    coverUrl: null,
    bio: bio || null,
    headline: headline || null,
    location: fx.has("headline") ? "Lagos" : null,
    websiteUrl: null,
    linkedinUrl: null,
    xUrl: null,
    interests: [],
    notificationPrefs: {} as ProfileDetails["notificationPrefs"],
    joinedAt: ago(60 * 24 * 2),
    weeklyGoal: 5,
    showCurrentLearning: true,
  };
  return (
    <div className="et-page">
      <ProfileHero
        profile={profile}
        skills={skills}
        badges={<Badges featured={{ badge: BADGE_INFO.early, earned: true, current: 1, target: 1, unit: "" }} earnedAt={ago(5)} earned={1} total={8} viewAllHref="#" />}
        actions={
          <>
            <span className="et-btn et-btn-ghost" data-demo="copy">
              {fx.has("copied") ? <Check size={15} /> : <Link2 size={15} />} {fx.has("copied") ? "Copied" : "Copy link"}
            </span>
            <span className="et-btn et-btn-ghost">
              <ExternalLink size={15} />
              Public page
            </span>
            <span className="et-btn et-btn-primary">
              <PenLine size={15} />
              Edit profile
            </span>
          </>
        }
      />
      <div className="et-tab-head">
        <div>
          <p className="et-set-crumb">
            <UserRound size={12} />
            Profile <span>/</span> Overview
          </p>
          <h1>Profile</h1>
        </div>
        <nav className="et-seg">
          {["Overview", "Courses", "Certificates", "Activity", "Badges", "Notes"].map((t, i) => (
            <a key={t} className={i === 0 ? "is-on" : ""}>
              {t}
            </a>
          ))}
        </nav>
      </div>
      <StatStrip
        items={[
          { label: "Courses", value: 1, icon: Library },
          { label: "Completed", value: 0, icon: BookCheck },
          { label: "Lessons done", value: 0, icon: PlayCircle },
          { label: "Learning time", value: "0 min", icon: Clock },
        ]}
      />
      {fx.has("copied") && (
        <div className="et-toast is-bottom">
          <Check size={16} />
          <span>Profile link copied</span>
        </div>
      )}
    </div>
  );
}

// Campus: the page's header, filters and composer, real post cards, and the sidebar.
const person = (id: string, name: string, username: string, avatar: string | null, badge: string | null = null): CampusAuthor => ({ id, name, username, avatar, badge });
const PEOPLE = {
  ada: person("ada", ADA.name, ADA.username, ADA.photo),
  tobi: person("tobi", "Tobi Adeyemi", "tobi", "/home2/people-2.jpg", "Tutor"),
  chidi: person("chidi", "Chidi Nwosu", "chidi", "/home2/people-3.jpg"),
  fatima: person("fatima", "Fatima Bello", "fatima", "/home2/people-7.jpg"),
  kunle: person("kunle", "Kunle Bello", "kunle", "/home2/people-6.jpg"),
  zainab: person("zainab", "Zainab Musa", "zainab", "/home2/people-5.jpg"),
};

function post(id: string, kind: CampusKind, author: CampusAuthor, minutes: number, body: string, extra: Partial<CampusPost> = {}): CampusPost {
  return {
    id,
    kind,
    body,
    imageUrl: null,
    videoUrl: null,
    hashtags: [...body.matchAll(/#(\w+)/g)].map((m) => m[1]),
    createdAt: ago(minutes),
    hidden: false,
    likes: 0,
    comments: 0,
    quotes: 0,
    liked: false,
    saved: false,
    author,
    poll: null,
    quoted: null,
    quoteGone: false,
    link: null,
    job: null,
    reposts: 0,
    reposted: false,
    repostOf: null,
    thread: [],
    ...extra,
  };
}

const FEED: CampusPost[] = [
  post("p1", "update", PEOPLE.tobi, 18, "New lesson is up in UI Design Foundations: auto layout in 60 seconds. Padding, gap and alignment, the three settings that keep your spacing consistent. #figma #uidesign", {
    // Campus only plays https video links, so this is the https address of the clip on whichever host serves the tour.
    videoUrl: `https://${typeof window === "undefined" ? "etivio.co" : window.location.host}/home2/lesson-clip.webm`,
    likes: 86,
    comments: 14,
    reposts: 9,
  }),
  post("p2", "question", PEOPLE.chidi, 42, "Anyone else doing JavaScript for Beginners? Looking for a study buddy for the arrays module. We could do 30 minutes every evening. #javascript", { likes: 14, comments: 6 }),
  post("p3", "win", PEOPLE.kunle, 95, "First day at my new job as a junior data analyst! 6 months ago I didn't know what a pivot table was. Thank you Etivio and everyone here who answered my questions. #firstjob", {
    imageUrl: "/home2/people-6.jpg",
    likes: 231,
    comments: 48,
    reposts: 17,
    liked: true,
  }),
  post("p4", "poll", PEOPLE.zainab, 160, "What do you want the next live session to cover?", {
    likes: 22,
    comments: 9,
    poll: {
      options: [
        { id: "a", label: "Building a portfolio", votes: 64 },
        { id: "b", label: "Acing interviews", votes: 41 },
        { id: "c", label: "Freelancing in Nigeria", votes: 37 },
      ],
      multiple: false,
      endsAt: ago(-60 * 24 * 2),
      closed: false,
      mine: [],
      total: 142,
    },
  }),
  post("p5", "opportunity", PEOPLE.fatima, 300, "We're hiring a junior product designer in Lagos. Remote friendly. Drop your portfolio below! #hiring", {
    likes: 41,
    comments: 18,
    job: { pay: "paid", title: "Junior product designer", company: "Brightline Studio", salary: "₦450,000 a month", location: "Lagos", remote: true, type: "full_time", email: "", url: "" },
  }),
];

const PLURAL: Record<CampusKind, string> = { update: "Updates", question: "Questions", win: "Wins", poll: "Polls", opportunity: "Opportunities" };

const VIEWER: CampusViewer = { id: "ada", staff: false, name: ADA.name, avatar: ADA.photo };

function Campus({ fx }: { fx: Set<string> }) {
  const typed = useTyped(POST, fx.has("typing"), 32);
  const posted = fx.has("posted");
  const open = fx.has("open") && !posted;
  const kind: CampusKind = fx.has("win") ? "win" : "update";
  const box = useRef<HTMLDivElement>(null);
  // The video in Tobi's post plays once the feed scrolls to it.
  useEffect(() => {
    if (!fx.has("play")) return;
    const v = box.current?.querySelector("video");
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [fx]);
  const mine = post("new", "win", PEOPLE.ada, 0, POST, { likes: 0 });
  return (
    <div className="et-page et-cps" ref={box}>
      <div className="et-page-head et-cps-head">
        <h1>Campus</h1>
        <div className="et-cps-members">
          <span className="et-cps-faces">
            {Object.values(PEOPLE)
              .slice(1, 5)
              .map((p) => (
                <Avatar key={p.id} src={p.avatar} initial={p.name[0]} seed={p.name} className="et-cps-face is-xs" />
              ))}
          </span>
          <small>
            <Users size={13} /> 4,812 learners
          </small>
          <small className="et-cps-online">
            <i aria-hidden="true" /> 128 online
          </small>
        </div>
      </div>
      <div className="et-cps-top">
        <div className="et-cps-bar">
          <nav className="et-cps-tabs">
            <a className="is-on">
              <Layers size={15} /> All
            </a>
            {(Object.keys(KIND_STYLE) as CampusKind[]).map((k) => {
              const T = KIND_STYLE[k];
              return (
                <a key={k}>
                  <T.icon size={15} /> {PLURAL[k]}
                </a>
              );
            })}
          </nav>
          <details className="et-cps-sortmenu">
            <summary>
              <Clock size={14} /> Latest <ChevronDown size={14} />
            </summary>
          </details>
        </div>
        <div className="et-cps-search">
          <Search size={16} />
          <input readOnly tabIndex={-1} placeholder="Search Campus" />
        </div>
      </div>
      <div className="et-cps-layout">
        <div className="et-cps-feed">
          <div className="et-cps-compose">
            <div className={`et-cps-box${open ? " is-open" : ""}`}>
              <div className="et-cps-box-main">
                {open ? (
                  <div className="et-cps-who-row">
                    <Avatar src={ADA.photo} initial="A" seed={ADA.name} className="et-cps-face" />
                    <span>
                      <b>{ADA.name}</b>
                      <small>
                        <Globe size={12} /> Everyone on Campus can see and reply
                      </small>
                    </span>
                  </div>
                ) : (
                  <Avatar src={ADA.photo} initial="A" seed={ADA.name} className="et-cps-face" />
                )}
                <div className="et-cps-box-col">
                  {open && (
                    <div className="et-cps-types">
                      {(Object.keys(KIND_STYLE) as CampusKind[]).map((k) => {
                        const T = KIND_STYLE[k];
                        return (
                          <button key={k} type="button" tabIndex={-1} className={`${T.className}${kind === k ? " is-on" : ""}`}>
                            <T.icon size={15} /> {T.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="et-cps-area">
                    <textarea readOnly tabIndex={-1} rows={open ? 3 : 1} value={open ? typed : ""} placeholder={kind === "win" ? "Finished a course? Landed a role? Tell everyone…" : "What are you learning today?"} />
                  </div>
                </div>
              </div>
              {open && (
                <div className="et-cps-toolbar">
                  <div className="et-cps-icons">
                    <button type="button" tabIndex={-1}>
                      <ImagePlus size={19} />
                    </button>
                    <button type="button" tabIndex={-1}>
                      <Video size={19} />
                    </button>
                    <button type="button" tabIndex={-1}>
                      <ListPlus size={19} />
                    </button>
                    <div className="et-cps-emoji">
                      <button type="button" tabIndex={-1}>
                        <Smile size={19} />
                      </button>
                    </div>
                  </div>
                  <div className="et-cps-send">
                    <button type="button" tabIndex={-1} className="et-cps-post-btn" disabled={!typed}>
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {posted && (
            <div className="et-tour-new">
              <PostCard post={mine} viewer={VIEWER} />
            </div>
          )}
          {FEED.map((p) => (
            <PostCard key={p.id} post={p} viewer={VIEWER} />
          ))}
        </div>
        <aside className="et-cps-side">
          <section className="et-card et-card-pad et-cps-resume">
            <h2 className="et-cps-side-title">
              <PlayCircle size={15} /> Continue learning
            </h2>
            <span className="et-cps-resume-course">
              <div className="et-list-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COVERS[0]} alt="" />
              </div>
              <span>
                <b>UI Design Foundations</b>
                <small>7 lessons left</small>
              </span>
            </span>
            <div className="et-progress-row">
              <div className="et-progress">
                <span style={{ width: "64%" }} />
              </div>
              <span>64%</span>
            </div>
            <span className="et-btn et-btn-primary et-btn-sm et-cps-resume-btn">
              Resume <ArrowRight size={14} />
            </span>
          </section>
          <section className="et-card et-card-pad">
            <h2 className="et-cps-side-title">
              <TrendingUp size={15} /> Trending this week
            </h2>
            <ul className="et-cps-trending">
              {[
                ["uidesign", 128],
                ["firstjob", 96],
                ["javascript", 74],
                ["figma", 51],
              ].map(([t, n]) => (
                <li key={t}>
                  <a>
                    <b>#{t}</b>
                    <small>{n} posts</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="et-card et-card-pad">
            <h2 className="et-cps-side-title">
              <Users size={15} /> Communities to join
            </h2>
            <ul className="et-cps-groups">
              {["Designers Lagos", "Data Nigeria", "Women in Tech Africa"].map((c, i) => (
                <li key={c}>
                  <a className="et-cps-group">
                    <span className="et-cps-group-mark">{c[0]}</span>
                    <span>
                      <b>{c}</b>
                      <small>{["2,140", "860", "1,402"][i]} members</small>
                    </span>
                  </a>
                  <button type="button" tabIndex={-1} className="et-cps-join">
                    Join
                  </button>
                </li>
              ))}
            </ul>
            <a className="et-cps-side-more">See all communities</a>
          </section>
        </aside>
      </div>
    </div>
  );
}

// The course player (PlayerFrame + LessonVideo), with the lesson playing.
const OUTLINE: OutlineModule[] = [
  {
    id: "m1",
    title: "Foundations",
    locked: false,
    items: [
      { id: "l1", title: "What makes a good interface", href: "#", kind: "video", done: true, locked: false, seconds: 420 },
      { id: "l2", title: "Colour theory", href: "#", kind: "video", done: true, locked: false, seconds: 540 },
      { id: "q1", title: "Colour theory quiz", href: "#", kind: "quiz", done: true, locked: false, note: "10 questions" },
    ],
  },
  {
    id: "m2",
    title: "Layout and spacing",
    locked: false,
    items: [
      { id: "l3", title: "Spacing systems", href: "#", kind: "video", done: true, locked: false, seconds: 480 },
      { id: "l4", title: "Auto layout in 60 seconds", href: "#", kind: "video", done: false, locked: false, seconds: 60 },
      { id: "l5", title: "Grids that scale", href: "#", kind: "video", done: false, locked: false, seconds: 600 },
      { id: "l6", title: "Responsive frames", href: "#", kind: "reading", done: false, locked: false },
    ],
  },
  {
    id: "m3",
    title: "Typography",
    locked: true,
    items: [{ id: "l7", title: "Type scales", href: "#", kind: "video", done: false, locked: true, seconds: 420 }],
  },
];

function Player({ fx }: { fx: Set<string> }) {
  const done = fx.has("done");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fx.has("play")) return;
    const v = box.current?.querySelector("video");
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [fx]);
  const outline = OUTLINE.map((m) => ({ ...m, items: m.items.map((it) => (it.id === "l4" && done ? { ...it, done: true } : it)) }));
  return (
    <div ref={box} className="et-tour-player">
      <PlayerFrame
        course={{ id: "ui", title: "UI Design Foundations", slug: "ui" }}
        outline={outline}
        activeId="l4"
        progress={done ? 69 : 64}
        steps={{ done: done ? 12 : 11, total: 18 }}
        prev={{ href: "#", label: "Spacing systems" }}
        next={{ href: "#", label: "Grids that scale" }}
        stage={<LessonVideo source={{ provider: "file", src: "/home2/lesson-clip.webm" }} title="Auto layout in 60 seconds" />}
        bar={
          <div className="et-pl-bar">
            <p>
              <small>Layout and spacing</small>
              <b>Auto layout in 60 seconds</b>
            </p>
            <LessonCompleteButton key={String(done)} lessonId="l4" done={done} watch={null} label={done ? "Completed" : "Complete and continue"} />
          </div>
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="et-pl-overview">
                <p>Padding, gap and alignment: the three auto layout settings that keep spacing consistent as your design grows.</p>
              </div>
            ),
          },
          { id: "notes", label: "Notes", content: null },
          { id: "ai", label: "Ask AI", content: null },
        ]}
      />
    </div>
  );
}
