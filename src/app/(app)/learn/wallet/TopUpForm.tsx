"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { topUpWallet, type TopUpState } from "./actions";

const QUICK = [2000, 5000, 10000, 25000];

export function TopUpForm() {
  const [state, action] = useActionState<TopUpState, FormData>(topUpWallet, null);
  const [amount, setAmount] = useState("");
  return (
    <form action={action} className="et-wl-topup">
      <label htmlFor="wl-amount">Add money</label>
      <div className="et-wl-quick">
        {QUICK.map((n) => (
          <button key={n} type="button" className={Number(amount) === n ? "is-on" : ""} onClick={() => setAmount(String(n))}>
            ₦{n.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="et-wl-row">
        <span className="et-wl-naira">₦</span>
        <input id="wl-amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount, from 500" />
        <Submit />
      </div>
      {state?.error && <p className="et-gb-error">{state.error}</p>}
      <small>Paid securely with Paystack. Your wallet is used first whenever you buy a course.</small>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary" disabled={pending}>
      <Plus size={15} /> {pending ? "Opening Paystack…" : "Top up"}
    </button>
  );
}
