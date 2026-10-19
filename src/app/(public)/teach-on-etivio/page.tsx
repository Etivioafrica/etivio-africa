import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock, Layers, Presentation, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RoleApplication } from "@/app/(app)/roles/RoleApplication";
import { getPlatformSettings } from "@/lib/platform";

export const metadata = {
  title: "Teach on Etivio",
  description: "Share what you know with learners across Africa. Apply to become an Etivio tutor.",
};

const PERKS = [
  { icon: Layers, title: "Build your course", body: "Organise lessons into modules with video and notes. We host everything." },
  { icon: Wallet, title: "Earn from every sale", body: "Set your price and get paid out to your Nigerian bank account." },
  { icon: BarChart3, title: "See your impact", body: "Track who enrolled and how far each learner has got." },
];

const STEPS = [
  { title: "Apply", body: "Tell us what you want to teach and your experience." },
  { title: "Get approved", body: "The Etivio team reviews every application, usually within a few days." },
  { title: "Publish and earn", body: "Build your course, publish it, and start teaching." },
];

export default function TeachOnEtivio() {
  return (
    <>
      <section className="et-card et-teach-hero">
        <span className="et-cta-icon">
          <Presentation size={24} />
        </span>
        <h1>Teach on Etivio</h1>
        <p>Share what you know with learners across Africa, and earn from every enrollment.</p>
      </section>

      <div className="et-teach-perks">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="et-card et-card-pad">
            <span className="et-set-icon">
              <Icon size={18} />
            </span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>

      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>How it works</h2>
          </div>
          <ol className="et-teach-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span>{i + 1}</span>
                <div>
                  <b>{s.title}</b>
                  <small>{s.body}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="et-card" id="apply">
          <div className="et-card-head">
            <h2>Apply to teach</h2>
          </div>
          <div className="et-card-pad">
            <Suspense fallback={<div className="et-skel" style={{ height: 160 }} />}>
              <ApplyPanel />
            </Suspense>
          </div>
        </section>
      </div>
    </>
  );
}

// Applications are tied to an Etivio account, so signed-out visitors sign in (or sign up) first.
async function ApplyPanel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tutorApplicationsOpen } = await getPlatformSettings();
  const closed = (
      <div className="et-teach-signin">
        <p className="et-inline">
          <Clock size={16} /> Tutor applications are closed right now.
        </p>
        <p>We open them in batches so every application gets a proper review. Please check back soon.</p>
      </div>
  );
  if (!user && !tutorApplicationsOpen) return closed;
  if (!user)
    return (
      <div className="et-teach-signin">
        <p>Applications use your Etivio account. Sign in to continue, or create a free account first.</p>
        <div className="et-inline">
          <Link href="/login?next=/teach-on-etivio%23apply" className="et-btn et-btn-primary">
            Sign in with your Etivio account <ArrowRight size={15} />
          </Link>
          <Link href="/signup?next=/teach-on-etivio%23apply" className="et-btn et-btn-ghost">
            Create an account
          </Link>
        </div>
      </div>
    );

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isTutor = (roles ?? []).some((r) => r.role === "tutor" || r.role === "super_admin");
  if (!isTutor && !tutorApplicationsOpen) return closed;
  if (isTutor)
    return (
      <div className="et-teach-signin">
        <p className="et-inline">
          <CheckCircle2 size={16} style={{ color: "#16a34a" }} /> You&apos;re already an Etivio tutor.
        </p>
        <div>
          <Link href="/teach" className="et-btn et-btn-primary">
            Open your teaching dashboard <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );

  return (
    <>
      <p className="et-teach-note">
        <Clock size={14} /> Signed in as {user.email}
      </p>
      <RoleApplication userId={user.id} role="tutor" prompt="What would you like to teach, and what's your experience?" />
    </>
  );
}
