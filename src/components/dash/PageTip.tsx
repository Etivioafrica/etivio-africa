"use client";
import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { updateGuide } from "@/app/(app)/guide-actions";
import { PAGE_TIPS } from "@/lib/guide";

// A one-time tip at the top of a main learner page explaining what it's for. Dismissed tips never come back.
// Tips closed since the page loaded. The shell is keyed by path, so a tab switch remounts this component, and the
// `dismissed` list from the server only updates on a full reload; this keeps a closed tip closed in between.
const closedThisSession = new Set<string>();

export function PageTip({ pathname, dismissed }: { pathname: string; dismissed: string[] }) {
  const [, rerender] = useState(0);
  const tip = PAGE_TIPS[pathname];
  if (!tip || dismissed.includes(pathname) || closedThisSession.has(pathname)) return null;

  const close = () => {
    closedThisSession.add(pathname);
    rerender((n) => n + 1);
    updateGuide({ tip: pathname });
  };

  return (
    <div className="et-page-tip" role="note">
      <span className="et-page-tip-icon">
        <Lightbulb size={17} />
      </span>
      <div>
        <b>{tip.title}</b>
        <p>{tip.body}</p>
      </div>
      <button type="button" className="et-btn et-btn-sm et-page-tip-ok" onClick={close}>
        Got it
      </button>
      <button type="button" className="et-icon-btn et-page-tip-x" onClick={close} aria-label="Dismiss tip">
        <X size={15} />
      </button>
    </div>
  );
}
