"use client";
import { Suspense, useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { BookOpen, Lock, Mail, ShieldCheck, ShoppingCart } from "lucide-react";
import { placeOrder, type PlaceOrderState } from "@/app/checkout/actions";
import { cartKey } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { Select } from "@/components/dash/Select";
import { PaymentNotice } from "@/components/market/PaymentNotice";
import { useCartPrices } from "@/components/market/useCartPrices";

export type Prefill = { firstName: string; lastName: string; email: string; country: string; state: string };

const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda", "Uganda", "Tanzania", "Egypt", "Cameroon", "Côte d'Ivoire", "Senegal", "Ethiopia", "Zambia", "United Kingdom", "United States", "Canada", "Other"];

export function CheckoutForm({ prefill }: { prefill: Prefill | null }) {
  const { cart, items, total, currency, blocked } = useCartPrices();
  const [state, action] = useActionState<PlaceOrderState, FormData>(placeOrder, null);

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
      <input type="hidden" name="items" value={JSON.stringify(cart.items.map((i) => ({ type: i.type, id: i.id })))} />
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
              <b>{formatPrice(i.priceMinor, i.currency)}</b>
            </li>
          ))}
          {items === null && <li className="et-skel" style={{ height: 48 }} />}
        </ul>
        <dl>
          <div className="is-total">
            <dt>Total</dt>
            <dd>{items ? formatPrice(total, currency) : "…"}</dd>
          </div>
        </dl>
        {blocked.length > 0 && (
          <p className="et-flash et-flash-warn">
            Remove the flagged {blocked.length === 1 ? "item" : "items"} from your <Link href="/cart">cart</Link> to continue.
          </p>
        )}
        <PayButton ready={ready} label={items ? `Pay ${formatPrice(total, currency)}` : "Pay"} />
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

function PayButton({ ready, label }: { ready: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary et-ud-cta" disabled={!ready || pending}>
      {pending ? "Opening secure payment…" : label}
    </button>
  );
}
