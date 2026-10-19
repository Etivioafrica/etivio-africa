"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { FormState } from "@/app/(app)/teach/actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Place = "top" | "bottom";
type Result = (NonNullable<FormState> & { at: number; place: Place }) | null;

// Past this much scroll the top of the page (and its Save button) is out of view, so feedback shows at the bottom.
const TOP_ZONE = 240;

// `toast` swaps the inline flash for a toast that slides in from the top or bottom, whichever is nearer the
// part of the page the user is looking at when they submit.
export function ActionForm({
  action,
  children,
  className = "et-form",
  id,
  toast,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  id?: string;
  toast?: boolean;
}) {
  const [state, formAction] = useActionState<Result, FormData>(async (_prev, fd) => {
    const scroller = document.querySelector(".et-main");
    const place: Place = (scroller?.scrollTop ?? window.scrollY) > TOP_ZONE ? "bottom" : "top";
    const res = await action(null, fd);
    return res ? { ...res, at: Date.now(), place } : null;
  }, null);

  return (
    <form action={formAction} className={className} id={id}>
      {!toast && state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
      {!toast && state?.ok && <p className="et-flash et-flash-ok">{state.ok}</p>}
      {toast && state && <Toast key={state.at} result={state} />}
      {children}
    </form>
  );
}

function Toast({ result }: { result: NonNullable<Result> }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const out = setTimeout(() => setPhase("out"), 3200);
    return () => clearTimeout(out);
  }, []);

  if (phase === "gone") return null;
  const err = Boolean(result.error);
  return (
    <div
      className={`et-toast is-${result.place}${err ? " is-err" : ""}${phase === "out" ? " is-out" : ""}`}
      role={err ? "alert" : "status"}
      onAnimationEnd={() => phase === "out" && setPhase("gone")}
    >
      {err ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{result.error ?? result.ok}</span>
      <button type="button" onClick={() => setPhase("out")} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
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
