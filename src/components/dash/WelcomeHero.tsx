import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "./Avatar";
import { Ring } from "./ui";
import { FaceGrid } from "./FaceGrid";

export const DEFAULT_HERO_BG = "/hero-bg.webp";

// Dashboard banner: personal greeting and one next step, in one of three looks:
// "strip", a slim navy-to-blue band with one key number in a white card on the right;
// "faces", the text on a plain panel next to a grid of illustrated learners;
// "image", the text over the admin-set background image.
export function WelcomeHero({
  name,
  date,
  message,
  cta,
  background,
  side,
  stat,
  avatar,
  variant = "image",
}: {
  name: string;
  date: string;
  message: string;
  cta: { label: string; href: string };
  // Set by a super admin in Admin > Settings; falls back to the built-in image.
  background?: string | null;
  // Optional block on the right, e.g. the learner's overall progress.
  side?: React.ReactNode;
  // The percentage shown as a ring at the right of the strip banner; the label is its tooltip.
  stat?: { value: number; label: string } | null;
  // The learner's photo for the strip banner's tile, or their default avatar when they have none.
  avatar?: { src: string | null; seed: string };
  variant?: "image" | "faces" | "strip";
}) {
  if (variant === "strip")
    return (
      <section className="et-hero is-strip">
        {avatar && <Avatar src={avatar.src} initial={name.charAt(0).toUpperCase()} seed={avatar.seed} className="et-strip-avatar" />}
        <div className="et-strip-text">
          <h1>Hello, {name}</h1>
          <p>{message}</p>
        </div>
        <Link href={cta.href} className="et-strip-btn">
          {cta.label} <ArrowRight size={15} />
        </Link>
        {stat && (
          <div className="et-strip-stat" title={stat.label} aria-label={`${stat.label}: ${stat.value}%`}>
            <Ring value={stat.value} max={100} size={56}>
              <b>{stat.value}%</b>
            </Ring>
          </div>
        )}
      </section>
    );

  if (variant === "faces")
    return (
      <section className="et-hero is-art">
        <div className="et-hero-text">
          <span className="et-hero-date">{date}</span>
          <h1>Hello, {name}</h1>
          <p>{message}</p>
          <div className="et-hero-row">
            <Link href={cta.href} className="et-hero-btn">
              {cta.label} <ArrowRight size={16} />
            </Link>
            {side && <div className="et-hero-side">{side}</div>}
          </div>
        </div>
        <FaceGrid />
      </section>
    );

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
