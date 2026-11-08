import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import { featuredSubmissions, openProjects, LEVELS } from "@/lib/data/projects";

export const metadata: Metadata = {
  title: "Projects | Etivio",
  description: "Practical project briefs from Etivio tutors, and a showcase of the best work learners have built.",
  alternates: { canonical: "/projects" },
};

export default function ProjectsPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero">
        <span className="et-home-pill">Projects</span>
        <h1>Learn by building real work.</h1>
        <p>Practical briefs set by Etivio tutors. Build it, hand it in, get feedback, and the best work is featured here for anyone to see.</p>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 320, marginTop: 24 }} />}>
        <Lists />
      </Suspense>
    </div>
  );
}

async function Lists() {
  const [projects, featured] = await Promise.all([openProjects(30), featuredSubmissions(24)]);
  return (
    <>

      <section className="et-card" style={{ marginTop: 24 }}>
        <div className="et-card-head">
          <h2>Open briefs</h2>
        </div>
        {projects.length ? (
          <div className="et-card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18, border: "1px solid var(--a-border)", borderRadius: 12 }}>
                <small className="et-muted">{LEVELS[p.level]} · by {p.authorName}</small>
                <b style={{ fontSize: 17 }}>{p.title}</b>
                {p.skills.length > 0 && <small className="et-muted">{p.skills.join(" · ")}</small>}
                <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
                  {p.submissions} submission{p.submissions === 1 ? "" : "s"} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="et-card-pad et-muted">No open briefs right now. Check back soon.</p>
        )}
      </section>

      <section className="et-card" style={{ marginTop: 24 }}>
        <div className="et-card-head">
          <h2>Showcase</h2>
        </div>
        {featured.length ? (
          <div className="et-card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {featured.map((s) => (
              <article key={s.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18, border: "1px solid var(--a-border)", borderRadius: 12 }}>
                <b style={{ fontSize: 17 }}>{s.title}</b>
                <small className="et-muted">by {s.username ? <Link href={`/@${s.username}`}>{s.name}</Link> : s.name}</small>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{s.summary.length > 220 ? `${s.summary.slice(0, 220)}…` : s.summary}</p>
                <div style={{ display: "flex", gap: 14, marginTop: "auto", fontSize: 14 }}>
                  <Link href={`/projects/${s.projectId}`}>See the brief</Link>
                  {s.linkUrl && (
                    <a href={s.linkUrl} target="_blank" rel="noreferrer nofollow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ExternalLink size={13} /> View work
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="et-card-pad et-muted">Featured work will appear here once tutors pick their favourites.</p>
        )}
      </section>
    </>
  );
}
