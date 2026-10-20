"use client";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

// Header cart icon with the number of items. Hidden while the cart is empty unless `always` is set.
export function CartButton({ always = false }: { always?: boolean }) {
  const { count } = useCart();
  if (!count && !always) return null;
  return (
    <Link href="/cart" className="et-icon-btn et-cart-btn" aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"} data-tip="Cart">
      <ShoppingCart size={17} />
      {count > 0 && <span className="et-cart-count">{count}</span>}
    </Link>
  );
}
