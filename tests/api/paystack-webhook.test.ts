import { beforeEach, describe, expect, it, vi } from "vitest";
import { json, post } from "../helpers/request";

vi.mock("@/lib/paystack", () => ({ validSignature: vi.fn(), verifyTransaction: vi.fn() }));
vi.mock("@/lib/data/checkout", () => ({ fulfillOrder: vi.fn() }));

import { fulfillOrder } from "@/lib/data/checkout";
import { validSignature, verifyTransaction } from "@/lib/paystack";
import { POST } from "@/app/api/paystack/webhook/route";

const sigOk = vi.mocked(validSignature);
const verify = vi.mocked(verifyTransaction);
const fulfil = vi.mocked(fulfillOrder);

const event = (over: Record<string, unknown> = {}) => JSON.stringify({ event: "charge.success", data: { reference: "ETABC12345XYZ" }, ...over });
const call = (raw: string, signature: string | null = "sig") => POST(post("/api/paystack/webhook", { raw, headers: signature === null ? {} : { "x-paystack-signature": signature } }));

describe("POST /api/paystack/webhook", () => {
  beforeEach(() => {
    sigOk.mockReturnValue(true);
    verify.mockResolvedValue({ status: true, message: "ok", data: { status: "success", reference: "ETABC12345XYZ", amount: 500000, currency: "NGN" } } as never);
    fulfil.mockResolvedValue({ ok: true });
  });

  describe("happy path", () => {
    it("verifies the charge with Paystack, fulfils the order and acknowledges with 200", async () => {
      const res = await call(event());

      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ received: true });
      expect(verify).toHaveBeenCalledWith("ETABC12345XYZ");
      expect(fulfil).toHaveBeenCalledWith(expect.objectContaining({ reference: "ETABC12345XYZ", amount: 500000 }));
    });

    it("checks the signature against the exact raw body and header it received", async () => {
      const raw = event();
      await call(raw, "the-signature");
      expect(sigOk).toHaveBeenCalledWith(raw, "the-signature");
    });
  });

  describe("edge cases", () => {
    it("acknowledges but ignores events other than charge.success", async () => {
      const res = await call(event({ event: "transfer.success" }));
      expect(res.status).toBe(200);
      expect(verify).not.toHaveBeenCalled();
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("acknowledges but does nothing when charge.success has no reference", async () => {
      const res = await call(JSON.stringify({ event: "charge.success", data: {} }));
      expect(res.status).toBe(200);
      expect(verify).not.toHaveBeenCalled();
    });

    it("acknowledges but does nothing when charge.success has no data object", async () => {
      expect((await call(JSON.stringify({ event: "charge.success" }))).status).toBe(200);
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("does not fulfil when Paystack says the transaction could not be verified", async () => {
      verify.mockResolvedValue({ status: false, message: "Transaction reference not found" } as never);
      const res = await call(event());
      expect(res.status).toBe(200);
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("does not fulfil when verification succeeds but carries no data", async () => {
      verify.mockResolvedValue({ status: true, message: "ok" } as never);
      await call(event());
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("can be delivered twice: each delivery is verified and passed on (idempotency lives in fulfillOrder)", async () => {
      await call(event());
      await call(event());
      expect(fulfil).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling & security", () => {
    it("rejects a bad signature with 401 and does no work", async () => {
      sigOk.mockReturnValue(false);
      const res = await call(event(), "forged");
      expect(res.status).toBe(401);
      expect(await json(res)).toEqual({ error: "Bad signature" });
      expect(verify).not.toHaveBeenCalled();
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("rejects a request with no signature header", async () => {
      sigOk.mockReturnValue(false);
      expect((await call(event(), null)).status).toBe(401);
      expect(sigOk).toHaveBeenCalledWith(expect.any(String), null);
    });

    it("never trusts amounts in the webhook payload: fulfils with what Paystack's verify call returned", async () => {
      const forged = JSON.stringify({ event: "charge.success", data: { reference: "ETABC12345XYZ", amount: 1, currency: "NGN", status: "success" } });
      await call(forged);
      expect(fulfil).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
      expect(fulfil).not.toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
    });

    it("lets fulfilment errors propagate (a 5xx makes Paystack retry the webhook)", async () => {
      fulfil.mockRejectedValue(new Error("database down"));
      await expect(call(event())).rejects.toThrow("database down");
    });

    it("lets a Paystack verification outage propagate so the event is retried", async () => {
      verify.mockRejectedValue(new Error("network"));
      await expect(call(event())).rejects.toThrow("network");
      expect(fulfil).not.toHaveBeenCalled();
    });

    it("does not parse an unsigned body at all (invalid JSON with a bad signature is still a clean 401)", async () => {
      sigOk.mockReturnValue(false);
      const res = await call("{not json", "forged");
      expect(res.status).toBe(401);
    });
  });
});
