"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { recheckPayment } from "../actions";

export function RecheckButton({ reference }: { reference: string }) {
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  return (
    <>
      {toast}
      <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={busy} onClick={() => start(async () => show(await recheckPayment(reference)))}>
        <RefreshCw size={13} /> {busy ? "Checking…" : "Check with Paystack"}
      </button>
    </>
  );
}
