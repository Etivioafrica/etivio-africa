"use client";
import { useState } from "react";

// Profile photo with the person's initial as the fallback, both when there's no photo and when it fails to load.
// Google sign-in photos (lh3.googleusercontent.com) are often refused when the request carries a referrer, hence
// no-referrer. Without `className` the fallback is just the letter, for wrappers that do their own styling.
export function Avatar({ src, initial, className }: { src: string | null | undefined; initial: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return className ? <span className={className}>{initial}</span> : <>{initial}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
