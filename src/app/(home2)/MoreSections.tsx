import {
  BadgeCheck,
  Briefcase,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { PathIcon, type PathId } from "./PathIcon";
import { Testimonials } from "./Testimonials";

/* Impact: honest platform facts plus an example learner week chart */
const WEEK = [2, 3, 2, 4, 5, 4, 7];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Impact() {
  const max = Math.max(...WEEK);
  return (
    <section className="et-h2-imp et-h2-guided">
      <div className="et-h2-imp-head">
        <span className="et-h2-mk">
          <i aria-hidden="true" /> Results
        </span>
        <h2>Progress you can see</h2>
      </div>
      <div className="et-h2-imp-grid">
        <div className="et-h2-imp-card">
          <div className="et-h2-imp-stats">
            <div>
              <b>₦0</b>
              <span>to join Etivio and start learning with free courses</span>
            </div>
            <div>
              <b>40</b>
              <span>questions a day to your AI tutor, inside every course you take</span>
            </div>
          </div>
          <div className="et-h2-imp-week">
            <b>Your week at a glance</b>
            <span>7-day streak</span>
          </div>
          <div className="et-h2-imp-chart" aria-label="Example learner week">
            {WEEK.map((v, i) => (
              <div key={DAYS[i]}>
                <span
                  style={
                    {
                      "--h": `${(v / max) * 100}%`,
                      "--i": i,
                    } as React.CSSProperties
                  }
                />
                <small>{DAYS[i]}</small>
              </div>
            ))}
          </div>
          <small className="et-h2-imp-cap">Example: lessons one learner finished in a week, the way your Learn dashboard shows it</small>
        </div>
        <div className="et-h2-imp-card is-side">
          <h3>Show up for a few minutes a day. Finish the whole course.</h3>
          <p>
            Set a weekly goal and Etivio keeps you on track with reminders,
            streaks and badges. Every lesson you finish moves your progress
            bar, so you always know how close you are.
          </p>
          <div className="et-h2-imp-big">
            <b>1 link</b>
            <span>to share your verified certificate on your CV or LinkedIn when you finish</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Sectors: who Etivio is for */
const PATHS: { icon: PathId; title: string; body: string }[] = [
  { icon: "students", title: "Students", body: "Add practical, job-ready skills to what school already teaches you." },
  { icon: "jobs", title: "Job seekers", body: "Build a portfolio and earn certificates employers can verify in seconds." },
  { icon: "switch", title: "Career switchers", body: "Move into tech, design or marketing with a clear step-by-step path." },
  { icon: "freelance", title: "Freelancers", body: "Pick up the tools and client skills that help you charge more." },
  { icon: "business", title: "Business owners", body: "Learn marketing, finance and sales you can use in your business this week." },
  { icon: "teams", title: "Teams", body: "Upskill your staff together with group buy discounts on courses." },
];

export function Paths() {
  return (
    <section className="et-h2-paths">
      <div className="et-h2-knots" aria-hidden="true">
        <span className="et-x-rail" />
        <b className="l" />
        <b className="r" />
      </div>
      <span className="et-h2-mk">
        <i aria-hidden="true" /> Who it is for
      </span>
      <h2>Learning for every path</h2>
      <div className="et-h2-paths-grid">
        {PATHS.map(({ icon, title, body }) => (
          <article key={title}>
            <PathIcon id={icon} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Voices() {
  return <Testimonials />;
}

/* Trust */
const TRUST = [
  { icon: Lock, title: "Secure payments", body: "Card and bank transfer payments go through Paystack. Etivio never stores your card details." },
  { icon: BadgeCheck, title: "Verified certificates", body: "Every certificate carries a unique code anyone can check on Etivio." },
  { icon: ShieldCheck, title: "Reviewed courses", body: "Our team checks every new course for quality and safety before it is published." },
];

export function Trust() {
  return (
    <section className="et-h2-trust et-h2-guided">
      <div className="et-h2-trust-l">
        <span className="et-h2-mk">
          <i aria-hidden="true" /> Trust
        </span>
        <h2>Learning you can trust</h2>
        <div className="et-h2-trust-seals" aria-hidden="true">
          <span>SSL</span>
          <span>PAY</span>
          <span>
            <Briefcase size={22} />
          </span>
        </div>
      </div>
      <div className="et-h2-trust-grid">
        {TRUST.map(({ icon: Icon, title, body }) => (
          <article key={title}>
            <span>
              <Icon size={20} />
            </span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
