import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  CloudUpload,
  CreditCard,
  FileStack,
  Landmark,
  Layers,
  Megaphone,
  MessagesSquare,
  Sparkles,
  Star,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import { FaqBlock } from "@/components/faq/FaqBlock";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/platform";
import { Home2Nav } from "../Home2Nav";
import { SiteFooter } from "../SiteFooter";
import { hand, serif } from "../fonts";
import { ApplyForm } from "./ApplyForm";
import "../home2.css";

export const metadata: Metadata = {
  title: "Teach on Etivio | Share what you know and get paid",
  description: "Build a course with Etivio's course builder and AI assistant, sell templates and e-books, coach learners one to one, and get paid to your bank account. Apply to teach on Etivio.",
  alternates: { canonical: "/teach-on-etivio" },
};

// Every tutor tool Etivio has, grouped the way a tutor thinks about them.
const GROUPS = [
  {
    label: "Create",
    title: "Build a course you are proud of",
    items: [
      { icon: Layers, title: "Course builder", body: "Organise your course into modules and lessons. Each lesson can mix video, rich notes and downloadable files, and it saves as you type." },
      { icon: Sparkles, title: "AI course assistant", body: "Draft a course outline, write your course description and lesson notes, and generate a cover image, all from your topic." },
      { icon: CloudUpload, title: "We host everything", body: "Upload videos, PDFs and files, or embed YouTube. No servers, no extra tools, nothing to set up." },
      { icon: BadgeCheck, title: "Quality review", body: "Our team reviews your first version before it goes live and helps you fix anything that would hold it back. Edits after that go straight through." },
    ],
  },
  {
    label: "Sell",
    title: "Earn in more than one way",
    items: [
      { icon: Tag, title: "Set your own price", body: "Free, paid or anything in between. Learners pay by card, bank transfer or USSD through Paystack." },
      { icon: FileStack, title: "Sell digital products", body: "Templates, e-books, resource packs and bundles, listed in the Etivio marketplace beside your courses." },
      { icon: CalendarClock, title: "Coaching sessions", body: "Offer one-to-one sessions that learners book and pay for, right from your profile." },
      { icon: Users, title: "Group buys", body: "Learners can team up to buy your course together at a group price, which brings you more students at once." },
    ],
  },
  {
    label: "Teach",
    title: "Stay close to your students",
    items: [
      { icon: MessagesSquare, title: "Message your students", body: "Learners can ask you questions about your course, and you reply from your teaching dashboard." },
      { icon: Megaphone, title: "Course announcements", body: "Post updates to everyone in a course: new lessons, live sessions or a nudge to keep going." },
      { icon: BarChart3, title: "Student progress", body: "See who enrolled, how far each learner has got and where people get stuck." },
      { icon: Sparkles, title: "AI tutor for your learners", body: "Every lesson has an AI study partner that answers questions from your course content, so learners get help at midnight too." },
    ],
  },
  {
    label: "Grow",
    title: "Get paid and get noticed",
    items: [
      { icon: Wallet, title: "Earnings dashboard", body: "Every sale, your share and what is waiting to be paid, in one place." },
      { icon: Landmark, title: "Payouts to your bank", body: "Add your bank account once and get your earnings paid straight to it." },
      { icon: Award, title: "Certificates for your learners", body: "Learners who finish get a verifiable certificate with your name on it, which they share on CVs and LinkedIn." },
      { icon: Star, title: "Reviews and a public profile", body: "Ratings, reviews and your own tutor page at etivio.co/@you help new learners choose you." },
    ],
  },
];

const STEPS = [
  { n: "01", title: "Apply", body: "Tell us what you want to teach and your experience. It takes two minutes." },
  { n: "02", title: "Get approved", body: "The Etivio team reviews every application, usually within a few days." },
  { n: "03", title: "Build your course", body: "Use the course builder and AI assistant. We review your first version before it goes live." },
  { n: "04", title: "Publish and earn", body: "Your course goes live in the marketplace and you get paid for every sale." },
];

