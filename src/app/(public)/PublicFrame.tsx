"use client";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";

// Light chrome for public pages (shareable profiles) that reuses the dashboard design tokens.
export function PublicFrame({ children }: { children: React.ReactNode }) {
  const { light } = useTheme();
  return (
    <div className={`et-app et-public${light ? " is-light" : ""}`}>
      <header className="et-public-top">
        <Link href="/" aria-label="Etivio home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" className="et-brand-logo" />
        </Link>
        <nav className="et-inline">
          <button
            type="button"
            className="et-icon-btn"
            onClick={() => writeTheme(!light)}
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
          >
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <Link href="/login" className="et-btn et-btn-ghost et-btn-sm">
            Log in
          </Link>
          <Link href="/signup" className="et-btn et-btn-primary et-btn-sm">
            Get started
          </Link>
        </nav>
      </header>
      <main className="et-public-main">{children}</main>
      <footer className="et-public-foot">
        <span>© Etivio Africa</span>
        <nav className="et-inline">
          <Link href="/certificate">Verify a certificate</Link>
          <Link href="/teach-on-etivio">Teach on Etivio</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
