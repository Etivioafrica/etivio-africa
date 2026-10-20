import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're offline | Etivio", robots: { index: false } };

// Shown by the app's service worker when a page can't load because there's no connection. Plain styles only, so it
// renders from the cache without anything else.
export default function Offline() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: "#060b18", color: "#f1f5fb", fontFamily: "system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: 16 }} />
      <h1 style={{ margin: "6px 0 0", fontSize: 22 }}>You&apos;re offline</h1>
      <p style={{ margin: 0, maxWidth: 300, color: "#8a94a8", fontSize: 15, lineHeight: 1.5 }}>Etivio needs a connection to load your courses. Check your Wi-Fi or mobile data and try again.</p>
      {/* A plain link reload, since this page has no JavaScript of its own. */}
      <a href="/learn" style={{ marginTop: 8, padding: "13px 26px", borderRadius: 999, background: "#2563eb", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
        Try again
      </a>
    </main>
  );
}
