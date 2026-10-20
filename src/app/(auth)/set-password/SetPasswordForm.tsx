"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PasswordField } from "../AuthForm";
import { setFirstPassword } from "./actions";

export function SetPasswordForm({ next }: { next: string }) {
  const [state, action] = useActionState(setFirstPassword, null);
  return (
    <div className="et-auth-box">
      <h1>Choose your password</h1>
      <p className="et-auth-sub">Welcome to Etivio! Replace the temporary password from your email with one you&apos;ll remember.</p>
      {state?.error && <p className="et-auth-msg is-err">{state.error}</p>}
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <PasswordField name="password" label="New password" autoComplete="new-password" placeholder="Minimum 8 characters" />
        <PasswordField name="confirm" label="Confirm password" autoComplete="new-password" placeholder="Type it again" />
        <Submit />
      </form>
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-auth-submit" disabled={pending}>
      {pending ? "Saving…" : "Save and continue"}
    </button>
  );
}
