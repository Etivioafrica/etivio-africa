import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validSignature } from "@/lib/paystack";

const SECRET = "sk_test_unit_secret";
const sign = (body: string, secret = SECRET) => createHmac("sha512", secret).update(body).digest("hex");

describe("validSignature (Paystack webhook HMAC-SHA512)", () => {
  beforeEach(() => vi.stubEnv("PAYSTACK_SECRET_KEY", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  describe("happy path", () => {
    it("accepts the signature Paystack would send for the exact raw body", () => {
      const body = JSON.stringify({ event: "charge.success", data: { reference: "ETABC12345" } });
      expect(validSignature(body, sign(body))).toBe(true);
    });

    it("accepts a body with unicode and whitespace, as long as the bytes match", () => {
      const body = '{ "event": "charge.success",\n "note": "₦5,000 — café" }';
      expect(validSignature(body, sign(body))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("rejects a missing signature header (null)", () => {
      expect(validSignature("{}", null)).toBe(false);
    });

    it("rejects an empty-string signature", () => {
      expect(validSignature("{}", "")).toBe(false);
    });

    it("rejects a signature of the wrong length without throwing", () => {
      expect(validSignature("{}", "abc123")).toBe(false);
    });

    it("rejects a same-length signature that is not valid hex", () => {
      const good = sign("{}");
      expect(validSignature("{}", "z".repeat(good.length))).toBe(false);
    });

    it("rejects an uppercase copy of a valid signature (compared as exact bytes)", () => {
      expect(validSignature("{}", sign("{}").toUpperCase())).toBe(false);
    });

    it("signs the empty body consistently", () => {
      expect(validSignature("", sign(""))).toBe(true);
    });
  });

  describe("security", () => {
    it("rejects a signature when even one character of the body changed", () => {
      const body = '{"amount":500000}';
      expect(validSignature('{"amount":500001}', sign(body))).toBe(false);
    });

    it("rejects a signature made with a different secret", () => {
      expect(validSignature("{}", sign("{}", "some_other_secret"))).toBe(false);
    });

    it("rejects everything when the secret key is not configured, even a signature made with an empty secret", () => {
      vi.stubEnv("PAYSTACK_SECRET_KEY", "");
      expect(validSignature("{}", sign("{}", ""))).toBe(false);
    });
  });
});
