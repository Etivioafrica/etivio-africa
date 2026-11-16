import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  // The old-PWA kill switch must never be cached, so browsers pick it up on their next update check.
  async headers() {
    return [
      // Every page: no other site may show Etivio inside a frame (stops click-tricking signed-in people), browsers
      // must not guess file types, and other sites only learn our domain, not the page someone came from.
      // Camera and microphone stay available to Etivio itself for coaching calls.
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
        ],
      },
      ...["/sw.js", "/sw-push.js"].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      })),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
