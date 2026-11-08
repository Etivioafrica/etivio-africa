import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPlatformSettings } from "@/lib/platform";
import { GlyphField } from "./GlyphField";
import { PixelWord } from "./PixelWord";

// Closing call to action over a glyph field, then the footer: brand, four link columns, copyright and a big wordmark.
const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Main", links: [["/explore", "Courses"], ["/tutors", "Tutors"], ["/coaches", "Coaches"], ["/blog", "Blog"], ["/about", "About"], ["/contact", "Contact"]] },
  { title: "Useful", links: [["/teach-on-etivio", "Teach on Etivio"], ["/groups", "Group buys"], ["/certificate", "Verify a certificate"], ["/help", "Help centre"]] },
  { title: "Others", links: [["/privacy", "Privacy policy"], ["/terms", "Terms and conditions"], ["/refund-policy", "Refund policy"]] },
];

async function Social() {
  const { socials } = await getPlatformSettings();
  if (!socials.length) return null;
  return (
    <nav aria-label="Social">
      <b>Social</b>
      {socials.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="et-ft">
      <section className="et-ft-cta">
        <GlyphField />
        <h2>
          Ready to learn
          <br />
          your next skill?
        </h2>
        <div className="et-ft-cta-r">
          <p>Join learners across Africa building real skills with short lessons, an AI tutor that knows your course and certificates anyone can check.</p>
          <div className="et-ft-btns">
            <Link href="/signup" className="et-ft-btn is-solid">
              <span>
                <ArrowRight size={15} aria-hidden="true" />
              </span>
              Get started free
            </Link>
            <Link href="/explore" className="et-ft-btn">
              Browse courses
            </Link>
          </div>
        </div>
      </section>

      <div className="et-ft-main">
        <div className="et-ft-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" />
          <p>Courses, a learning community and an AI study partner for learners across Africa.</p>
          <small>© 2026 Etivio Africa. All rights reserved.</small>
        </div>
        <div className="et-ft-cols">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <b>{c.title}</b>
              {c.links.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
          <Suspense fallback={null}>
            <Social />
          </Suspense>
        </div>
      </div>

      <div className="et-ft-word">
        <PixelWord />
      </div>
    </footer>
  );
}
