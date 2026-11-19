import { beforeEach, describe, expect, it, vi } from "vitest";
import { json, req } from "../helpers/request";

vi.mock("@/lib/data/reminders", () => ({ sendDueReminders: vi.fn() }));
vi.mock("@/lib/email/coaching", () => ({ sendSessionReminders: vi.fn() }));

import { sendDueReminders } from "@/lib/data/reminders";
import { sendSessionReminders } from "@/lib/email/coaching";
import { GET as checkoutReminders } from "@/app/api/cron/checkout-reminders/route";
import { GET as coachReminders } from "@/app/api/cron/coach-reminders/route";

const SECRET = "cron-secret-for-tests";

// Both cron routes share one contract: "Authorization: Bearer <CRON_SECRET>" or nothing happens.
describe.each([
  { name: "/api/cron/checkout-reminders", handler: checkoutReminders, job: vi.mocked(sendDueReminders) },
  { name: "/api/cron/coach-reminders", handler: coachReminders, job: vi.mocked(sendSessionReminders) },
])("GET $name", ({ name, handler, job }) => {
  const call = (authorization?: string) => handler(req(name, { headers: authorization === undefined ? {} : { authorization } }));

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    job.mockResolvedValue(3 as never);
  });

  describe("happy path", () => {
    it("runs the job and reports how many were sent when the bearer secret matches", async () => {
      const res = await call(`Bearer ${SECRET}`);

      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ sent: 3 });
      expect(job).toHaveBeenCalledTimes(1);
    });

    it("reports zero when nothing was due", async () => {
      job.mockResolvedValue(0 as never);
      expect(await json(await call(`Bearer ${SECRET}`))).toEqual({ sent: 0 });
    });
  });

  describe("edge cases", () => {
    it.each([[`bearer ${SECRET}`], [`Bearer  ${SECRET}`], [SECRET], [`Basic ${SECRET}`], ["Bearer "], [""]])("rejects the near-miss header %j", async (header) => {
      expect((await call(header)).status).toBe(401);
      expect(job).not.toHaveBeenCalled();
    });

    it("rejects a secret that differs by one character", async () => {
      expect((await call(`Bearer ${SECRET}x`)).status).toBe(401);
      expect((await call(`Bearer ${SECRET.slice(0, -1)}`)).status).toBe(401);
    });
  });

  describe("error handling & security", () => {
    it("returns 401 with no Authorization header", async () => {
      const res = await call();
      expect(res.status).toBe(401);
      expect(await json(res)).toEqual({ error: "Unauthorized" });
      expect(job).not.toHaveBeenCalled();
    });

    it("fails closed when CRON_SECRET is not configured, even for 'Bearer undefined'", async () => {
      vi.stubEnv("CRON_SECRET", "");
      expect((await call("Bearer undefined")).status).toBe(401);
      expect((await call("Bearer ")).status).toBe(401);
      expect((await call("Bearer")).status).toBe(401);
      expect(job).not.toHaveBeenCalled();
    });

    it("does not leak the expected secret in the error body", async () => {
      const res = await call("Bearer wrong");
      expect(JSON.stringify(await json(res))).not.toContain(SECRET);
    });

    it("lets a job failure surface as an error so the scheduler can see the run failed", async () => {
      job.mockRejectedValue(new Error("smtp down"));
      await expect(call(`Bearer ${SECRET}`)).rejects.toThrow("smtp down");
    });
  });
});
