import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Result } from "../helpers/fake-supabase";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/access", () => ({ activeAccess: vi.fn() }));
vi.mock("@/lib/data/access", () => ({ renewAccess: vi.fn() }));
vi.mock("@/lib/roles", () => ({ isStaff: vi.fn() }));
vi.mock("@/lib/data/grants", () => ({ grantProduct: vi.fn() }));
vi.mock("@/lib/data/group-buy", () => ({ groupPaymentCleared: vi.fn() }));
vi.mock("@/lib/data/coaching", () => ({ sessionPaid: vi.fn() }));
vi.mock("@/lib/data/coupons", () => ({ recordRedemption: vi.fn() }));
vi.mock("@/lib/email/notify", () => ({ emailGuestAccess: vi.fn(), emailOrderReceipt: vi.fn() }));
vi.mock("@/lib/data/guest", () => ({ accountForGuest: vi.fn(), maskEmail: (e: string) => `masked(${e})` }));
vi.mock("@/lib/paystack", () => ({ initializeTransaction: vi.fn() }));
vi.mock("@/lib/email/site", () => ({ siteUrl: () => "https://etivio.test" }));
// `after()` only works inside a real request; run its callback straight away.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { renewAccess } from "@/lib/data/access";
import { sessionPaid } from "@/lib/data/coaching";
import { completeFreeOrder, fulfillOrder } from "@/lib/data/checkout";
import { recordRedemption } from "@/lib/data/coupons";
import { grantProduct } from "@/lib/data/grants";
import { groupPaymentCleared } from "@/lib/data/group-buy";
import { accountForGuest } from "@/lib/data/guest";
import { emailGuestAccess, emailOrderReceipt } from "@/lib/email/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const order = (o: Record<string, unknown> = {}) => ({
  id: "order-1", reference: "ETREF1234567890", user_id: "user-1", email: "ada@example.com", first_name: "Ada", last_name: "Lovelace",
  total_minor: 500000, currency: "NGN", status: "pending", group_buy_id: null, wallet_minor: 0, purpose: "cart", coupon_id: null, discount_minor: 0, ...o,
});
const tx = (o: Record<string, unknown> = {}) => ({
  status: "success", reference: "ETREF1234567890", amount: 500000, currency: "NGN", paid_at: "2026-11-18T10:00:00Z", channel: "bank", customer: { email: "ada@example.com" }, ...o,
});
const run = (t: ReturnType<typeof tx>) => fulfillOrder(t as never);

const FLIPPED: Result = { data: { id: "order-1" } };
const NOT_FLIPPED: Result = { data: null };

type Setup = { order?: ReturnType<typeof order> | null; flip?: Result; payments?: unknown[]; owner?: unknown; paymentMethods?: Result[]; rpcs?: Record<string, Result> };
function setup({ order: o = order(), flip = FLIPPED, payments = [], owner = { user_id: "user-1" }, paymentMethods = [{ count: 0 }], rpcs = {} }: Setup = {}) {
  const db = fakeClient(
    {
      // 1: look up the order, 2: flip it to success, 3 (card payments only): re-read its owner
      orders: [{ data: o }, flip, { data: owner }],
      payments: [{ data: payments }],
      payment_methods: paymentMethods,
    },
    { spend_wallet: { data: true }, reward_referral: { data: null }, ...rpcs },
  );
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  return db;
}

