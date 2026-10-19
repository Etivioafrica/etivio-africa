"use client";
import { useSyncExternalStore } from "react";

const THEME_KEY = "etivio_theme";
const listeners = new Set<() => void>();

// Light is the default; dark only when the visitor has chosen it.
const read = () => {
  try {
    return localStorage.getItem(THEME_KEY) !== "dark";
  } catch {
    return true;
  }
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function writeTheme(light: boolean) {
  try {
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
  } catch {}
  listeners.forEach((fn) => fn());
}

export function useTheme() {
  const light = useSyncExternalStore(subscribe, read, () => true);
  return { light, dark: !light };
}
