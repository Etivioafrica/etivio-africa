"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FolderDown,
  Heart,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  BadgeCheck,
  School,
  Search,
  Store,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { updateGuide } from "@/app/(app)/guide-actions";
import { START_TOUR } from "@/lib/guide";

// One stop on the tour. `targets` are data-tour values, first visible one wins (sidebar on desktop, tab bar on
// phones). A step with no targets is a centred card; a step whose targets are all hidden is skipped.
// `icon: null` shows the Etivio mark instead.
type Step = { targets?: string[]; icon: LucideIcon | null; title: string; body: string; feature?: string };

const STEPS: Step[] = [
  { icon: null, title: "Welcome to Etivio", body: "Here's a one-minute tour of where everything lives. You can replay it any time from your account menu." },
  { targets: ["/learn"], icon: LayoutDashboard, title: "Your dashboard", body: "Home base: the course to continue, your weekly goal, streak, badges and upcoming sessions." },
  { targets: ["/learn/browse"], icon: Compass, title: "Find courses", body: "Browse courses from instructors across Africa. For you shows the best matches for your goals." },
  { targets: ["/learn/courses"], icon: Library, title: "My courses", body: "Everything you're enrolled in, with your progress. Open one to pick up exactly where you stopped." },
  { targets: ["/learn/explore"], icon: Store, title: "Marketplace", body: "Courses plus templates, e-books, resource packs and bundles from creators. Filter by type, level, category or price." },
  { targets: ["/campus"], icon: School, title: "Campus", body: "The learner community: share wins, ask questions, run polls and find opportunities.", feature: "campus" },
  { targets: ["/learn/announcements"], icon: Megaphone, title: "Announcements", body: "News from the Etivio team: new courses, features and events." },
  { targets: ["/profile/saved"], icon: Heart, title: "Saved", body: "Courses you've hearted, kept here until you're ready to start." },
  { targets: ["/learn/messages"], icon: MessagesSquare, title: "Messages", body: "Talk to the tutors of your courses. Ask about a lesson any time." },
  { targets: ["/learn/library"], icon: FolderDown, title: "Library", body: "Templates, e-books and packs you own. Download them any time." },
  { targets: ["/learn/wallet"], icon: Wallet, title: "Wallet", body: "Top-ups and credits for courses. Your balance is used first at checkout." },
  { targets: ["search"], icon: Search, title: "Search the menu", body: "Looking for a page? Type here, or press ⌘K (Ctrl+K on Windows) from anywhere." },
  { targets: ["account", "/me"], icon: UserRound, title: "Your account", body: "Profile, settings and sign out. Take this tour again from here whenever you need it." },
  { icon: BadgeCheck, title: "You're all set", body: "Start with a course that fits your goals. The getting-started list on your dashboard shows what to do next." },
];

const PAD = 6;
const CARD_W = 340;

// A target counts when it's on screen at all (the sidebar is hidden on phones, the tab bar on desktop).
function find(targets?: string[]) {
  for (const t of targets ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(t)}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

export function GuideTour({ autoStart, features }: { autoStart: boolean; features: Record<string, boolean | undefined> }) {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });

  const steps = STEPS.filter((s) => !s.feature || features[s.feature] !== false);
  // Steps whose target isn't on this screen are dropped when the tour starts.
  const [plan, setPlan] = useState<Step[]>([]);

  // Stops follow the screen top to bottom (the order things appear in the menu), between the welcome and closing cards.
  const start = useCallback(() => {
    const placed = steps.flatMap((s) => {
      const el = s.targets ? find(s.targets) : null;
      return el ? [{ s, el }] : [];
    });
    placed.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    setPlan([steps[0], ...placed.map((p) => p.s), steps[steps.length - 1]]);
    setIndex(0);
    setRunning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  // First visit: start a moment after the page settles. Later: from the account menu, checklist or Support.
  useEffect(() => {
    const t = autoStart ? setTimeout(start, 700) : undefined;
    window.addEventListener(START_TOUR, start);
    return () => {
      clearTimeout(t);
      window.removeEventListener(START_TOUR, start);
    };
  }, [autoStart, start]);

  const step = running ? plan[index] : undefined;

  // Keep the spotlight on its target through scrolling and resizing.
  useLayoutEffect(() => {
    if (!step) return;
    const el = find(step.targets);
    el?.scrollIntoView({ block: "nearest" });
    const measure = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
      setBox(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  const finish = useCallback(() => {
    setRunning(false);
    updateGuide({ tour: "done" });
  }, []);

  useEffect(() => {
    if (!running) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1 < plan.length ? i + 1 : i));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [running, plan.length, finish]);

  if (!step) return null;
  const last = index === plan.length - 1;
  const Icon = step.icon;
  const pct = plan.length > 1 ? (index / (plan.length - 1)) * 100 : 100;

  // Card beside the target with a pointer towards it: right of sidebar items, above tab bar items, below anything
  // else. Centred (welcome and closing cards) when there's no target.
  let card: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  let side: "left" | "top" | "bottom" | null = null;
  let arrow = 0;
  const width = Math.min(CARD_W, view.w - 32);
  if (box) {
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (box.right + 20 + width < view.w) {
      const top = Math.min(Math.max(16, cy - 44), view.h - 260);
      card = { left: box.right + 20, top };
      side = "left";
      arrow = cy - top;
    } else {
      const left = Math.min(Math.max(16, cx - width / 2), view.w - width - 16);
      arrow = cx - left;
      if (box.top > view.h / 2) {
        card = { left, bottom: view.h - box.top + 18 };
        side = "bottom";
      } else {
        card = { left, top: box.bottom + 18 };
        side = "top";
      }
    }
  }

  return createPortal(
    <div className="et-tour" role="dialog" aria-modal="true" aria-label={step.title}>
      {box ? (
        <div className="et-tour-spot" style={{ left: box.left - PAD, top: box.top - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }} />
      ) : (
        <div className="et-tour-dim" />
      )}
      <div key={index} className={`et-tour-card${box ? "" : " is-center"}`} style={{ ...card, width }}>
        {side && <span className={`et-tour-arrow is-${side}`} style={side === "left" ? { top: arrow } : { left: arrow }} aria-hidden />}
        <div className="et-tour-head">
          {Icon ? (
            <span className={`et-tour-icon${last ? " is-done" : ""}`}>
              <Icon size={box ? 18 : 26} />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/etivio-mark.svg" alt="" className="et-tour-logo" />
          )}
          <small>{index === 0 ? "Quick tour" : last ? "Tour complete" : `Step ${index} of ${plan.length - 2}`}</small>
          <button type="button" className="et-icon-btn" onClick={finish} aria-label="Close tour">
            <X size={15} />
          </button>
        </div>
        {box && (
          <div className="et-tour-progress" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="et-tour-foot">
          {!last && (
            <button type="button" className="et-tour-skip" onClick={finish}>
              Skip tour
            </button>
          )}
          <span className="et-tour-nav">
            {index > 0 && !last && (
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setIndex(index - 1)} aria-label="Back">
                <ArrowLeft size={14} />
              </button>
            )}
            <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={() => (last ? finish() : setIndex(index + 1))} autoFocus>
              {index === 0 ? "Show me around" : last ? "Start learning" : "Next"} {!last && <ArrowRight size={14} />}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.querySelector(".et-app") ?? document.body,
  );
}
