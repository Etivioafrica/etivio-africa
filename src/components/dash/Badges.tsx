import { Award, BookOpen, Flame, GraduationCap, Presentation, Sparkles, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReplayBadge } from "./ReplayBadge";
import type { BadgeId, BadgeStatus } from "@/lib/badges";

type Look = { icon: LucideIcon; top: string; bottom: string; bg: string; ink: string; disc: string; glyph: string; star: string };

// Solid palettes in the spirit of sticker-style course badges.
const LOOK: Record<BadgeId, Look> = {
  early: { icon: Sparkles, top: "Pioneer", bottom: "Etivio", bg: "#1e1b5e", ink: "#f9c6d3", disc: "#c026d3", glyph: "#fde68a", star: "#5eead4" },
  first_lesson: { icon: BookOpen, top: "First steps", bottom: "Unlocked", bg: "#0f766e", ink: "#fef3c7", disc: "#34d399", glyph: "#1e1b5e", star: "#fbbf24" },
  lessons_25: { icon: Target, top: "25 lessons", bottom: "Completed", bg: "#c026d3", ink: "#fdf4ff", disc: "#fbbf24", glyph: "#9a3412", star: "#fde68a" },
  finisher: { icon: Award, top: "Course", bottom: "Completed", bg: "#f59e0b", ink: "#7c2d12", disc: "#a855f7", glyph: "#fdf4ff", star: "#ea580c" },
  streak_7: { icon: Flame, top: "7 day streak", bottom: "On fire", bg: "#ea580c", ink: "#fff7ed", disc: "#3b0764", glyph: "#fdba74", star: "#fde68a" },
  lessons_100: { icon: Trophy, top: "100 lessons", bottom: "Centurion", bg: "#f9c6d3", ink: "#c2410c", disc: "#3b0764", glyph: "#fbbf24", star: "#0f766e" },
  graduate: { icon: GraduationCap, top: "5 courses", bottom: "Graduate", bg: "#1e1b5e", ink: "#5eead4", disc: "#f59e0b", glyph: "#1e1b5e", star: "#f9c6d3" },
  streak_30: { icon: Zap, top: "30 day streak", bottom: "Unstoppable", bg: "#0f766e", ink: "#f9c6d3", disc: "#f9c6d3", glyph: "#be185d", star: "#fde68a" },
  tutor: { icon: Presentation, top: "Etivio", bottom: "Tutor", bg: "#c026d3", ink: "#fef3c7", disc: "#1e1b5e", glyph: "#f9c6d3", star: "#5eead4" },
};

// Scalloped edge: a circle whose radius ripples 24 times around. Computed once.
const SCALLOP = (() => {
  const pts: string[] = [];
  const n = 360;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 55 + 2.4 * Math.cos(24 * t);
    pts.push(`${(60 + r * Math.cos(t)).toFixed(2)},${(60 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

// Four-point sparkle centred on (x, y).
const sparkle = (x: number, y: number, s: number) =>
  `M${x},${y - s}Q${x},${y} ${x + s},${y}Q${x},${y} ${x},${y + s}Q${x},${y} ${x - s},${y}Q${x},${y} ${x},${y - s}Z`;

// Shrink long labels so they fit their arc.
const fontFor = (text: string, base: number) => Math.min(base, (base * 11) / Math.max(text.length, 11));

export function BadgeSeal({ id, size = 96, locked }: { id: BadgeId; size?: number; locked?: boolean }) {
  const l = LOOK[id];
  const Icon = l.icon;
  const top = `bs-${id}-top`;
  const bottom = `bs-${id}-bottom`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`et-seal${locked ? " is-locked" : ""}`} aria-hidden="true">
      <defs>
        {/* Top text sits outside its arc; bottom text runs left to right along the lower arc, inside it. */}
        <path id={top} d="M 22,60 A 38,38 0 0 1 98,60" />
        <path id={bottom} d="M 14,60 A 46,46 0 0 0 106,60" />
      </defs>
      {/* White die-cut border so the sticker reads on any background. */}
      <path d={SCALLOP} fill="#ffffff" stroke="#ffffff" strokeWidth="5" strokeLinejoin="round" />
      <path d={SCALLOP} fill={l.bg} />
      <circle cx="60" cy="60" r="49.5" fill="none" stroke={l.ink} strokeOpacity=".55" strokeWidth="1" strokeDasharray="1.2 3.2" strokeLinecap="round" />
      <text fill={l.ink} fontSize={fontFor(l.top, 11)} fontWeight="800" letterSpacing="1.4" textAnchor="middle">
        <textPath href={`#${top}`} startOffset="50%">
          {l.top.toUpperCase()}
        </textPath>
      </text>
      <text fill={l.ink} fontSize={fontFor(l.bottom, 10)} fontWeight="800" letterSpacing="1.4" textAnchor="middle">
        <textPath href={`#${bottom}`} startOffset="50%">
          {l.bottom.toUpperCase()}
        </textPath>
      </text>
      <path d={sparkle(27, 60, 3.6)} fill={l.star} />
      <path d={sparkle(93, 60, 3.6)} fill={l.star} />
      <circle cx="60" cy="60" r="19" fill={l.disc} />
      <Icon x={48} y={48} width={24} height={24} color={l.glyph} strokeWidth={2.2} />
    </svg>
  );
}

// Badge panel beside the bio: the latest badge, featured. Swaps to the new one whenever another is earned.
// With nothing earned yet (own profile), it shows the next badge to aim for in black and white.
export function Badges({
  featured,
  earnedAt,
  earned,
  total,
  viewAllHref,
}: {
  featured: BadgeStatus;
  earnedAt?: string;
  earned: number;
  total?: number;
  viewAllHref?: string;
}) {
  const locked = !featured.earned;
  return (
    <div className="et-badges">
      <div className="et-badges-head">
        <p className="et-badges-title">{locked ? "First badge" : "Latest badge"}</p>
        {viewAllHref ? (
          <Link href={viewAllHref}>
            {earned}
            {total ? ` of ${total}` : ""} earned · View all
          </Link>
        ) : (
          <span>
            {earned} badge{earned === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="et-badge-feature" data-tip={locked ? featured.badge.how : featured.badge.hint} title={locked ? featured.badge.how : featured.badge.hint}>
        {/* Own profile: click an earned badge to replay its celebration. */}
        {viewAllHref && !locked ? (
          <ReplayBadge id={featured.badge.id} label={featured.badge.label}>
            <BadgeSeal key={featured.badge.id} id={featured.badge.id} size={112} />
          </ReplayBadge>
        ) : (
          <BadgeSeal key={featured.badge.id} id={featured.badge.id} size={112} locked={locked} />
        )}
        <div>
          <b>{featured.badge.label}</b>
          <small>
            {locked
              ? featured.badge.how
              : earnedAt
                ? `Earned ${new Date(earnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : featured.badge.hint}
          </small>
        </div>
      </div>
    </div>
  );
}
