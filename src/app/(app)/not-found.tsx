import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = { title: "Page not found", robots: { index: false } };

// Shown when a page inside the signed-in app can't be found (a community that's gone, an old link). It keeps the app's
// sidebar and header, unlike the public 404 in app/not-found.tsx, which is for visitors outside the app.
export default function AppNotFound() {
  return (
    <div className="et-page">
      <div className="et-card et-empty et-empty-lg">
        <Compass size={28} aria-hidden />
        <h3>We couldn&apos;t find that page.</h3>
        <p>The link may be old, the page may have moved, or you may not have access to it.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <Link href="/learn" className="et-btn et-btn-primary">
            Go to dashboard
          </Link>
          <Link href="/communities" className="et-btn et-btn-ghost">
            Communities
          </Link>
          <Link href="/support" className="et-btn et-btn-ghost">
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
