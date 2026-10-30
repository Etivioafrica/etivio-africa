"use client";
import { useState } from "react";
import { Check, Copy, Mail, Share2 } from "lucide-react";

// The invite link with copy and share buttons. On phones the share button opens the system share sheet.
export function InviteShare({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${message} ${url}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Etivio", text: message, url });
      } catch {}
    } else copy();
  };
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { label: "X", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ];
  return (
    <div className="et-inv-share">
      <div className="et-inv-link">
        <input value={url} readOnly aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="et-inv-apps">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        ))}
        <a href={`mailto:?subject=${encodeURIComponent("Join me on Etivio")}&body=${encodeURIComponent(text)}`} aria-label="Email">
          <Mail size={15} />
        </a>
        <button type="button" onClick={share} aria-label="More ways to share">
          <Share2 size={15} />
        </button>
      </div>
    </div>
  );
}