describe("fulfillOrder", () => {
  beforeEach(() => vi.mocked(createAdminClient).mockReset());

  describe("lookup and idempotency", () => {
    it("reports an unknown reference and writes nothing", async () => {
      const db = setup({ order: null });
      expect(await run(tx())).toEqual({ ok: false, reason: "unknown reference" });
      expect(db.did("orders", "update")).toBe(false);
    });

    it.each([
      [{ user_id: "user-1" }, "/checkout/complete?order=ETREF1234567890"],
      [{ user_id: null }, "/checkout/complete?order=ETREF1234567890&email=" + encodeURIComponent("masked(ada@example.com)")],
      [{ purpose: "wallet_topup" }, "/learn/wallet?topup=done"],
      [{ purpose: "coach_booking" }, "/learn/sessions?booked=1"],
    ])("acknowledges an already-successful order %j with its destination and no writes", async (over, destination) => {
      const db = setup({ order: order({ status: "success", ...over }) });

      expect(await run(tx())).toEqual({ ok: true, destination });
      expect(db.did("orders", "update")).toBe(false);
      expect(grantProduct).not.toHaveBeenCalled();
    });

    it("only the delivery that flips the order does the work: a second webhook/callback grants nothing", async () => {
      const first = setup({ payments: [{ id: "pay-1", course_id: "course-1", product_id: null }] });
      await run(tx());
      expect(first.did("enrollments", "upsert")).toBe(true);
      vi.mocked(renewAccess).mockClear();

      const second = setup({ flip: NOT_FLIPPED, payments: [{ id: "pay-1", course_id: "course-1", product_id: null }] });
      const res = await run(tx());

      expect(res).toMatchObject({ ok: true });
      expect(second.did("enrollments", "upsert")).toBe(false);
      expect(renewAccess).not.toHaveBeenCalled();
      expect(emailOrderReceipt).toHaveBeenCalledTimes(1);
    });

    it("only flips a pending or previously failed order (a retry on Paystack's page can succeed after a failure)", async () => {
      const db = setup({ order: order({ status: "failed" }) });
      await run(tx());
      expect(db.argsOf("orders", "in")).toContainEqual(["status", ["pending", "failed"]]);
    });
  });

  describe("Paystack says the charge did not succeed", () => {
    it("marks the order and its payments failed, but only while still pending", async () => {
      const db = setup();

      expect(await run(tx({ status: "failed" }))).toEqual({ ok: false, reason: "failed" });

      expect(db.argsOf("orders", "update")).toEqual([[{ status: "failed" }]]);
      expect(db.argsOf("orders", "eq")).toContainEqual(["status", "pending"]);
      expect(db.argsOf("payments", "update")).toEqual([[{ status: "failed" }]]);
      expect(grantProduct).not.toHaveBeenCalled();
    });

    it("sends a failed wallet top-up to the failed-top-up screen", async () => {
      setup({ order: order({ purpose: "wallet_topup" }) });
      expect(await run(tx({ status: "failed" }))).toEqual({ ok: false, reason: "failed", destination: "/learn/wallet?topup=failed" });
    });

    it.each([["abandoned"], ["ongoing"], ["pending"], ["reversed"]])("leaves the order untouched for the non-final status %s (it may still turn into a payment)", async (status) => {
      const db = setup();
      expect(await run(tx({ status }))).toEqual({ ok: false, reason: status });
      expect(db.did("orders", "update")).toBe(false);
      expect(db.did("payments", "update")).toBe(false);
    });
  });

  describe("amount and currency must match the order exactly", () => {
    it.each([
      ["underpaid", { amount: 100 }, "Amount mismatch: paid 100 NGN"],
      ["overpaid", { amount: 600000 }, "Amount mismatch: paid 600000 NGN"],
      ["wrong currency", { currency: "USD" }, "Amount mismatch: paid 500000 USD"],
      ["zero", { amount: 0 }, "Amount mismatch: paid 0 NGN"],
    ])("fails an %s charge, records why, and grants nothing", async (_name, over, note) => {
      const db = setup({ payments: [{ id: "pay-1", course_id: "course-1", product_id: null }] });

      expect(await run(tx(over))).toEqual({ ok: false, reason: "amount mismatch" });

      expect(db.argsOf("orders", "update")[0][0]).toEqual({ status: "failed", note });
      expect(db.argsOf("payments", "update")[0][0]).toEqual({ status: "failed", note });
      expect(db.did("enrollments", "upsert")).toBe(false);
      expect(grantProduct).not.toHaveBeenCalled();
    });

    it("accepts the exact amount in the exact currency", async () => {
      setup();
      expect(await run(tx())).toMatchObject({ ok: true });
    });
  });

  describe("successful payment", () => {
    it("enrolls the buyer in a purchased course, renews access, rewards referrals and emails a receipt", async () => {
      const db = setup({ payments: [{ id: "pay-1", course_id: "course-1", product_id: null }] });

      const res = await run(tx());

      expect(res).toEqual({ ok: true, destination: "/checkout/complete?order=ETREF1234567890" });
      expect(db.argsOf("orders", "update")[0][0]).toMatchObject({ status: "success", paid_at: "2026-11-18T10:00:00Z" });
      expect(db.argsOf("enrollments", "upsert")[0][0]).toEqual({ user_id: "user-1", course_id: "course-1" });
      expect(renewAccess).toHaveBeenCalledWith("user-1", ["course-1"]);
      expect(db.rpc).toHaveBeenCalledWith("reward_referral", { p_order: "order-1" });
      expect(emailOrderReceipt).toHaveBeenCalledWith("order-1");
    });

    it("marks each payment row successful and tied to the buyer", async () => {
      const db = setup({ payments: [{ id: "pay-1", course_id: "course-1", product_id: null }] });
      await run(tx());
      expect(db.argsOf("payments", "update")[0][0]).toEqual({ status: "success", paid_at: "2026-11-18T10:00:00Z", user_id: "user-1" });
    });

    it("grants a purchased product with the payment it came from", async () => {
      setup({ payments: [{ id: "pay-9", course_id: null, product_id: "product-1" }] });
      await run(tx());
      expect(grantProduct).toHaveBeenCalledWith("user-1", "product-1", "pay-9");
    });

    it("handles a mixed cart of courses and products", async () => {
      setup({
        payments: [
          { id: "p1", course_id: "c1", product_id: null },
          { id: "p2", course_id: "c2", product_id: null },
          { id: "p3", course_id: null, product_id: "prod-1" },
        ],
      });
      await run(tx());
      expect(renewAccess).toHaveBeenCalledTimes(2);
      expect(grantProduct).toHaveBeenCalledTimes(1);
    });

    it("an order with no item rows still completes without error", async () => {
      setup({ payments: [] });
      expect(await run(tx())).toMatchObject({ ok: true });
      expect(grantProduct).not.toHaveBeenCalled();
    });

    it("records the coupon redemption against the buyer", async () => {
      setup({ order: order({ coupon_id: "coupon-1", discount_minor: 50000 }) });
      await run(tx());
      expect(recordRedemption).toHaveBeenCalledWith(expect.objectContaining({ coupon_id: "coupon-1", user_id: "user-1", discount_minor: 50000 }));
    });

    it("does not touch coupons when the order has none", async () => {
      setup();
      await run(tx());
      expect(recordRedemption).not.toHaveBeenCalled();
    });

    it("clears a group-buy member's payment instead of enrolling them directly", async () => {
      const db = setup({ order: order({ group_buy_id: "group-1" }), payments: [{ id: "p1", course_id: "c1", product_id: null }] });
      await run(tx());
      expect(groupPaymentCleared).toHaveBeenCalledWith("group-1", "user-1", "order-1");
      expect(db.did("enrollments", "upsert")).toBe(false);
    });
  });

  describe("wallet part of a mixed payment", () => {
    it("takes the wallet share once Paystack has charged the rest", async () => {
      const db = setup({ order: order({ wallet_minor: 100000 }) });
      await run(tx());
      expect(db.rpc).toHaveBeenCalledWith("spend_wallet", { p_user: "user-1", p_amount: 100000, p_order: "order-1" });
    });

    it("flags the order for manual review when the wallet couldn't cover its share, but still completes it", async () => {
      const db = setup({ order: order({ wallet_minor: 100000 }), rpcs: { spend_wallet: { data: false } } });

      const res = await run(tx());

      expect(res).toMatchObject({ ok: true });
      expect(db.argsOf("orders", "update").map(([u]) => u)).toContainEqual({ note: expect.stringMatching(/Wallet balance was too low/) });
    });

    it("does not spend from the wallet when none was used", async () => {
      const db = setup();
      await run(tx());
      expect(db.rpc).not.toHaveBeenCalledWith("spend_wallet", expect.anything());
    });
  });

  describe("wallet top-up and coaching orders", () => {
    it("credits the wallet with the order total and stops (no enrollments, no receipt)", async () => {
      const db = setup({ order: order({ purpose: "wallet_topup", total_minor: 200000 }) });

      const res = await run(tx({ amount: 200000 }));

      expect(res).toEqual({ ok: true, destination: "/learn/wallet?topup=done" });
      expect(db.argsOf("wallet_transactions", "insert")[0][0]).toMatchObject({ user_id: "user-1", amount_minor: 200000, currency: "NGN", kind: "topup", order_id: "order-1" });
      expect(db.did("enrollments", "upsert")).toBe(false);
      expect(emailOrderReceipt).not.toHaveBeenCalled();
    });

    it("credits a top-up only once, however many times Paystack tells us", async () => {
      const db = setup({ order: order({ purpose: "wallet_topup" }), flip: NOT_FLIPPED });
      await run(tx());
      expect(db.did("wallet_transactions", "insert")).toBe(false);
    });

    it("confirms a coaching booking and stops", async () => {
      const db = setup({ order: order({ purpose: "coach_booking" }) });

      const res = await run(tx());

      expect(res).toEqual({ ok: true, destination: "/learn/sessions?booked=1" });
      expect(sessionPaid).toHaveBeenCalledWith("order-1", "2026-11-18T10:00:00Z");
      expect(db.did("enrollments", "upsert")).toBe(false);
    });

    it("rejects a top-up whose amount doesn't match, so nobody can pay ₦1 and be credited ₦2,000", async () => {
      const db = setup({ order: order({ purpose: "wallet_topup", total_minor: 200000 }) });
      expect(await run(tx({ amount: 100 }))).toEqual({ ok: false, reason: "amount mismatch" });
      expect(db.did("wallet_transactions", "insert")).toBe(false);
    });
  });

  describe("guest checkout", () => {
    const guest = () => order({ user_id: null });

    it("creates the account only after payment is confirmed, links the order, and emails the login", async () => {
      vi.mocked(accountForGuest).mockResolvedValue({ userId: "new-user", password: "Temp-Pass-123" } as never);
      const db = setup({ order: guest(), payments: [{ id: "p1", course_id: "c1", product_id: null }] });

      const res = await run(tx());

      expect(accountForGuest).toHaveBeenCalledWith("ada@example.com", "Ada Lovelace");
      expect(db.argsOf("orders", "update")).toContainEqual([{ user_id: "new-user" }]);
      expect(db.argsOf("enrollments", "upsert")[0][0]).toEqual({ user_id: "new-user", course_id: "c1" });
      expect(emailGuestAccess).toHaveBeenCalledWith("order-1", "Temp-Pass-123");
      expect(res).toMatchObject({ ok: true, destination: expect.stringContaining("&email=") });
    });

    it("never creates an account for a payment that failed verification", async () => {
      setup({ order: guest() });
      await run(tx({ status: "failed" }));
      expect(accountForGuest).not.toHaveBeenCalled();
    });

    it("never creates an account for an amount mismatch", async () => {
      setup({ order: guest() });
      await run(tx({ amount: 1 }));
      expect(accountForGuest).not.toHaveBeenCalled();
    });

    it("notes 'grant access by hand' and grants nothing when the account can't be created", async () => {
      vi.mocked(accountForGuest).mockResolvedValue(null as never);
      const db = setup({ order: guest(), payments: [{ id: "p1", course_id: "c1", product_id: null }] });

      const res = await run(tx());

      expect(res).toMatchObject({ ok: true });
      expect(db.argsOf("orders", "update").map(([u]) => u)).toContainEqual({ note: expect.stringMatching(/Grant access by hand/) });
      expect(db.did("enrollments", "upsert")).toBe(false);
      expect(emailGuestAccess).not.toHaveBeenCalled();
    });

    it("does not email login details to a buyer who already had an account", async () => {
      vi.mocked(accountForGuest).mockResolvedValue({ userId: "existing-user", password: null } as never);
      setup({ order: guest() });
      await run(tx());
      expect(emailGuestAccess).not.toHaveBeenCalled();
    });
  });

  describe("saving the card", () => {
    const card = (over: Record<string, unknown> = {}) => ({ authorization_code: "AUTH_1", card_type: "Visa ", last4: "4081", exp_month: "12", exp_year: "2030", reusable: true, bank: "TEST BANK", ...over });

    it("saves a reusable card with its brand lower-cased, and makes the first one the default", async () => {
      const db = setup({ paymentMethods: [{ count: 0 }] });

      await run(tx({ channel: "card", authorization: card() }));

      expect(db.argsOf("payment_methods", "upsert")[0][0]).toEqual({
        user_id: "user-1", provider: "paystack", authorization_code: "AUTH_1", brand: "visa", last4: "4081", exp_month: 12, exp_year: 2030, bank: "TEST BANK", is_default: true,
      });
    });

    it("does not make a later card the default", async () => {
      const db = setup({ paymentMethods: [{ count: 2 }] });
      await run(tx({ channel: "card", authorization: card() }));
      expect(db.argsOf("payment_methods", "upsert")[0][0]).toMatchObject({ is_default: false });
    });

    it.each([
      ["a card marked not reusable", { channel: "card", authorization: card({ reusable: false }) }],
      ["a bank transfer", { channel: "bank_transfer", authorization: card() }],
      ["a card with no authorization", { channel: "card", authorization: undefined }],
      ["a card whose last4 is malformed", { channel: "card", authorization: card({ last4: "40" }) }],
      ["a card with no authorization code", { channel: "card", authorization: card({ authorization_code: undefined }) }],
    ])("does not save %s", async (_name, over) => {
      const db = setup();
      await run(tx(over));
      expect(db.did("payment_methods", "upsert")).toBe(false);
    });

    it("stores null for an out-of-range expiry month or year", async () => {
      const db = setup();
      await run(tx({ channel: "card", authorization: card({ exp_month: "13", exp_year: "1999" }) }));
      expect(db.argsOf("payment_methods", "upsert")[0][0]).toMatchObject({ exp_month: null, exp_year: null });
    });

    it("does not save a card for an order that has no owner", async () => {
      vi.mocked(accountForGuest).mockResolvedValue(null as never);
      const db = setup({ order: order({ user_id: null }), owner: { user_id: null } });
      await run(tx({ channel: "card", authorization: card() }));
      expect(db.did("payment_methods", "upsert")).toBe(false);
    });
  });
});

