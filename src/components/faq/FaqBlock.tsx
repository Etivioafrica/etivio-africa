import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import "./faq.css";

// Two-column FAQ: heading and a "more questions" call to action on the left, an accordion on the right.
// Only one answer is open at a time (shared `name` on the details elements). Used on the homepage and in Learn.
export type FaqItem = { q: string; a: string };

export function FaqBlock({
  kicker = "FAQs",
  title,
  items,
  more,
  name = "faq",
  className = "",
}: {
  kicker?: string;
  title: [string, string];
  items: FaqItem[];
  more: { title: string; body: string; href: string; label: string };
  name?: string;
  className?: string;
}) {
  return (
    <section className={`et-faq ${className}`}>
      <div className="et-faq-l">
        <span className="et-faq-mk">
          <i aria-hidden="true" /> {kicker}
        </span>
        <h2>
          {title[0]}
          <br />
          {title[1]}
        </h2>
        <div className="et-faq-more">
          <b>{more.title}</b>
          <p>{more.body}</p>
          <Link href={more.href} className="et-faq-btn">
            <ArrowRight size={15} aria-hidden="true" /> {more.label}
          </Link>
        </div>
      </div>
      <div className="et-faq-list">
        {items.map((f, i) => (
          <details key={f.q} name={name} open={i === 0}>
            <summary>
              <span>{f.q}</span>
              <Plus size={24} strokeWidth={1.5} aria-hidden="true" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
