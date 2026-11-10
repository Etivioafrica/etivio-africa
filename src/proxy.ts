import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { REF_COOKIE, cleanRefCode, refCookieOptions } from "@/lib/referral";

export async function proxy(request: NextRequest) {
  // One address for Google: www.etivio.co redirects permanently to etivio.co.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  const response = await updateSession(request);
  // Any page shared with ?ref=<code> counts as an invite, like etivio.co/r/<code>.
  const ref = cleanRefCode(request.nextUrl.searchParams.get("ref"));
  if (ref) response.cookies.set(REF_COOKIE, ref, refCookieOptions);
  return response;
}

export const config = {
  matcher: [
    // Pages whose proxy work changes what the prefetch should show (profile rewrite, auth-page redirects)
    // run on every request, prefetches included.
    "/(@.*|login|signup|welcome|verify|set-password|admin/login)",
    // Everything else skips link prefetches (each visible link fires one; layouts re-check the session anyway),
    // static files, the visit tracker, cron jobs and webhooks, to keep function usage down.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|sw\\.js|sw-push\\.js|app-sw\\.js|api/t$|api/cron|api/upload|api/paystack/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|mp4|webm|mp3|woff2?|ttf|css|js|map|txt|xml|json|pdf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