describe("completeFreeOrder (nothing left to charge: wallet and/or coupon cover it)", () => {
  beforeEach(() => vi.mocked(createAdminClient).mockReset());
  const free = (o: Record<string, unknown> = {}) => order({ total_minor: 0, ...o });

  it("completes a fully-discounted order without calling the wallet", async () => {
    const db = setup({ order: free({ coupon_id: "c1", discount_minor: 500000 }), payments: [{ id: "p1", course_id: "c1", product_id: null }] });

    const res = await completeFreeOrder("order-1");

    expect(res).toMatchObject({ ok: true, destination: "/checkout/complete?order=ETREF1234567890" });
    expect(db.rpc).not.toHaveBeenCalledWith("spend_wallet", expect.anything());
    expect(db.did("enrollments", "upsert")).toBe(true);
  });

  it("spends the wallet share first when the wallet covers the whole order", async () => {
    const db = setup({ order: free({ wallet_minor: 500000 }) });
    await completeFreeOrder("order-1");
    expect(db.rpc).toHaveBeenCalledWith("spend_wallet", { p_user: "user-1", p_amount: 500000, p_order: "order-1" });
  });

  it("fails the order and grants nothing when the wallet is too low", async () => {
    const db = setup({ order: free({ wallet_minor: 500000 }), rpcs: { spend_wallet: { data: false } }, payments: [{ id: "p1", course_id: "c1", product_id: null }] });

    expect(await completeFreeOrder("order-1")).toEqual({ ok: false });

    expect(db.argsOf("orders", "update")[0][0]).toMatchObject({ status: "failed" });
    expect(db.did("enrollments", "upsert")).toBe(false);
  });

  it("refuses an order that still has money to pay (the free path can't be used to skip Paystack)", async () => {
    const db = setup({ order: order({ total_minor: 1 }) });
    expect(await completeFreeOrder("order-1")).toEqual({ ok: false });
    expect(db.did("orders", "update")).toBe(false);
    expect(db.did("enrollments", "upsert")).toBe(false);
  });

  it("refuses a guest order that claims a wallet payment (guests have no wallet)", async () => {
    const db = setup({ order: free({ user_id: null, wallet_minor: 100 }) });
    expect(await completeFreeOrder("order-1")).toEqual({ ok: false });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns not-ok for an order that doesn't exist", async () => {
    setup({ order: null });
    expect(await completeFreeOrder("missing")).toEqual({ ok: false });
  });

  it("lets a guest complete a 100%-coupon order and creates their account then", async () => {
    vi.mocked(accountForGuest).mockResolvedValue({ userId: "new-user", password: "pw" } as never);
    setup({ order: free({ user_id: null }), payments: [{ id: "p1", course_id: "c1", product_id: null }] });
    const res = await completeFreeOrder("order-1");
    expect(res).toMatchObject({ ok: true, destination: expect.stringContaining("&email=") });
    expect(emailGuestAccess).toHaveBeenCalledWith("order-1", "pw");
  });
});
