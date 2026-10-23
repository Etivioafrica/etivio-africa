import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Video } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { listCoaches } from "@/lib/data/coaching";
import { featureOnForVisitor } from "@/lib/data/features";
import { formatPrice } from "@/lib/format";
import "@/components/coaching/coaching.css";

export const metadata: Metadata = {
  title: "Coaches on Etivio",
  description: "Book a 1-on-1 video session with an Etivio coach for career advice, feedback on your work, or help getting unstuck.",
  alternates: { canonical: "/coaches" },
};

type Props = { searchParams: Promise<{ topic?: string }> };

export default function CoachesPage({ searchParams }: Props) {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight">
        <h1>Learn faster with a coach</h1>
        <p>Book a 1-on-1 video session with a coach Etivio has picked. Get career advice, feedback on your work, or help getting unstuck.</p>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <Coaches searchParams={searchParams} />
      </Suspense>
      <section className="et-card et-home-cta">
        <h2>Want to coach on Etivio?</h2>
        <p>Share what you know in paid 1-on-1 sessions. Set your own hours and price.</p>
        <div className="et-home-ctas">
          <Link href="/coaches/apply" className="et-btn et-btn-primary et-home-btn">
            Apply to coach <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

async function Coaches({ searchParams }: Props) {
  const [{ topic }, on] = await Promise.all([searchParams, featureOnForVisitor("coaching")]);
  if (!on) notFound();
  const all = await listCoaches();
  const topics = [...new Set(all.flatMap((c) => c.topics))].sort();
  const coaches = topic ? all.filter((c) => c.topics.includes(topic)) : all;
  if (!all.length)
    return (
      <p className="et-card et-card-pad et-muted" style={{ textAlign: "center" }}>
        Our first coaches are getting ready. Check back soon.
      </p>
    );
  return (
    <>
      {topics.length > 1 && (
        <nav className="et-cb-topics" aria-label="Topics">
          <Link href="/coaches" className={`et-chip${!topic ? " is-on" : ""}`}>
            All
          </Link>
          {topics.map((t) => (
            <Link key={t} href={`/coaches?topic=${encodeURIComponent(t)}`} className={`et-chip${t === topic ? " is-on" : ""}`}>
              {t}
            </Link>
          ))}
        </nav>
      )}
      <div className="et-cb-grid">
        {coaches.map((c) => (
          <Link key={c.userId} href={`/coaches/${c.slug}`} className="et-card et-cb-card">
            <div className="et-cb-card-top">
              <Avatar src={c.avatar} initial={c.name.charAt(0).toUpperCase()} seed={c.name} className="et-cb-avatar" />
              <div>
                <b>{c.name}</b>
                {c.headline && <small>{c.headline}</small>}
              </div>
            </div>
            {c.topics.length > 0 && (
              <div className="et-cb-tags">
                {c.topics.slice(0, 4).map((t) => (
                  <span key={t} className="et-tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="et-cb-card-foot">
              <span>
                <Clock size={13} /> {c.minutes} min
                {c.sessions > 0 && (
                  <>
                    {" "}
                    · <Video size={13} /> {c.sessions} {c.sessions === 1 ? "session" : "sessions"}
                  </>
                )}
              </span>
              <b>{c.priceMinor > 0 ? formatPrice(c.priceMinor, c.currency) : "Free"}</b>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
