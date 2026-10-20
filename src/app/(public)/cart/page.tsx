import type { Metadata } from "next";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Your cart | Etivio", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight et-shop-hero">
        <h1>Your cart</h1>
      </section>
      <CartView />
    </div>
  );
}
