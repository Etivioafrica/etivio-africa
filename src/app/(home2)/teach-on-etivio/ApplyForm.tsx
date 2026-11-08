"use client";

import { useActionState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { applyForRole } from "@/app/(app)/roles/actions";

type State = { ok?: string; error?: string } | undefined;

// The tutor application in the landing-page style. Uses the same server action as the dashboard form.
export function ApplyForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<State, FormData>(applyForRole as (s: State, fd: FormData) => Promise<State>, undefined);

  if (state?.ok)
    return (
      <div className="et-tc-state is-ok">
        <CheckCircle2 size={20} />
        <div>
          <b>Application sent.</b>
          <p>{state.ok}</p>
        </div>
      </div>
    );

  return (
    <form action={action} className="et-tc-form">
      <input type="hidden" name="role" value="tutor" />
      <label htmlFor="tc-msg">What would you like to teach, and what is your experience?</label>
      <textarea
        id="tc-msg"
        name="message"
        rows={6}
        required
        minLength={20}
        maxLength={2000}
        placeholder="For example: I'm a product designer with 6 years' experience. I'd like to teach Figma for beginners and UI design for mobile apps."
      />
      {state?.error && <p className="et-tc-err">{state.error}</p>}
      <div className="et-tc-form-foot">
        <small>Applying as {email}</small>
        <button type="submit" className="et-tc-btn is-solid" disabled={pending}>
          <span>
            <ArrowRight size={15} aria-hidden="true" />
          </span>
          {pending ? "Sending…" : "Send application"}
        </button>
      </div>
    </form>
  );
}
