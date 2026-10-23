"use client";
import { useState } from "react";
import { defaultAvatar } from "@/lib/avatars";

// Profile photo with a fallback, both when there's no photo and when it fails to load: one of the character faces
// when a `seed` (the person's display name) is given, otherwise their initial.
// Google sign-in photos (lh3.googleusercontent.com) are often refused when the request carries a referrer, hence
// no-referrer. Without `className` the fallback is just the letter, for wrappers that do their own styling.
export function Avatar({ src, initial, seed, className }: { src: string | null | undefined; initial: string; seed?: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    // eslint-disable-next-line @next/next/no-img-element
    if (seed?.trim()) return <img src={defaultAvatar(seed)} alt="" className={className} />;
    return className ? <span className={className}>{initial}</span> : <>{initial}</>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
