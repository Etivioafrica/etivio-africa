"use client";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";

// Shares a page with the phone's share sheet, or copies the link on desktop. `path` overrides the current address,
// e.g. to share the public page of something viewed inside the app.
export function ShareButton({ title, path, className }: { title: string; path?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = path ? `${window.location.origin}${path}` : window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" className={className} onClick={share} aria-label="Share this course">
      {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? "Link copied" : "Share"}
    </button>
  );
}
