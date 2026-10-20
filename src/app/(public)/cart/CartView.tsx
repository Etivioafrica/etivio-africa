"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Layers, LayoutTemplate, Lock, Package, ShoppingCart, Trash2 } from "lucide-react";
import { cartKey } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useCartPrices } from "@/components/market/useCartPrices";
import type { PricedItem } from "@/lib/data/checkout";

const ICONS: Record<string, typeof BookOpen> = { course: BookOpen, template: LayoutTemplate, ebook: FileText, resource_pack: Package, bundle: Layers };
const LABELS: Record<string, string> = { course: "Course", template: "Template", ebook: "E-book", resource_pack: "Resource pack", bundle: "Bundle" };
const PROBLEMS: Record<NonNullable<PricedItem["problem"]>, string> = {
  owned: "You already have this. Remove it to continue.",
  unavailable: "No longer available. Remove it to continue.",
  free: "This is free now, so get it from its page instead.",
};

export function CartView() {
  const { cart, items, total, currency, blocked } = useCartPrices();

  if (!cart.count)
    return (
      <section className="et-card et-cart-empty">
        <span className="et-cta-icon">
          <ShoppingCart size={24} />
        </span>
        <h2>Your cart is empty</h2>
        <p>Find a course, template or guide you like and add it here.</p>
        <Link href="/explore" className="et-btn et-btn-primary">
          Explore the marketplace
        </Link>
      </section>
    );

  return (
    <div className="et-shop">
      <section className="et-card et-cart-list">
        <div className="et-card-head">
          <h2>
            {cart.count} {cart.count === 1 ? "item" : "items"} in your cart
          </h2>
        </div>
        <ul>
          {(items ?? cart.items.map((i) => ({ ...i, href: "#", problem: null, sellerId: "" }) as PricedItem)).map((i) => {
            const Icon = ICONS[i.kind] ?? BookOpen;
            return (
              <li key={cartKey(i)} className={i.problem ? "has-problem" : undefined}>
                <Link href={i.href} className="et-cart-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.coverUrl ? <img src={i.coverUrl} alt="" /> : <Icon size={20} />}
                </Link>
                <div className="et-cart-main">
                  <small>{LABELS[i.kind] ?? "Product"}</small>
                  <Link href={i.href}>
                    <b>{i.title}</b>
                  </Link>
                  {i.problem && <p className="et-cart-problem">{PROBLEMS[i.problem]}</p>}
                </div>
                <b className="et-cart-price">{items ? formatPrice(i.priceMinor, i.currency) : <span className="et-skel" style={{ display: "inline-block", width: 60, height: 16 }} />}</b>
                <button type="button" className="et-icon-btn" onClick={() => cart.remove(cartKey(i))} aria-label={`Remove ${i.title}`} data-tip="Remove">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="et-card et-card-pad et-cart-summary">
        <h2>Order summary</h2>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{items ? formatPrice(total, currency) : "…"}</dd>
          </div>
          <div className="is-total">
            <dt>Total</dt>
            <dd>{items ? formatPrice(total, currency) : "…"}</dd>
          </div>
        </dl>
        {blocked.length > 0 ? (
          <button type="button" className="et-btn et-btn-primary et-ud-cta" disabled>
            Remove the flagged {blocked.length === 1 ? "item" : "items"} to continue
          </button>
        ) : (
          <Link href="/checkout" className="et-btn et-btn-primary et-ud-cta" aria-disabled={!items}>
            Proceed to checkout <ArrowRight size={16} />
          </Link>
        )}
        <Link href="/explore" className="et-btn et-btn-ghost et-ud-cta">
          Continue shopping
        </Link>
        <p className="et-guest-alt">
          <Lock size={12} /> Secure payment by Paystack
        </p>
      </aside>
    </div>
  );
}
