import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import "./(app)/app.css";
import { PublicFrame } from "./(public)/PublicFrame";

export const metadata = { title: "Page not found | Etivio", robots: { index: false } };

export default function NotFound() {
  return (
    <PublicFrame>
      <section className="et-mkt-hero et-mkt-404">
        <span className="et-cta-icon">
          <Compass size={24} />
        </span>
        <h1>We couldn&apos;t find that page.</h1>
        <p>The link may be old, or the page may have moved. Try the marketplace, or head back home.</p>
        <div className="et-home-ctas">
          <Link href="/explore" className="et-btn et-btn-primary et-home-btn">
            Explore Etivio <ArrowRight size={16} />
          </Link>
          <Link href="/" className="et-btn et-btn-ghost et-home-btn">
            Go home
          </Link>
          <Link href="/help" className="et-btn et-btn-ghost et-home-btn">
            Help centre
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
