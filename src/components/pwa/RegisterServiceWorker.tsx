"use client";
import { useEffect } from "react";

// Installs the app's service worker (public/app-sw.js) in production. It takes over from the old app's workers at
// /sw.js and /sw-push.js, which share the same scope.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/app-sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
