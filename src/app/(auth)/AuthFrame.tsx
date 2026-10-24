"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";

// Phones get a blue hero on top of sign-in and sign-up, with the form underneath.
const PHONE_HERO: Record<string, { lines: string[]; body: string }> = {
  "/login": { lines: ["Welcome", "back."], body: "Pick up where you left off. Your courses, streaks and certificates are waiting." },
  "/signup": { lines: ["Learn.", "Grow.", "Earn."], body: "Practical courses from people who do the work, across Africa. Free to join." },
};
const CARDS = ["/avatars/02.svg", "/avatars/08.svg", "/avatars/04.svg"];

export function AuthFrame({
  children,
  title = "Learn the skills that move you forward.",
  body = "Courses from instructors across Africa, built for how you actually learn.",
  badge,
}: {
  children: React.ReactNode;
  title?: string;
  body?: string;
  badge?: string;
}) {
  const { light } = useTheme();
  const pathname = usePathname();
  const hero = PHONE_HERO[pathname];
  return (
    <div className={`et-auth${light ? " is-light" : ""}${hero ? " has-mhero" : ""}`}>
      <aside className="et-auth-hero">
        <div className="et-auth-photo">
          <img src="/etiviologo.svg" alt="Etivio" className="et-auth-logo" />
          <div className="et-auth-caption">
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        </div>
      </aside>
      <section className="et-auth-panel">
        {hero && (
          <div className="et-auth-mhero">
            <Link href="/welcome" aria-label="Etivio">
              <img src="/etiviologo.svg" alt="Etivio" className="et-auth-mhero-logo" />
            </Link>
            <h2>
              {hero.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <p>{hero.body}</p>
            <div className="et-auth-mcards" aria-hidden="true">
              {CARDS.map((src, i) => (
                <span key={src} className={`is-${i}`}>
                  <img src={src} alt="" />
                </span>
              ))}
            </div>
          </div>
        )}
        <header className="et-auth-top">
          {/* Phones don't show the photo side, so the logo sits here (and leads back to the app's start screen). */}
          <Link href="/welcome" className="et-auth-mlogo" aria-label="Etivio">
            <img src="/etiviologo.svg" alt="Etivio" />
          </Link>
          <button
            type="button"
            className="et-auth-theme"
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            onClick={() => writeTheme(!light)}
          >
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {pathname === "/login" ? (
            <p className="et-auth-switch">
              New to Etivio? <Link href="/signup">Create an account</Link>
            </p>
          ) : pathname === "/signup" ? (
            <p className="et-auth-switch">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          ) : (
            badge && (
              <span className="et-auth-badge">
                <span />
                {badge}
              </span>
            )
          )}
        </header>
        <div className="et-auth-main">{children}</div>
        {hero && (
          <p className="et-auth-malt">
            {pathname === "/login" ? (
              <>
                New to Etivio? <Link href="/signup">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            )}
          </p>
        )}
        <footer className="et-auth-foot">
          <span>© Etivio Africa</span>
          <nav>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </section>
    </div>
  );
}
