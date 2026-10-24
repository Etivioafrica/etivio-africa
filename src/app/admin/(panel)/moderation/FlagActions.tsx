"use client";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { alertDialog, confirmDialog } from "@/components/dash/dialogs";
import { clearStrikes, decideFlag } from "./actions";

// Keep or remove one reported or caught item.
export function FlagActions({ flagId, label, hasAuthor }: { flagId: string; label: string; hasAuthor: boolean }) {
  const [strike, setStrike] = useState(true);
  const [pending, start] = useTransition();

  function decide(decision: "remove" | "keep") {
    start(async () => {
      const res = await decideFlag(flagId, decision, decision === "remove" && strike && hasAuthor);
      if (res.error) await alertDialog({ title: "Couldn't do that", body: res.error });
    });
  }

  return (
    <div className="et-md-actions">
      {hasAuthor && (
        <label className="et-md-strike">
          <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} />
          Give the author a strike
        </label>
      )}
      <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => decide("keep")}>
        <Check size={14} /> Keep it
      </button>
      <button
        type="button"
        className="et-btn et-btn-danger et-btn-sm"
        disabled={pending}
        onClick={async () => {
          const ok = await confirmDialog({
            title: `Remove this ${label.toLowerCase()}?`,
            body: label === "Course" || label === "Product" ? "It's taken off the site and sent back to the tutor." : label === "Profile" ? "Their bio, headline and photos are cleared and the profile is made private." : "It's deleted for everyone.",
            confirmLabel: "Remove",
            danger: true,
          });
          if (ok) decide("remove");
        }}
      >
        <Trash2 size={14} /> Remove
      </button>
    </div>
  );
}

export function ClearStrikes({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="et-btn et-btn-ghost et-btn-sm"
      disabled={pending}
      onClick={async () => {
        if (!(await confirmDialog({ title: "Clear all strikes?", body: "They go back to zero and can post again straight away.", confirmLabel: "Clear strikes" }))) return;
        start(async () => {
          await clearStrikes(userId);
        });
      }}
    >
      Clear strikes
    </button>
  );
}
