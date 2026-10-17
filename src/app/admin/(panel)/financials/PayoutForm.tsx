"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { createPayout } from "./actions";

// Inline "pay out" row action; collapsed until opened so the balances table stays scannable.
export function PayoutForm({ instructorId, owedNaira }: { instructorId: string; owedNaira: number }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOpen(true)} disabled={owedNaira <= 0}>
        Pay out
      </button>
    );
  return (
    <ActionForm action={createPayout} className="et-inline">
      <input type="hidden" name="instructor_id" value={instructorId} />
      <input name="amount" className="et-input" defaultValue={owedNaira > 0 ? owedNaira : ""} inputMode="decimal" aria-label="Amount (₦)" style={{ width: 110, height: 32 }} />
      <input name="reference" className="et-input" placeholder="Transfer ref" aria-label="Transfer reference" style={{ width: 120, height: 32 }} />
      <label className="et-check">
        <input type="checkbox" name="paid" defaultChecked />
        Paid
      </label>
      <SubmitButton className="et-btn et-btn-primary et-btn-sm">Save</SubmitButton>
      <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </ActionForm>
  );
}
