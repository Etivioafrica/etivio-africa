"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock, Plus } from "lucide-react";
import { topUpWallet, type TopUpState } from "./actions";

const QUICK = [2000, 5000, 10000, 25000];
const POPULAR = 5000;

export function TopUpForm() {
  const [state, action] = useActionState<TopUpState, FormData>(topUpWallet, null);
  const [amount, setAmount] = useState("");
  const n = Number(amount);
  return (
    <form action={action} className="et-wl-topup">
      <div className="et-wl-topup-head">
        <h2>Add money</h2>
        <p>Top up once, then buy courses in a tap. Your wallet is used first at checkout.</p>
      </div>
      <div className="et-wl-quick" role="group" aria-label="Quick amounts">
        {QUICK.map((q) => (
          <button key={q} type="button" className={n === q ? "is-on" : ""} onClick={() => setAmount(String(q))} aria-pressed={n === q}>
            {q === POPULAR && <em>Popular</em>}
            <b>₦{q.toLocaleString()}</b>
          </button>
        ))}
      </div>
      <label className="et-wl-amount" htmlFor="wl-amount">
        <span className="et-wl-amount-label">Or enter an amount</span>
        <span className="et-wl-amount-box">
          <span className="et-wl-naira">₦</span>
          <input id="wl-amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" autoComplete="off" />
        </span>
        <small>From ₦500 up to ₦1,000,000 at a time.</small>
      </label>
      {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
      <Submit amount={n} />
      <p className="et-wl-secure">
        <Lock size={12} /> Paid securely with Paystack · card, bank transfer or USSD
      </p>
    </form>
  );
}

function Submit({ amount }: { amount: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary et-wl-go" disabled={pending}>
      <Plus size={16} /> {pending ? "Opening Paystack…" : amount > 0 ? `Top up ₦${amount.toLocaleString()}` : "Top up"}
    </button>
  );
}
