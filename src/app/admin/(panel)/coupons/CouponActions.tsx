"use client";
import { useState, useTransition } from "react";
import { Check, Copy, Power, Trash2 } from "lucide-react";
import { alertDialog, confirmDialog } from "@/components/dash/dialogs";
import { deleteCoupon, setCouponActive } from "./actions";

// Switch on/off and delete, at the top of a coupon's page.
export function CouponActions({ id, code, active }: { id: string; code: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="et-cp-actions">
      <button type="button" className="et-btn et-btn-ghost" disabled={pending} onClick={() => start(() => setCouponActive(id, !active))}>
        <Power size={15} /> {active ? "Switch off" : "Switch on"}
      </button>
      <button
        type="button"
        className="et-btn et-btn-ghost et-btn-danger-text"
        disabled={pending}
        onClick={async () => {
          if (!(await confirmDialog({ title: `Delete ${code}?`, body: "People won't be able to use this code any more.", confirmLabel: "Delete coupon", danger: true }))) return;
          start(async () => {
            const res = await deleteCoupon(id);
            if (res?.error) await alertDialog({ title: "Couldn't delete it", body: res.error });
          });
        }}
      >
        <Trash2 size={15} /> Delete
      </button>
    </div>
  );
}

// Copies a coupon code to the clipboard.
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="et-btn et-btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}
