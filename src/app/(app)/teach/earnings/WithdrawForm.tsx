"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { requestWithdrawal, type WithdrawState } from "./actions";

export function WithdrawForm({ availableMinor, minMinor, bank }: { availableMinor: number; minMinor: number; bank: string }) {
  const [state, action] = useActionState<WithdrawState, FormData>(requestWithdrawal, null);
  const [amount, setAmount] = useState("");
  const canWithdraw = availableMinor >= minMinor;
  return (
    <form action={action} className="et-wl-topup">
      <label htmlFor="wd-amount">Withdraw to {bank}</label>
      <div className="et-wl-row">
        <span className="et-wl-naira">₦</span>
        <input id="wd-amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Up to ${formatMoney(availableMinor)}`} disabled={!canWithdraw} />
        <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setAmount(String(Math.floor(availableMinor / 100)))} disabled={!canWithdraw}>
          All
        </button>
        <Submit disabled={!canWithdraw} />
      </div>
      {state?.error && <p className="et-gb-error">{state.error}</p>}
      {state?.ok && <p className="et-wd-ok">{state.ok}</p>}
      <small>{canWithdraw ? `Minimum ${formatMoney(minMinor)}. Etivio sends it to your bank and marks it paid here.` : `You can withdraw once you have at least ${formatMoney(minMinor)} available.`}</small>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary" disabled={disabled || pending}>
      <ArrowUpRight size={15} /> {pending ? "Sending…" : "Withdraw"}
    </button>
  );
}
