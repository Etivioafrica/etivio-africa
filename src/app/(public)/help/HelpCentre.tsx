"use client";
import { useState } from "react";
import { BookOpen, CreditCard, Download, GraduationCap, Presentation, Rocket, Search, ShieldCheck } from "lucide-react";
import type { HelpTopic } from "@/lib/help";

const ICONS: Record<string, typeof BookOpen> = {
  "getting-started": Rocket,
  learning: GraduationCap,
  payments: CreditCard,
  downloads: Download,
  teaching: Presentation,
  account: ShieldCheck,
};

// Search box, topic cards and the questions, filtered as you type.
export function HelpCentre({ topics }: { topics: HelpTopic[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = topics
    .map((t) => ({ ...t, faqs: q ? t.faqs.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q)) : t.faqs }))
    .filter((t) => t.faqs.length);

  return (
    <>
      <section className="et-mkt-hero is-tight">
        <h1>How can we help?</h1>
        <p>Answers about courses, payments, downloads, teaching and your account.</p>
        <label className="et-mkt-search">
          <Search size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for an answer, like “refund” or “certificate”" aria-label="Search the help centre" />
        </label>
      </section>

      {!q && (
        <nav className="et-mkt-topics" aria-label="Help topics">
          {topics.map((t) => {
            const Icon = ICONS[t.id] ?? BookOpen;
            return (
              <a key={t.id} href={`#${t.id}`} className="et-card et-card-pad et-mkt-tile is-link">
                <span className="et-set-icon">
                  <Icon size={18} />
                </span>
                <h3>{t.title}</h3>
                <p>{t.blurb}</p>
              </a>
            );
          })}
        </nav>
      )}

      {shown.length ? (
        shown.map((t) => (
          <section key={t.id} id={t.id} className="et-mkt-faq">
            <h2>{t.title}</h2>
            <div className="et-card">
              {t.faqs.map((f) => (
                <details key={f.q} open={!!q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="et-card et-card-pad et-muted" style={{ textAlign: "center" }}>
          Nothing matches “{query}”. Try another word, or contact us below.
        </p>
      )}
    </>
  );
}
