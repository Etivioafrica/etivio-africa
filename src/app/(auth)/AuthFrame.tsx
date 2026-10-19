"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";

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
  return (
    <div className={`et-auth${light ? " is-light" : ""}`}>
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
        <header className="et-auth-top">
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
