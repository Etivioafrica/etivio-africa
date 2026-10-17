"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/(app)/teach/actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ActionForm({ action, children, className = "et-form" }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
      {state?.ok && <p className="et-flash et-flash-ok">{state.ok}</p>}
      {children}
    </form>
  );
}

export function SubmitButton({ children, pendingLabel = "Saving…", className = "et-btn et-btn-primary" }: { children: React.ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
