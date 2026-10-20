"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

// Buy buttons for paid courses and products: add to the cart and keep shopping, or buy now and go to checkout.
export function AddToCart({ item }: { item: CartItem }) {
  const cart = useCart();
  const router = useRouter();
  if (cart.has(item))
    return (
      <div className="et-buy">
        <Link href="/checkout" className="et-btn et-btn-primary et-ud-cta">
          Go to checkout
        </Link>
        <Link href="/cart" className="et-buy-note">
          <Check size={14} /> In your cart · View cart
        </Link>
      </div>
    );
  return (
    <div className="et-buy">
      <button type="button" className="et-btn et-btn-primary et-ud-cta" onClick={() => cart.add(item)}>
        <ShoppingCart size={16} /> Add to cart
      </button>
      <button
        type="button"
        className="et-btn et-ud-cta et-ud-outline"
        onClick={() => {
          cart.add(item);
          router.push("/checkout");
        }}
      >
        Buy now
      </button>
    </div>
  );
}
