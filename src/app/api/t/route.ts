import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";

// Visit tracking for the admin Traffic page. VisitTracker posts here on every page change; this works out the
// channel, country and device and records the hit with track_visit(). Two first-party cookies: et_vid (the
// browser, one year) and et_sid (the current visit, 30 minutes from the last page).

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|monitor|curl|wget|python|axios/i;
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd|tiktok|youtube|youtu\.be|whatsapp|wa\.me|reddit|pinterest|threads|snapchat|telegram|t\.me)/;
const PAID = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|display|ads?)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clip = (s: string | null | undefined, n = 200) => (s ? s.slice(0, n) : null);

function channelFor(host: string | null, source: string | null, medium: string | null) {
  if (medium && PAID.test(medium)) return "Paid";
  if (medium === "email" || source === "email" || source === "newsletter") return "Email";
  if (source === "ios" || source === "android") return "App";
  const s = source?.toLowerCase() ?? null;
  if (s && SOCIAL.test(`${s}.`)) return "Social";
  if (s && SEARCH.test(`${s}.`)) return "Search";
  if (s) return "Campaign";
  if (host && SEARCH.test(host)) return "Search";
  if (host && SOCIAL.test(host)) return "Social";
  if (host) return "Referral";
  return "Direct";
}

function deviceFor(ua: string) {
  const device = /ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? "Tablet" : /mobi|iphone|ipod|android/i.test(ua) ? "Mobile" : "Desktop";
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /samsungbrowser/i.test(ua) ? "Samsung Internet" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /iphone|ipad|ipod/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

export async function POST(request: NextRequest) {
  // Local development shares the live database but has no location data; its test visits would skew the reports.
  if (process.env.NODE_ENV !== "production") return new NextResponse(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  const origin = request.headers.get("origin");
  if (!ua || BOTS.test(ua) || (origin && new URL(origin).host !== request.nextUrl.host)) return new NextResponse(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown; search?: unknown };
  try {
    body = JSON.parse((await request.text()).slice(0, 4000));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.split("?")[0].slice(0, 300) : null;
  if (!path || path.startsWith("/admin") || path.startsWith("/api")) return new NextResponse(null, { status: 204 });

  const params = new URLSearchParams(typeof body.search === "string" ? body.search : "");
  const utm = {
    source: clip(params.get("utm_source") ?? params.get("source") ?? params.get("ref"), 100)?.toLowerCase() ?? null,
    medium: clip(params.get("utm_medium"), 100)?.toLowerCase() ?? null,
    campaign: clip(params.get("utm_campaign"), 150),
    term: clip(params.get("utm_term"), 150),
    content: clip(params.get("utm_content"), 150),
  };

  let referrer: string | null = null;
  let referrerHost: string | null = null;
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      const r = new URL(body.referrer);
      // Moving around Etivio itself isn't a referral.
      if (r.host !== request.nextUrl.host && !r.host.endsWith("etivio.co")) {
        referrerHost = r.host.replace(/^www\./, "").replace(/^(m|l|lm)\./, "");
        referrer = clip(`${r.origin}${r.pathname}`, 300);
      }
    } catch {}
  }

  const vidCookie = request.cookies.get("et_vid")?.value;
  const sidCookie = request.cookies.get("et_sid")?.value;
  const visitorId = vidCookie && UUID.test(vidCookie) ? vidCookie : crypto.randomUUID();
  const visitId = sidCookie && UUID.test(sidCookie) ? sidCookie : null;
  const user = await sessionUser(await createClient());
  const city = request.headers.get("x-vercel-ip-city");
  const { device, browser, os } = deviceFor(ua);

  const { data: id, error } = await createAdminClient().rpc("track_visit", {
    p_visit_id: visitId as string,
    p_visitor_id: visitorId,
    p_user_id: (user?.id ?? null) as string,
    p_path: path,
    // Opening a new campaign link or arriving from another site starts a fresh visit, so it gets the credit.
    p_new_campaign: Boolean(utm.source || utm.campaign || referrerHost),
    p_referrer: referrer as string,
    p_referrer_host: referrerHost as string,
    p_utm_source: utm.source as string,
    p_utm_medium: utm.medium as string,
    p_utm_campaign: utm.campaign as string,
    p_utm_term: utm.term as string,
    p_utm_content: utm.content as string,
    p_channel: channelFor(referrerHost, utm.source, utm.medium),
    p_country: clip(request.headers.get("x-vercel-ip-country"), 2) as string,
    p_region: clip(request.headers.get("x-vercel-ip-country-region"), 10) as string,
    p_city: (city ? clip(decodeURIComponent(city), 80) : null) as string,
    p_device: device,
    p_browser: browser,
    p_os: os,
  });
  if (error || !id) return new NextResponse(null, { status: 204 });

  const res = new NextResponse(null, { status: 204 });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("et_vid", visitorId, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", secure, path: "/" });
  res.cookies.set("et_sid", id, { maxAge: 60 * 30, httpOnly: true, sameSite: "lax", secure, path: "/" });
  return res;
}
