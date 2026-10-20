"use client";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";

// The order is paid, so the browser's cart is done with.
export function ClearCart() {
  const { clear, count } = useCart();
  useEffect(() => {
    if (count) clear();
  }, [count, clear]);
  return null;
}
