"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Flag, X } from "lucide-react";
import { reportContent } from "./actions";

const REASONS = [
  ["sexual", "Sexual or explicit", "Nudity, porn, sexual messages or images"],
  ["harassment", "Harassment or bullying", "Insults, threats or unwanted contact"],
  ["hate", "Hate speech", "Attacks on a group or a person's identity"],
  ["violence", "Violence or threats", "Encouraging harm"],
  ["spam", "Spam or scam", "Ads, fake offers, asking for money"],
  ["other", "Something else", "Tell us below"],
] as const;

// A small flag that opens the report form. `type` and `id` say what's being reported (see lib/moderation TargetType).
export function ReportButton({ type, id, small, label }: { type: string; id: string; small?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  function close() {
    dialog.current?.close();
    setOpen(false);
    setReason("");
    setDetails("");
    setResult(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setResult({ error: "Pick a reason." });
    start(async () => setResult(await reportContent(type, id, reason, details)));
  }

  const target = typeof document === "undefined" ? null : (document.querySelector<HTMLElement>(".et-app") ?? document.body);

  return (
    <>
      <button type="button" className={`et-report-btn${small ? " is-small" : ""}${label ? " has-label" : ""}`} onClick={() => setOpen(true)} aria-label="Report" title="Report">
        <Flag size={small ? 11 : 13} />
        {label && <span>{label}</span>}
      </button>
      {open &&
        target &&
        createPortal(
          <dialog
            ref={dialog}
            className="et-modal et-modal-sm et-report"
            aria-label="Report"
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClick={(e) => e.target === dialog.current && close()}
          >
            {result?.ok ? (
              <>
                <div className="et-modal-head">
                  <div>
                    <h2>Report sent</h2>
                    <p>{result.ok}</p>
                  </div>
                </div>
                <div className="et-modal-foot">
                  <button type="button" className="et-btn et-btn-primary" onClick={close}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <div className="et-modal-head">
                  <div>
                    <h2>What&apos;s wrong with it?</h2>
                    <p>Reports are private. The person won&apos;t know it was you.</p>
                  </div>
                  <button type="button" className="et-icon-btn" onClick={close} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className="et-modal-body">
                  <div className="et-report-reasons" role="radiogroup" aria-label="Reason">
                    {REASONS.map(([v, title, hint]) => (
                      <label key={v} className={reason === v ? "is-on" : ""}>
                        <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} />
                        <span>
                          <b>{title}</b>
                          <small>{hint}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="et-field">
                    <label htmlFor={`rp-${id}`}>Anything else? (optional)</label>
                    <textarea id={`rp-${id}`} rows={2} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
                  </div>
                  {result?.error && <p className="et-flash et-flash-err">{result.error}</p>}
                </div>
                <div className="et-modal-foot">
                  <button type="button" className="et-btn et-btn-ghost" onClick={close}>
                    Cancel
                  </button>
                  <button type="submit" className="et-btn et-btn-danger" disabled={busy || !reason}>
                    {busy ? "Sending…" : "Send report"}
                  </button>
                </div>
              </form>
            )}
          </dialog>,
          target,
        )}
    </>
  );
}
