import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, MapPin, Package, Users } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { getPublicTutors } from "@/lib/data/site";

export const metadata: Metadata = {
  title: "Tutors on Etivio",
  description: "Meet the practitioners teaching courses and making templates, e-books and resource packs on Etivio.",
  alternates: { canonical: "/tutors" },
};

export default function TutorsPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight">
        <h1>Meet the tutors</h1>
        <p>Practitioners from across Africa, teaching what they do every day.</p>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <Tutors />
      </Suspense>
      <section className="et-card et-home-cta">
        <h2>Know something worth teaching?</h2>
        <p>Build a course or sell your templates and guides to learners across Africa.</p>
        <div className="et-home-ctas">
          <Link href="/teach-on-etivio" className="et-btn et-btn-primary et-home-btn">
            Apply to teach <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

async function Tutors() {
  const tutors = await getPublicTutors();
  if (!tutors.length)
    return (
      <p className="et-card et-card-pad et-muted" style={{ textAlign: "center" }}>
        Tutor profiles will appear here as our first tutors publish. Browse <Link href="/explore" style={{ color: "var(--accent)", fontWeight: 600 }}>the marketplace</Link> in the meantime.
      </p>
    );
  return (
    <div className="et-mkt-tutors">
      {tutors.map((t) => (
        <Link key={t.id} href={`/@${t.username}`} className="et-card et-card-pad et-mkt-tutor">
          <Avatar src={t.avatar} initial={t.name.charAt(0).toUpperCase()} seed={t.name} className="et-mkt-tutor-avatar" />
          <b>{t.name}</b>
          {t.headline && <small>{t.headline}</small>}
          {t.location && (
            <small className="et-inline">
              <MapPin size={13} /> {t.location}
            </small>
          )}
          <p className="et-mkt-tutor-stats">
            {t.courses > 0 && (
              <span>
                <BookOpen size={13} /> {t.courses} {t.courses === 1 ? "course" : "courses"}
              </span>
            )}
            {t.products > 0 && (
              <span>
                <Package size={13} /> {t.products} {t.products === 1 ? "product" : "products"}
              </span>
            )}
            {t.students > 0 && (
              <span>
                <Users size={13} /> {t.students.toLocaleString()} {t.students === 1 ? "learner" : "learners"}
              </span>
            )}
          </p>
        </Link>
      ))}
    </div>
  );
}
