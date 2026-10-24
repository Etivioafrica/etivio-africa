import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const DEFAULT_HERO_BG = "/hero-bg.webp";

// Dashboard banner: personal greeting and one next step, over the admin-set background image.
export function WelcomeHero({
  name,
  date,
  message,
  cta,
  background,
  side,
}: {
  name: string;
  date: string;
  message: string;
  cta: { label: string; href: string };
  // Set by a super admin in Admin > Settings; falls back to the built-in image.
  background?: string | null;
  // Optional block on the right, e.g. the learner's overall progress.
  side?: React.ReactNode;
}) {
  return (
    <section className="et-hero" style={{ backgroundImage: `url("${background || DEFAULT_HERO_BG}")` }}>
      <div className="et-hero-text">
        <span className="et-hero-date">{date}</span>
        <h1>Hello, {name}</h1>
        <p>{message}</p>
        <Link href={cta.href} className="et-hero-btn">
          {cta.label} <ArrowRight size={16} />
        </Link>
      </div>
      {side && <div className="et-hero-side">{side}</div>}
    </section>
  );
}
