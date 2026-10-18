import Link from "next/link";
import "./legal.css";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="et-legal">
      <header className="et-legal-top">
        <Link href="/learn" className="et-legal-logo">
          <img src="/etiviologo.svg" alt="Etivio" />
        </Link>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>
      <main className="et-legal-doc">{children}</main>
      <footer className="et-legal-foot">© Etivio Africa</footer>
    </div>
  );
}
