import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/fake-supabase";
import { UUID, post } from "../helpers/request";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/session", () => ({ sessionUser: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
import { POST } from "@/app/api/t/route";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const VISIT_ID = "223e4567-e89b-42d3-a456-426614174111";

let db: ReturnType<typeof fakeClient>;
const visit = () => db.argsOf("rpc:track_visit", "args")[0]?.[0] as Record<string, unknown>;

function hit(body: unknown, { ua = CHROME, origin = "https://etivio.test" as string | null, cookies, headers = {} }: { ua?: string; origin?: string | null; cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const h: Record<string, string> = { "user-agent": ua, ...headers };
  if (origin !== null) h.origin = origin;
  return POST(post("/api/t", { body, headers: h, cookies }));
}

describe("POST /api/t (visit tracker)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    db = fakeClient({}, { track_visit: { data: VISIT_ID } });
    vi.mocked(createAdminClient).mockReturnValue(db as never);
    vi.mocked(sessionUser).mockResolvedValue(null);
  });

  describe("happy path", () => {
    it("records a visit and sets the visitor and visit cookies", async () => {
      const res = await hit({ path: "/courses/intro-to-web" });

      expect(res.status).toBe(204);
      expect(visit()).toMatchObject({ p_path: "/courses/intro-to-web", p_channel: "Direct", p_device: "Desktop", p_browser: "Chrome", p_os: "Windows" });
      const cookies = res.headers.getSetCookie().join("\n");
      expect(cookies).toMatch(/et_vid=[0-9a-f-]{36}/);
      expect(cookies).toContain(`et_sid=${VISIT_ID}`);
      expect(cookies).toMatch(/HttpOnly/i);
      expect(cookies).toMatch(/SameSite=lax/i);
      expect(cookies).toMatch(/Secure/i);
    });

    it("works out channel, campaign and device from a tagged mobile visit", async () => {
      await hit({ path: "/explore", search: "utm_source=Twitter&utm_medium=social&utm_campaign=launch", referrer: "https://t.co/xyz" }, { ua: IPHONE });
      expect(visit()).toMatchObject({ p_utm_source: "twitter", p_utm_medium: "social", p_utm_campaign: "launch", p_channel: "Social", p_device: "Mobile", p_os: "iOS", p_new_campaign: true });
    });

    it("passes the signed-in user's id along", async () => {
      vi.mocked(sessionUser).mockResolvedValue({ id: "user-1", email: "a@b.co", providers: [] });
      await hit({ path: "/learn" });
      expect(visit()).toMatchObject({ p_user_id: "user-1" });
    });

    it("uses Vercel's location headers when present", async () => {
      await hit({ path: "/" }, { headers: { "x-vercel-ip-country": "NG", "x-vercel-ip-country-region": "LA", "x-vercel-ip-city": "Lagos" } });
      expect(visit()).toMatchObject({ p_country: "NG", p_region: "LA", p_city: "Lagos" });
    });
  });

  describe("channel detection", () => {
    it.each([
      [{ search: "utm_medium=cpc" }, "Paid"],
      [{ search: "utm_medium=email" }, "Email"],
      [{ search: "utm_source=newsletter" }, "Email"],
      [{ search: "utm_source=ios" }, "App"],
      [{ search: "utm_source=linkedin" }, "Social"],
      [{ search: "utm_source=google" }, "Search"],
      [{ search: "utm_source=partner-blog" }, "Campaign"],
      [{ referrer: "https://www.google.com/search?q=x" }, "Search"],
      [{ referrer: "https://www.facebook.com/" }, "Social"],
      [{ referrer: "https://someblog.example/post" }, "Referral"],
      [{}, "Direct"],
    ])("classifies %j as %s", async (extra, channel) => {
      await hit({ path: "/", ...extra });
      expect(visit().p_channel).toBe(channel);
    });
  });

  describe("edge cases", () => {
    it("strips the query string from the stored path", async () => {
      await hit({ path: "/blog?utm_source=x&secret=1" });
      expect(visit().p_path).toBe("/blog");
    });

    it("cuts a very long path to 300 characters", async () => {
      await hit({ path: "/" + "a".repeat(1000) });
      expect(String(visit().p_path)).toHaveLength(300);
    });

    it("does not count moving around Etivio itself as a referral", async () => {
      await hit({ path: "/learn", referrer: "https://etivio.test/explore" });
      expect(visit()).toMatchObject({ p_referrer: null, p_referrer_host: null, p_new_campaign: false });
    });

    it("tidies the referrer host (drops www. and m.)", async () => {
      await hit({ path: "/", referrer: "https://m.facebook.com/story" });
      expect(visit().p_referrer_host).toBe("facebook.com");
    });

    it("ignores a referrer that isn't a URL", async () => {
      await hit({ path: "/", referrer: "not a url" });
      expect(visit()).toMatchObject({ p_referrer: null, p_referrer_host: null });
    });

    it("reuses a valid visitor cookie and continues a valid visit cookie", async () => {
      await hit({ path: "/" }, { cookies: { et_vid: UUID, et_sid: VISIT_ID } });
      expect(visit()).toMatchObject({ p_visitor_id: UUID, p_visit_id: VISIT_ID });
    });

    it("replaces a malformed visitor cookie with a fresh id and ignores a malformed visit cookie", async () => {
      await hit({ path: "/" }, { cookies: { et_vid: "garbage", et_sid: "also-garbage" } });
      expect(visit().p_visitor_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(visit().p_visitor_id).not.toBe("garbage");
      expect(visit().p_visit_id).toBeNull();
    });

    it("reads at most 4,000 bytes of the body (a huge body can't be parsed into a visit)", async () => {
      const res = await hit({ path: "/", padding: "x".repeat(10_000) });
      expect(res.status).toBe(400); // truncated JSON is invalid
      expect(db.calls).toHaveLength(0);
    });
  });

  describe("error handling & security", () => {
    it("does nothing outside production, so local tests can't skew the reports", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const res = await hit({ path: "/" });
      expect(res.status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it.each([["Googlebot/2.1"], ["curl/8.4.0"], ["python-requests/2.31"], ["Mozilla/5.0 (compatible; AhrefsBot/7.0)"], ["HeadlessChrome/120"], ["Lighthouse"], ["Slackbot-LinkExpanding"], ["facebookexternalhit/1.1"]])("ignores the bot user agent %j", async (ua) => {
      expect((await hit({ path: "/" }, { ua })).status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it("ignores a request with no user agent", async () => {
      expect((await hit({ path: "/" }, { ua: "" })).status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it("ignores a request with no Origin header (a script, not a browser page view)", async () => {
      expect((await hit({ path: "/" }, { origin: null })).status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it.each([["null"], ["https://evil.example"], ["https://etivio.test.evil.example"], ["http://etivio.test:3000"], ["not a url"], [""]])("ignores the Origin %j without crashing", async (origin) => {
      expect((await hit({ path: "/" }, { origin })).status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it("returns 400 for a body that isn't JSON", async () => {
      const res = await POST(post("/api/t", { raw: "{nope", headers: { "user-agent": CHROME, origin: "https://etivio.test" } }));
      expect(res.status).toBe(400);
      expect(db.calls).toHaveLength(0);
    });

    it.each([[{}], [{ path: 42 }], [{ path: null }], [{ path: "blog" }], [{ path: "/admin" }], [{ path: "/admin/users" }], [{ path: "/api/t" }], [{ path: "/api" }]])("does not record the path in %j", async (body) => {
      const res = await hit(body);
      expect(res.status).toBe(204);
      expect(db.calls).toHaveLength(0);
    });

    it("sets no cookies and does not fail when the database call errors", async () => {
      db = fakeClient({}, { track_visit: { data: null, error: { message: "boom" } } });
      vi.mocked(createAdminClient).mockReturnValue(db as never);
      const res = await hit({ path: "/" });
      expect(res.status).toBe(204);
      expect(res.headers.getSetCookie()).toHaveLength(0);
    });

    it("sets no cookies when the database returns no visit id", async () => {
      db = fakeClient({}, { track_visit: { data: null } });
      vi.mocked(createAdminClient).mockReturnValue(db as never);
      expect((await hit({ path: "/" })).headers.getSetCookie()).toHaveLength(0);
    });
  });
});
