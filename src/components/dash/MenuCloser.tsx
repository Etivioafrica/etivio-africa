"use client";
import { useEffect } from "react";

// Dropdowns built on <details data-menu> stay open until their summary is clicked again, which is how browsers treat
// <details>. This closes an open one when you click or tap outside it, press Escape, or pick a link inside it.
export function MenuCloser() {
  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]");
    const down = (e: PointerEvent) => {
      for (const d of open()) if (!d.contains(e.target as Node)) d.open = false;
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.("details[data-menu] a");
      if (link) link.closest("details")!.open = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const d of open()) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return null;
}
