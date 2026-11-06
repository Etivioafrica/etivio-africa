"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Laptop, Link2 } from "lucide-react";

// Wraps pages that are too heavy to use well on a phone (course and product editors). On phones the page is hidden and
// a short notice shows instead, with a button to copy the link so it can be opened later on a computer. Pure CSS
// switch (see .et-desk-* in app.css), so there is no flash and nothing depends on JavaScript to hide the editor.
export function DesktopOnly({ what, backHref, backLabel, children }: { what: string; backHref: string; backLabel: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="et-desk-only">{children}</div>
      <div className="et-desk-notice" role="note">
        <span className="et-desk-icon">
          <Laptop size={22} />
        </span>
        <h2>{what} works best on a computer</h2>
        <p>Editing needs room for videos, files and formatting. Copy this link, then open it on your laptop or desktop to continue. Your dashboard, students, messages and earnings all work here on your phone.</p>
        <button
          type="button"
          className="et-btn et-btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {}
          }}
        >
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          {copied ? "Link copied" : "Copy link for my computer"}
        </button>
        <Link href={backHref} className="et-btn et-btn-ghost">
          {backLabel}
        </Link>
      </div>
    </>
  );
}
