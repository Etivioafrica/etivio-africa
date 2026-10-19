import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Flame, GraduationCap, PlayCircle, Sparkles } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/learn";
import { formatPrice } from "@/lib/format";

export const metadata = {
  title: "Etivio | Learn the skills that move you forward",
  description: "Practical courses from instructors across Africa. Learn at your pace, track your progress, and earn certificates you can share.",
};

const STEPS = [
  { icon: BookOpen, title: "Pick a course", body: "Practical courses taught by people who do the work, across Africa." },
  { icon: PlayCircle, title: "Learn at your pace", body: "Short lessons, notes, and bookmarks. Pick up exactly where you stopped." },
  { icon: Award, title: "Earn your certificate", body: "Finish a course and get a verified certificate you can add to LinkedIn." },
];

const PERKS = [
  { icon: Award, title: "Verified certificates", body: "Every certificate has an ID anyone can check." },
  { icon: Flame, title: "Streaks and goals", body: "Set a weekly goal and build a learning habit." },
  { icon: Sparkles, title: "Badges", body: "Unlock badges as you learn and show them off." },
  { icon: GraduationCap, title: "Your public profile", body: "Share your skills and progress at etivio.co/@you." },
];

export default function Home() {
  return (
    <>
      <section className="et-home-hero">
        <span className="et-home-pill">
          <Sparkles size={13} /> Now open: learn with Etivio
        </span>
        <h1>Learn the skills that move you forward.</h1>
        <p>Practical courses from instructors across Africa. Learn at your own pace, track your progress, and earn certificates you can share.</p>
        <Suspense fallback={<HeroCtas signedIn={false} />}>
          <SessionCtas />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <Featured />
      </Suspense>

      <section className="et-home-section">
        <h2>How it works</h2>
        <div className="et-home-steps">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="et-card et-card-pad">
              <span className="et-home-step-n">{i + 1}</span>
              <Icon size={20} className="et-home-step-icon" />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="et-home-section">
        <h2>More than videos</h2>
        <div className="et-home-perks">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="et-home-perk">
              <span className="et-set-icon">
                <Icon size={18} />
              </span>
              <div>
                <b>{title}</b>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="et-card et-home-cta">
        <h2>Start learning today</h2>
        <p>Create your free account in under a minute.</p>
        <Suspense fallback={<HeroCtas signedIn={false} />}>
          <SessionCtas />
        </Suspense>
      </section>
    </>
  );
}

function HeroCtas({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <div className="et-home-ctas">
      <Link href="/learn" className="et-btn et-btn-primary et-home-btn">
        Go to dashboard <ArrowRight size={16} />
      </Link>
    </div>
  ) : (
    <div className="et-home-ctas">
      <Link href="/signup" className="et-btn et-btn-primary et-home-btn">
        Get started free <ArrowRight size={16} />
      </Link>
      <Link href="/login" className="et-btn et-btn-ghost et-home-btn">
        Log in
      </Link>
    </div>
  );
}

async function SessionCtas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <HeroCtas signedIn={Boolean(user)} />;
}

// A few published courses. Hidden until there are some.
async function Featured() {
  const courses = (await getCatalog(6)).slice(0, 3);
  if (!courses.length) return null;
  return (
    <section className="et-home-section">
      <div className="et-home-head">
        <h2>Popular courses</h2>
        <Link href="/signup">See all courses</Link>
      </div>
      <div className="et-course-grid">
        {courses.map((c) => (
          <Link key={c.id} href="/signup" className="et-card et-course">
            <Cover url={c.coverUrl} level={c.level} />
            <div className="et-course-body">
              <h3>{c.title}</h3>
              {c.summary && <p>{c.summary}</p>}
              <div className="et-course-meta">
                <span>
                  {c.instructor} · {c.lessonCount} lessons
                </span>
                <b>{formatPrice(c.priceMinor, c.currency)}</b>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
