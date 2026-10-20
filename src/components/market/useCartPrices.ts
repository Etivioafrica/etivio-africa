"use client";
import { useEffect, useState } from "react";
import { priceCart } from "@/app/checkout/actions";
import type { PricedItem } from "@/lib/data/checkout";
import { cartKey, useCart } from "@/lib/cart";

// The cart with fresh prices from the server. `items` is null until the first check comes back.
export function useCartPrices() {
  const cart = useCart();
  const signature = cart.items.map(cartKey).join(",");
  const [priced, setPriced] = useState<{ for: string; items: PricedItem[] } | null>(null);

  useEffect(() => {
    let live = true;
    const refs = signature ? signature.split(",").map((k) => ({ type: k.split(":")[0] as "course" | "product", id: k.split(":")[1] })) : [];
    priceCart(refs).then((items) => live && setPriced({ for: signature, items }));
    return () => {
      live = false;
    };
  }, [signature]);

  const fresh = priced && priced.for === signature ? priced.items : null;
  const ok = fresh?.filter((i) => !i.problem) ?? [];
  return { cart, items: fresh, total: ok.reduce((n, i) => n + i.priceMinor, 0), currency: ok[0]?.currency ?? "NGN", blocked: fresh?.filter((i) => i.problem) ?? [] };
}
