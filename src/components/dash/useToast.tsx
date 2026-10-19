"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type Msg = { text: string; err: boolean; at: number; place: "top" | "bottom" };

// Same slide-in toast as ActionForm, for client components that call server actions directly.
// Shows at the top unless the page is scrolled down, then at the bottom.
export function useToast() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const show = useCallback((res: { ok?: string; error?: string } | string) => {
    const r = typeof res === "string" ? { ok: res } : res;
    const scroller = document.querySelector(".et-main");
    const place = (scroller?.scrollTop ?? window.scrollY) > 240 ? "bottom" : "top";
    setMsg({ text: r.error ?? r.ok ?? "", err: Boolean(r.error), at: Date.now(), place });
  }, []);
  const node = msg?.text ? <ToastView key={msg.at} msg={msg} /> : null;
  return [node, show] as const;
}

function ToastView({ msg }: { msg: Msg }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    const t = setTimeout(() => setPhase("out"), 3200);
    return () => clearTimeout(t);
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      className={`et-toast is-${msg.place}${msg.err ? " is-err" : ""}${phase === "out" ? " is-out" : ""}`}
      role={msg.err ? "alert" : "status"}
      onAnimationEnd={() => phase === "out" && setPhase("gone")}
    >
      {msg.err ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      <span>{msg.text}</span>
      <button type="button" onClick={() => setPhase("out")} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
