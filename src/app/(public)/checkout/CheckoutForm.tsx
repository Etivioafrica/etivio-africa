"use client";
import { Suspense, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { BookOpen, Lock, Mail, ShieldCheck, ShoppingCart, Tag, X } from "lucide-react";
import { placeOrder, previewCoupon, type CouponPreview, type PlaceOrderState } from "@/app/checkout/actions";
import { cartKey } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { Select } from "@/components/dash/Select";
import { PaymentNotice } from "@/components/market/PaymentNotice";
import { useCartPrices } from "@/components/market/useCartPrices";

export type Prefill = { firstName: string; lastName: string; email: string; country: string; state: string };

const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda", "Uganda", "Tanzania", "Egypt", "Cameroon", "Côte d'Ivoire", "Senegal", "Ethiopia", "Zambia", "United Kingdom", "United States", "Canada", "Other"];

type Applied = Extract<CouponPreview, { ok: true }>;

export function CheckoutForm({ prefill, walletMinor = 0, initialCoupon = "" }: { prefill: Prefill | null; walletMinor?: number; initialCoupon?: string }) {
  const { cart, items, total, currency, blocked } = useCartPrices();
  const [coupon, setCoupon] = useState<Applied | null>(null);
  // If the server turns the coupon down at payment (expired, used up), drop it so the buyer sees the full price.
  const [state, action] = useActionState<PlaceOrderState, FormData>(async (prev, fd) => {
    const res = await placeOrder(prev, fd);
    if (res?.couponError) setCoupon(null);
    return res;
  }, null);
  const [couponError, setCouponError] = useState("");
  const [applying, startApply] = useTransition();
  const refs = cart.items.map((i) => ({ type: i.type, id: i.id }));
  const signature = refs.map((r) => `${r.type}:${r.id}`).join(",");

  function applyCoupon(code: string) {
    if (!code.trim()) return;
    startApply(async () => {
      setCouponError("");
      const email = (document.getElementById("co-email") as HTMLInputElement | null)?.value ?? "";
      const res = await previewCoupon(code, refs, email);
      if (res.ok) setCoupon(res);
      else {
        setCoupon(null);
        setCouponError(res.error);
      }
    });
  }

  // A code from the link (/checkout?coupon=CODE) is applied once prices are in, and re-checked whenever the cart changes.
  const linkCode = useRef(initialCoupon);
  useEffect(() => {
    const code = coupon?.code ?? linkCode.current;
    if (items && code) {
      linkCode.current = "";
      applyCoupon(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, items === null]);

  const discount = coupon?.discountMinor ?? 0;
  // The coupon comes off first, then the wallet pays (group buys that didn't fill, top-ups); Paystack charges the rest.
  const afterCoupon = Math.max(0, total - discount);
  const fromWallet = Math.min(walletMinor, afterCoupon);
  const toPay = afterCoupon - fromWallet;

  // Items the server refused (already owned, no longer for sale) leave the cart.
  useEffect(() => {
    state?.drop?.forEach((k) => cart.remove(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!cart.count)
    return (
      <section className="et-card et-cart-empty">
        <Suspense fallback={null}>
          <PaymentNotice />
        </Suspense>
        <span className="et-cta-icon">
          <ShoppingCart size={24} />
        </span>
        <h2>Your cart is empty</h2>
        <p>Add something to your cart to check out.</p>
        <Link href="/explore" className="et-btn et-btn-primary">
          Explore the marketplace
        </Link>
      </section>
    );

  const ready = items !== null && !blocked.length;
  return (
    <form action={action} className="et-shop">
      <input type="hidden" name="items" value={JSON.stringify(refs)} />
      <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
      <section className="et-card et-card-pad et-checkout-form">
        <Suspense fallback={null}>
          <PaymentNotice />
        </Suspense>
        {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
        <h2>Billing details</h2>
        {prefill ? (
          <p className="et-muted et-checkout-who">
            Signed in as <b>{prefill.email}</b>. Your purchase goes straight into this account.
          </p>
        ) : (
          <p className="et-muted et-checkout-who">
            Have an account? <Link href="/login?next=/checkout">Log in</Link> for a faster checkout. New here? We&apos;ll create your account and email your login details.
          </p>
        )}
        <div className="et-form-grid">
          <div className="et-field">
            <label htmlFor="co-first">First name</label>
            <input id="co-first" name="first_name" required maxLength={60} autoComplete="given-name" defaultValue={prefill?.firstName} />
          </div>
          <div className="et-field">
            <label htmlFor="co-last">Last name</label>
            <input id="co-last" name="last_name" required maxLength={60} autoComplete="family-name" defaultValue={prefill?.lastName} />
          </div>
          <div className="et-field et-field-wide">
            <label htmlFor="co-email">Email address</label>
            <input id="co-email" name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={prefill?.email} readOnly={!!prefill} />
            {!prefill && (
              <small className="et-checkout-hint">
                <Mail size={13} /> Your receipt and login details will be sent here.
              </small>
            )}
          </div>
          <div className="et-field">
            <label htmlFor="co-phone">Phone number</label>
            <input id="co-phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+234 801 234 5678" />
          </div>
          <div className="et-field">
            <label htmlFor="co-country">Country</label>
            <Select id="co-country" name="country" defaultValue={prefill?.country && COUNTRIES.includes(prefill.country) ? prefill.country : "Nigeria"} required>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="et-field et-field-wide">
            <label htmlFor="co-state">State or city</label>
            <input id="co-state" name="state" maxLength={60} autoComplete="address-level1" placeholder="e.g. Lagos" defaultValue={prefill?.state} />
          </div>
        </div>
      </section>

      <aside className="et-card et-card-pad et-cart-summary">
        <h2>Your order</h2>
        <ul className="et-checkout-items">
          {(items ?? []).map((i) => (
            <li key={cartKey(i)} className={i.problem ? "has-problem" : undefined}>
              <span className="et-cart-thumb is-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.coverUrl ? <img src={i.coverUrl} alt="" /> : <BookOpen size={16} />}
              </span>
              <span>
                {i.title}
                {i.problem && <small>{i.problem === "owned" ? "Already yours" : "Not available"}</small>}
              </span>
              {coupon?.discounts[cartKey(i)] ? (
                <span className="et-co-price">
                  <s>{formatPrice(i.priceMinor, i.currency)}</s>
                  <b>{formatPrice(i.priceMinor - coupon.discounts[cartKey(i)], i.currency)}</b>
                </span>
              ) : (
                <b>{formatPrice(i.priceMinor, i.currency)}</b>
              )}
            </li>
          ))}
          {items === null && <li className="et-skel" style={{ height: 48 }} />}
        </ul>
        <CouponField applied={coupon} error={couponError} busy={applying} onApply={applyCoupon} onRemove={() => { setCoupon(null); setCouponError(""); }} />
        <dl>
          {discount > 0 && items && (
            <>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(total, currency)}</dd>
              </div>
              <div className="is-discount">
                <dt>
                  Coupon {coupon?.code} ({coupon?.label})
                </dt>
                <dd>−{formatPrice(discount, currency)}</dd>
              </div>
            </>
          )}
          {fromWallet > 0 && items && (
            <div>
              <dt>From your wallet</dt>
              <dd>−{formatPrice(fromWallet, currency)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>{fromWallet > 0 ? "To pay" : "Total"}</dt>
            <dd>{items ? formatPrice(toPay, currency) : "…"}</dd>
          </div>
        </dl>
        {blocked.length > 0 && (
          <p className="et-flash et-flash-warn">
            Remove the flagged {blocked.length === 1 ? "item" : "items"} from your <Link href="/cart">cart</Link> to continue.
          </p>
        )}
        <PayButton ready={ready && !applying} label={!items ? "Pay" : toPay > 0 ? `Pay ${formatPrice(toPay, currency)}` : fromWallet > 0 ? "Pay with wallet" : "Get it free"} />
        <p className="et-guest-alt">
          <Lock size={12} /> Secure payment by Paystack · card, bank transfer or USSD
        </p>
        <p className="et-guest-alt">
          <ShieldCheck size={12} /> Lifetime access · <Link href="/refund-policy">Refund policy</Link>
        </p>
      </aside>
    </form>
  );
}

// "Have a coupon?" in the order summary. Applied codes show as a chip with what they take off.
function CouponField({ applied, error, busy, onApply, onRemove }: { applied: Applied | null; error: string; busy: boolean; onApply: (code: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  if (applied)
    return (
      <div className="et-co-applied">
        <span className="et-co-tag">
          <Tag size={14} />
        </span>
        <span>
          <b>{applied.code}</b>
          <small>{applied.label} applied</small>
        </span>
        <button type="button" className="et-icon-btn" onClick={onRemove} aria-label="Remove coupon">
          <X size={15} />
        </button>
      </div>
    );
  if (!open && !error)
    return (
      <button type="button" className="et-co-open" onClick={() => setOpen(true)}>
        <Tag size={14} /> Have a coupon code?
      </button>
    );
  return (
    <div className="et-co-field">
      <div className="et-co-row">
        <input
          className="et-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply(code);
            }
          }}
          placeholder="Enter code"
          aria-label="Coupon code"
          maxLength={32}
          autoFocus
        />
        <button type="button" className="et-btn et-btn-ghost" disabled={busy || !code.trim()} onClick={() => onApply(code)}>
          {busy ? "Checking…" : "Apply"}
        </button>
      </div>
      {error && <p className="et-co-error">{error}</p>}
    </div>
  );
}

function PayButton({ ready, label }: { ready: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary et-ud-cta" disabled={!ready || pending}>
      {pending ? "Opening secure payment…" : label}
    </button>
  );
}
