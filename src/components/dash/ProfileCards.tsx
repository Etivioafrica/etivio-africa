import Link from "next/link";
import { Check, Circle, Sparkles, Target } from "lucide-react";
import { EmptyMini, Ring } from "@/components/dash/ui";
import type { LearnerProfile } from "@/lib/data/profile";
import { setWeeklyGoal } from "@/app/(app)/learn/actions";

const GOALS = [3, 5, 7];

// Lessons completed in the current week (the heatmap's last column, Sunday to Saturday).
const thisWeek = (data: LearnerProfile) => data.heatmap.weeks.at(-1)!.reduce((n, d) => n + d.count, 0);

export function WeeklyGoal({ data }: { data: LearnerProfile }) {
  const goal = data.profile.weeklyGoal;
  const done = thisWeek(data);
  const choose = (current: number | null) => (
    <form action={setWeeklyGoal} className="et-goal-pick">
      {GOALS.map((g) => (
        <button key={g} type="submit" name="goal" value={g} className={`et-chip${current === g ? " is-on" : ""}`} aria-pressed={current === g}>
          {g} lessons
        </button>
      ))}
    </form>
  );

  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Weekly goal</h2>
        {goal && <span className="et-muted" style={{ fontSize: 12.5 }}>Resets every Sunday</span>}
      </div>
      {goal ? (
        <div className="et-goal">
          <Ring value={done} max={goal}>
            <b>{done}</b>
            <small>of {goal}</small>
          </Ring>
          <div className="et-goal-body">
            <b>{done >= goal ? "Goal reached. Brilliant work!" : `${goal - done} more lesson${goal - done === 1 ? "" : "s"} to go this week`}</b>
            <small>Change your goal</small>
            {choose(goal)}
          </div>
        </div>
      ) : (
        <div className="et-goal">
          <span className="et-empty-mini-icon">
            <Target size={18} />
          </span>
          <div className="et-goal-body">
            <b>How many lessons a week?</b>
            <small>Learners with a weekly goal are far more likely to finish their courses.</small>
            {choose(null)}
          </div>
        </div>
      )}
    </section>
  );
}

// Profile setup checklist with a ring. Hidden from the overview once everything is done.
export function profileSteps(data: LearnerProfile) {
  const p = data.profile;
  return [
    { label: "Add a profile photo", done: Boolean(p.avatarUrl), href: "/settings" },
    { label: "Write a headline", done: Boolean(p.headline), href: "/settings" },
    { label: "Claim your username", done: Boolean(p.username), href: "/settings" },
    { label: "Add a short bio", done: Boolean(p.bio), href: "/settings" },
    { label: "Add your location", done: Boolean(p.location), href: "/settings" },
    { label: "Start your first course", done: data.courses.length > 0, href: "/learn/browse" },
  ];
}

export function ProfileCompleteness({ data }: { data: LearnerProfile }) {
  const steps = profileSteps(data);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Complete your profile</h2>
        <span className="et-muted" style={{ fontSize: 12.5 }}>
          {done} of {steps.length} done
        </span>
      </div>
      <div className="et-goal">
        <Ring value={done} max={steps.length}>
          <b>{pct}%</b>
        </Ring>
        <ul className="et-checklist">
          {steps.map((s) => (
            <li key={s.label} className={s.done ? "is-done" : ""}>
              {s.done ? <Check size={14} strokeWidth={2.6} /> : <Circle size={14} />}
              {s.done ? <span>{s.label}</span> : <Link href={s.href}>{s.label}</Link>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Skills earned from completed courses.
export function SkillsCard({ skills }: { skills: string[] }) {
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Skills</h2>
        <span className="et-muted" style={{ fontSize: 12.5 }}>
          From completed courses
        </span>
      </div>
      {skills.length ? (
        <div className="et-card-pad et-pf-tags">
          {skills.map((s) => (
            <span key={s} className="et-skill">
              {s}
            </span>
          ))}
        </div>
      ) : (
        <EmptyMini icon={Sparkles} title="No skills yet">
          Finish a course and the skills it teaches appear here and on your public profile.
        </EmptyMini>
      )}
    </section>
  );
}
