import { beforeEach, describe, expect, it, vi } from "vitest";
import { req } from "../helpers/request";

vi.mock("@/lib/paystack", () => ({ verifyTransaction: vi.fn() }));
vi.mock("@/lib/data/checkout", () => ({ fulfillOrder: vi.fn() }));
vi.mock("@/lib/data/reminders", () => ({ remindNow: vi.fn() }));
// `after()` only works inside a real request; run its callback straight away so the test can see what it did.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { fulfillOrder } from "@/lib/data/checkout";
import { remindNow } from "@/lib/data/reminders";
import { verifyTransaction } from "@/lib/paystack";
import { GET } from "@/app/api/paystack/callback/route";

const verify = vi.mocked(verifyTransaction);
const fulfil = vi.mocked(fulfillOrder);
const remind = vi.mocked(remindNow);

const REF = "ETABCDEF123456";
const go = (query: string) => GET(req(`/api/paystack/callback${query}`));
const where = (res: Response) => {
  const u = new URL(res.headers.get("location")!);
  return `${u.pathname}${u.search}`;
};

describe("GET /api/paystack/callback (buyer returns from Paystack)", () => {
  beforeEach(() => {
    verify.mockResolvedValue({ status: true, message: "ok", data: { status: "success", reference: REF } } as never);
    fulfil.mockResolvedValue({ ok: true, destination: "/checkout/complete?order=" + REF });
  });

  describe("happy path", () => {
    it("verifies with Paystack, fulfils, and redirects to the destination fulfilment chose", async () => {
      const res = await go(`?reference=${REF}`);

      expect(res.status).toBe(307);
      expect(where(res)).toBe(`/checkout/complete?order=${REF}`);
      expect(verify).toHaveBeenCalledWith(REF);
      expect(remind).not.toHaveBeenCalled();
    });

    it("accepts Paystack's alternative 'trxref' parameter", async () => {
      await go(`?trxref=${REF}`);
      expect(verify).toHaveBeenCalledWith(REF);
    });

    it("prefers 'reference' when both parameters are present", async () => {
      await go(`?reference=${REF}&trxref=ETOTHER1234567`);
      expect(verify).toHaveBeenCalledWith(REF);
    });
  });

  describe("edge cases", () => {
    it.each([[""], ["?reference="], ["?reference=et12345678"], ["?reference=ET123"], ["?reference=" + "ET" + "A".repeat(41)]])("sends %j to /explore without calling Paystack", async (query) => {
      const res = await go(query);
      expect(where(res)).toBe("/explore");
      expect(verify).not.toHaveBeenCalled();
    });

    it("accepts the shortest and longest allowed references", async () => {
      await go("?reference=ET" + "A".repeat(8));
      await go("?reference=ET" + "9".repeat(40));
      expect(verify).toHaveBeenCalledTimes(2);
    });

    it("returns a paid-but-no-destination result to checkout with a failure notice and a reminder", async () => {
      fulfil.mockResolvedValue({ ok: false, reason: "abandoned" });
      const res = await go(`?reference=${REF}`);
      expect(where(res)).toBe("/checkout?payment=failed");
      expect(remind).toHaveBeenCalledWith(REF);
    });
  });

  describe("error handling & security", () => {
    it("treats an unverifiable transaction as failed: back to checkout, reminder queued, nothing fulfilled", async () => {
      verify.mockResolvedValue({ status: false, message: "not found" } as never);
      const res = await go(`?reference=${REF}`);
      expect(where(res)).toBe("/checkout?payment=failed");
      expect(fulfil).not.toHaveBeenCalled();
      expect(remind).toHaveBeenCalledWith(REF);
    });

    it("never trusts the query string: a request claiming success is still verified with Paystack", async () => {
      verify.mockResolvedValue({ status: false, message: "not found" } as never);
      const res = await go(`?reference=${REF}&status=success&paid=true`);
      expect(fulfil).not.toHaveBeenCalled();
      expect(where(res)).toBe("/checkout?payment=failed");
    });

    it.each([[`?reference=${REF}'%3B%20DROP%20TABLE%20orders`], [`?reference=../../admin`], [`?reference=${REF}%0d%0aSet-Cookie:x=1`]])("rejects a reference with injection characters: %s", async (query) => {
      const res = await go(query);
      expect(where(res)).toBe("/explore");
      expect(verify).not.toHaveBeenCalled();
    });

    it("only ever redirects to paths on its own site", async () => {
      fulfil.mockResolvedValue({ ok: true, destination: "/learn/wallet?topup=done" });
      const res = await go(`?reference=${REF}`);
      expect(new URL(res.headers.get("location")!).origin).toBe("https://etivio.test");
    });
  });
});