const FAQ = [
  { q: "Who can teach on Etivio?", a: "Anyone with real, practical experience in a skill learners want: developers, designers, marketers, founders, finance people, coaches and more. You do not need teaching experience; our tools and review help you shape a good course." },
  { q: "Does it cost anything to teach?", a: "No. Applying, building courses and publishing are free. Etivio takes a commission only when you make a sale." },
  { q: "How and when do I get paid?", a: "Your share of every sale shows in your earnings dashboard. Add your bank account in Settings, and payouts are sent to it." },
  { q: "Do I need professional video equipment?", a: "No. A phone with a clear picture and good sound is enough. You can also teach with written lessons, files and YouTube videos." },
  { q: "Why does Etivio review courses?", a: "So learners can trust every course they buy. We review your first version before it goes live and tell you clearly if anything needs fixing. Edits to a live course go straight through." },
  { q: "Can I sell things other than courses?", a: "Yes. You can sell templates, e-books, resource packs and bundles in the marketplace, and offer paid one-to-one coaching sessions." },
];

function Knots() {
  return (
    <div className="et-h2-knots" aria-hidden="true">
      <span className="et-x-rail" />
      <b className="l" />
      <b className="r" />
    </div>
  );
}

export default function TeachOnEtivio() {
  return (
    <div className={`et-h2 ${hand.variable} ${serif.variable}`}>
      <Home2Nav />
      <main className="et-ab et-tc">
        {/* Hero */}
        <section className="et-ab-hero et-h2-guided et-tc-hero">
          <span className="et-h2-mk">
            <i aria-hidden="true" /> Teach on Etivio
          </span>
          <h1>Share what you know. Get paid for it.</h1>
          <p className="et-tc-sub">
            Build a course with our course builder and AI assistant, sell templates and e-books, coach learners one to one and get paid to
            your bank account. Everything you need to teach, in one place.
          </p>
          <div className="et-ab-btns">
            <a href="#apply" className="et-ab-btn is-solid">
              <span>
                <ArrowRight size={15} aria-hidden="true" />
              </span>
              Apply to teach
            </a>
            <a href="#features" className="et-ab-btn">
              See every feature
            </a>
          </div>
          <Suspense fallback={null}>
            <Share />
          </Suspense>
        </section>

        {/* Features */}
        <div id="features">
          {GROUPS.map((g, gi) => (
            <section key={g.label} className={`et-ab-sec et-h2-guided${gi % 2 ? " is-tint" : ""}`}>
              <Knots />
              <span className="et-h2-mk">
                <i aria-hidden="true" /> {g.label}
              </span>
              <h2>{g.title}</h2>
              <div className="et-tc-grid">
                {g.items.map(({ icon: Icon, title, body }) => (
                  <article key={title}>
                    <span>
                      <Icon size={22} />
                    </span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Steps */}
        <section className="et-ab-sec et-h2-guided is-dark">
          <Knots />
          <span className="et-h2-mk">
            <i aria-hidden="true" /> How it works
          </span>
          <h2>From application to your first sale</h2>
          <ol className="et-tc-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <b>{s.n}</b>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Apply */}
        <section className="et-ab-sec et-h2-guided" id="apply">
          <Knots />
          <div className="et-tc-apply">
            <div>
              <span className="et-h2-mk">
                <i aria-hidden="true" /> Apply
              </span>
              <h2>Apply to teach</h2>
              <p className="et-tc-sub">Applications use your Etivio account, so everything you build stays in one place. We read every application and reply by email.</p>
              <ul className="et-tc-checks">
                <li>
                  <CheckCircle2 size={17} /> Free to apply and free to publish
                </li>
                <li>
                  <CheckCircle2 size={17} /> Reply within a few days
                </li>
                <li>
                  <CheckCircle2 size={17} /> Help shaping your first course
                </li>
              </ul>
            </div>
            <div className="et-tc-panel">
              <Suspense fallback={<div className="et-tc-state">Loading…</div>}>
                <ApplyPanel />
              </Suspense>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="et-ab-sec et-h2-guided is-tint">
          <Knots />
          <FaqBlock
            title={["Questions about", "teaching?"]}
            items={FAQ}
            name="teach-faq"
            more={{ title: "Still have questions?", body: "Our team is happy to help you decide.", href: "/contact", label: "Contact us" }}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

// "Keep N% of every sale", read from the platform commission so it is always accurate.
async function Share() {
  const { data } = await createAdminClient().from("platform_settings").select("commission_percent").maybeSingle();
  const pct = Number(data?.commission_percent ?? 20);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
  return (
    <div className="et-tc-share">
      <div>
        <b>{100 - pct}%</b>
        <span>of every sale is yours</span>
      </div>
      <div>
        <b>₦0</b>
        <span>to apply, build and publish</span>
      </div>
      <div>
        <b>
          <CreditCard size={30} strokeWidth={1.6} /> <BellRing size={30} strokeWidth={1.6} />
        </b>
        <span>Paid to your bank, notified on every sale</span>
      </div>
    </div>
  );
}

// Every visitor gets a clear next step: closed, sign in, already a tutor, application pending, or the form.
async function ApplyPanel() {
  const supabase = await createClient();
  const [{ data: { user } }, { tutorApplicationsOpen }] = await Promise.all([supabase.auth.getUser(), getPlatformSettings()]);

  const closed = (
    <div className="et-tc-state">
      <Clock size={20} />
      <div>
        <b>Tutor applications are closed right now.</b>
        <p>We open them in batches so every application gets a proper review. Leave your details on the contact page and we will tell you when they reopen.</p>
        <Link href="/contact" className="et-tc-btn">
          Contact us
        </Link>
      </div>
    </div>
  );

  if (!user) {
    if (!tutorApplicationsOpen) return closed;
    return (
      <div className="et-tc-state">
        <div>
          <b>Start with your Etivio account.</b>
          <p>Sign in, or create a free account in under a minute. You will come straight back here to finish your application.</p>
          <div className="et-tc-row">
            <Link href="/signup?next=/teach-on-etivio%23apply" className="et-tc-btn is-solid">
              <span>
                <ArrowRight size={15} aria-hidden="true" />
              </span>
              Create a free account
            </Link>
            <Link href="/login?next=/teach-on-etivio%23apply" className="et-tc-btn">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [{ data: roles }, { data: latest }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("role_applications").select("status, created_at, review_note").eq("user_id", user.id).eq("role", "tutor").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const isTutor = (roles ?? []).some((r) => r.role === "tutor" || r.role === "super_admin");

  if (isTutor)
    return (
      <div className="et-tc-state is-ok">
        <CheckCircle2 size={20} />
        <div>
          <b>You are already an Etivio tutor.</b>
          <p>Head to your teaching dashboard to build a course, add products or check your earnings.</p>
          <Link href="/teach" className="et-tc-btn is-solid">
            <span>
              <ArrowRight size={15} aria-hidden="true" />
            </span>
            Open your teaching dashboard
          </Link>
        </div>
      </div>
    );

  if (latest?.status === "pending")
    return (
      <div className="et-tc-state">
        <Clock size={20} />
        <div>
          <b>Your application is being reviewed.</b>
          <p>We received it on {new Date(latest.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} and will email you once it is reviewed.</p>
        </div>
      </div>
    );

  if (!tutorApplicationsOpen) return closed;

  return (
    <>
      {latest?.status === "rejected" && (
        <p className="et-tc-err" style={{ marginBottom: 16 }}>
          Your last application was not approved{latest.review_note ? `: ${latest.review_note}` : "."} You are welcome to apply again.
        </p>
      )}
      <ApplyForm email={user.email ?? "your account"} />
    </>
  );
}
