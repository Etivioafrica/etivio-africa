// Profile badges, earned from real learning activity. Ordered rarest first so the best ones lead.

export type BadgeId =
  | "tutor"
  | "streak_30"
  | "graduate"
  | "lessons_100"
  | "streak_7"
  | "finisher"
  | "lessons_25"
  | "first_lesson"
  | "early";

export type Badge = { id: BadgeId; label: string; hint: string; how: string };

export type BadgeInput = {
  joinedAt: string;
  lessonsDone: number;
  coursesCompleted: number;
  longestStreak: number;
  teaches?: boolean;
};

// Where a learner stands on one badge. `unit` labels the progress numbers ("lessons", "days").
export type BadgeStatus = { badge: Badge; earned: boolean; current: number; target: number; unit: string };

// Everyone who joins in the launch year is an early learner.
const EARLY_UNTIL = "2027-01-01";

type Rule = { badge: Badge; progress: (i: BadgeInput) => { current: number; target: number; unit: string } };

const count = (current: number, target: number, unit: string) => ({ current: Math.min(current, target), target, unit });

const RULES: Rule[] = [
  {
    badge: { id: "tutor", label: "Etivio tutor", hint: "Teaches on Etivio", how: "Publish a course as an approved Etivio tutor." },
    progress: (i) => count(i.teaches ? 1 : 0, 1, "course"),
  },
  {
    badge: { id: "streak_30", label: "30-day streak", hint: "Learned 30 days in a row", how: "Complete at least one lesson every day for 30 days." },
    progress: (i) => count(i.longestStreak, 30, "days"),
  },
  {
    badge: { id: "graduate", label: "Graduate", hint: "Completed 5 courses", how: "Finish every lesson in 5 courses." },
    progress: (i) => count(i.coursesCompleted, 5, "courses"),
  },
  {
    badge: { id: "lessons_100", label: "Centurion", hint: "Completed 100 lessons", how: "Complete 100 lessons across any courses." },
    progress: (i) => count(i.lessonsDone, 100, "lessons"),
  },
  {
    badge: { id: "streak_7", label: "7-day streak", hint: "Learned 7 days in a row", how: "Complete at least one lesson every day for a week." },
    progress: (i) => count(i.longestStreak, 7, "days"),
  },
  {
    badge: { id: "finisher", label: "Course finisher", hint: "Completed a course", how: "Finish every lesson in any course." },
    progress: (i) => count(i.coursesCompleted, 1, "course"),
  },
  {
    badge: { id: "lessons_25", label: "Steady learner", hint: "Completed 25 lessons", how: "Complete 25 lessons across any courses." },
    progress: (i) => count(i.lessonsDone, 25, "lessons"),
  },
  {
    badge: { id: "first_lesson", label: "First steps", hint: "Completed a first lesson", how: "Open any course and mark your first lesson complete." },
    progress: (i) => count(i.lessonsDone, 1, "lesson"),
  },
  {
    badge: { id: "early", label: "Early learner", hint: "Joined Etivio in its launch year", how: "Join Etivio during its launch year, 2026." },
    progress: (i) => count(i.joinedAt < EARLY_UNTIL ? 1 : 0, 1, "join"),
  },
];

const statusOf = (r: Rule, i: BadgeInput): BadgeStatus => {
  const p = r.progress(i);
  return { badge: r.badge, earned: p.current >= p.target, ...p };
};

export const earnedBadges = (i: BadgeInput) => RULES.map((r) => statusOf(r, i)).filter((s) => s.earned).map((s) => s.badge);

// Every badge a learner can see: earned first (rarest first), then locked in the order they're usually reached.
// Badges that can't be earned any more (early learner after launch) or don't apply (tutor, for learners) are left out.
export function allBadges(i: BadgeInput): BadgeStatus[] {
  const all = RULES.map((r) => statusOf(r, i)).filter((s) => s.earned || (s.badge.id !== "tutor" && s.badge.id !== "early"));
  const earned = all.filter((s) => s.earned);
  const locked = all.filter((s) => !s.earned).reverse();
  return [...earned, ...locked];
}

// The locked badge closest to being earned.
export const nextBadge = (i: BadgeInput) =>
  allBadges(i)
    .filter((s) => !s.earned)
    .sort((a, b) => b.current / b.target - a.current / a.target || a.target - b.target)[0] ?? null;

// Label + hint by id, for places that only have the id (the celebration modal).
export const BADGE_INFO = Object.fromEntries(RULES.map((r) => [r.badge.id, r.badge])) as Record<BadgeId, Badge>;
