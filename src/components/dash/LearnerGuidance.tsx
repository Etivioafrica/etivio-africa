import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { Ring } from "@/components/dash/ui";
import type { LearningGoal } from "@/lib/learner-prefs";

// Advice tied to what the learner said brought them to Etivio (welcome guide).
export const GOAL_TIPS: Record<LearningGoal, { tip: string; cta: { label: string; href: string } }> = {
  new_skill: { tip: "Pick one course and see it through. A few lessons a week beats cramming.", cta: { label: "Browse courses", href: "/learn/browse" } },
  career: { tip: "Every course you finish gives you a verified certificate you can add to LinkedIn.", cta: { label: "See certificates", href: "/profile/certificates" } },
  job: { tip: "Employers want proof. Finish courses, then share your certificates and public profile.", cta: { label: "Set up your profile", href: "/settings" } },
  freelance: { tip: "Clients hire on proof of skill. Complete practical courses and share your profile link with them.", cta: { label: "Set up your profile", href: "/settings" } },
  creative: { tip: "Explore freely. Save courses that catch your eye and come back to them any time.", cta: { label: "Saved courses", href: "/learn/saved" } },
};

export function LearnerGuidance({ goal, weeklyGoal, thisWeek }: { goal: LearningGoal | null; weeklyGoal: number | null; thisWeek: number }) {
  const g = goal ? GOAL_TIPS[goal] : null;
  if (!g && !weeklyGoal) return null;
  const left = weeklyGoal ? Math.max(0, weeklyGoal - thisWeek) : 0;

  return (
    <section className="et-card et-guide">
      {weeklyGoal ? (
        <div className="et-guide-goal">
          <Ring value={thisWeek} max={weeklyGoal} size={64}>
            <b style={{ fontSize: 15 }}>{thisWeek}</b>
            <small>of {weeklyGoal}</small>
          </Ring>
          <div>
            <b>{left === 0 ? "Weekly goal reached. Brilliant!" : left === 1 ? "1 lesson to go this week" : `${left} lessons to go this week`}</b>
            <small>{left === 0 ? "Keep the streak going, or rest. You've earned it." : "Your goal resets every Sunday."}</small>
          </div>
        </div>
      ) : (
        <div className="et-guide-goal">
          <span className="et-set-icon">
            <Target size={18} />
          </span>
          <div>
            <b>Set a weekly goal</b>
            <small>
              <Link href="/profile">Choose 3, 5, or 7 lessons a week</Link> to build a habit.
            </small>
          </div>
        </div>
      )}
      {g && (
        <div className="et-guide-tip">
          <p>{g.tip}</p>
          <Link href={g.cta.href} className="et-btn et-btn-ghost et-btn-sm">
            {g.cta.label} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}
