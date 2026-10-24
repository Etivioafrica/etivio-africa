"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";

// Phones: sign-in and sign-up fit on one screen, with the logo and a few floating faces on top (no big hero).
const COMPACT = ["/login", "/signup"];
const FACES = ["/avatars/02.svg", "/avatars/08.svg", "/avatars/05.svg", "/avatars/04.svg"];

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
  const compact = COMPACT.includes(pathname);
  return (
    <div className={`et-auth${light ? " is-light" : ""}${compact ? " is-compact" : ""}`}>
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
        {compact && (
          <div className="et-auth-mtop">
            <Link href="/welcome" aria-label="Etivio">
              <img src="/etiviologo.svg" alt="Etivio" className="et-auth-mtop-logo" />
            </Link>
            <div className="et-auth-faces" aria-hidden="true">
              {FACES.map((src, i) => (
                <img key={src} src={src} alt="" className={`is-${i}`} />
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
        {compact && (
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
