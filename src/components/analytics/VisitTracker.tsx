"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Sends each page change to /api/t for the admin Traffic page. The referrer only means something on the first
// page of a load (after that, moves are inside Etivio), so it's sent once.
export function VisitTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    // The ref also stops React's dev double-run from counting a page twice.
    if (pathname.startsWith("/admin") || pathname === "/tour" || last.current === pathname) return;
    const referrer = last.current === null ? document.referrer : "";
    last.current = pathname;
    fetch("/api/t", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer, search: location.search }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
