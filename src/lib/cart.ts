"use client";
import { useSyncExternalStore } from "react";

// The shopping cart lives in this browser (localStorage), so visitors can shop before signing in. It only holds
// what's needed to show the cart; prices and availability are always re-checked on the server at checkout.

export type CartItem = { type: "course" | "product"; id: string; slug: string; title: string; kind: string; priceMinor: number; currency: string; coverUrl: string | null };

const KEY = "etivio-cart";
const EVENT = "etivio-cart-change";
const MAX = 20;
const EMPTY: CartItem[] = [];

let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.items;
  }
  if (raw === cache.raw) return cache.items;
  let items: CartItem[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    items = Array.isArray(parsed) ? parsed.filter((i) => i && (i.type === "course" || i.type === "product") && typeof i.id === "string").slice(0, MAX) : EMPTY;
  } catch {}
  cache = { raw, items };
  return items;
}

function write(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const cartKey = (i: { type: string; id: string }) => `${i.type}:${i.id}`;

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    count: items.length,
    has: (i: { type: string; id: string }) => items.some((x) => cartKey(x) === cartKey(i)),
    add: (item: CartItem) => {
      const now = read();
      if (!now.some((x) => cartKey(x) === cartKey(item))) write([...now, item]);
    },
    remove: (key: string) => write(read().filter((x) => cartKey(x) !== key)),
    clear: () => write([]),
  };
}
