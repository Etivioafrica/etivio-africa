"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { decideCourse, decideProduct } from "./actions";

// Approve / request changes for one item in the review queue. After a decision it returns to the queue.
export function Decision({ kind, id, ready }: { kind: "course" | "product"; id: string; ready: boolean }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const decide = kind === "course" ? decideCourse : decideProduct;
  const act = (approve: boolean) =>
    start(async () => {
      const res = await decide(id, approve, note);
      show(res);
      if (!res.error) router.push(`/admin/review?tab=${kind}s`);
    });

  return (
    <section className="et-card et-card-pad et-rv-decide">
      {toast}
      <h2>Your decision</h2>
      {!ready && <p className="et-rv-warn">Some checks above aren&apos;t met. You can still approve, but usually it&apos;s better to ask for changes.</p>}
      {sending ? (
        <>
          <textarea className="et-input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the tutor change? They'll get this in an email." autoFocus />
          <div className="et-inline">
            <button type="button" className="et-btn et-btn-primary" disabled={busy || !note.trim()} onClick={() => act(false)}>
              {busy ? "Sending…" : "Send back to tutor"}
            </button>
            <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => setSending(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="et-inline">
          <button type="button" className="et-btn et-btn-success" disabled={busy} onClick={() => act(true)}>
            <Check size={15} /> {busy ? "Approving…" : "Approve and publish"}
          </button>
          <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => setSending(true)}>
            <Undo2 size={15} /> Request changes
          </button>
        </div>
      )}
    </section>
  );
}
