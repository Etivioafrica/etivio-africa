"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Copies an absolute link to a path on the current site.
export function CopyLink({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="et-btn et-btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
    >
      {copied ? <Check size={15} /> : <Link2 size={15} />}
      {copied ? "Copied" : label}
    </button>
  );
}
