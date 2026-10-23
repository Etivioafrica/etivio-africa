"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Link2, X } from "lucide-react";

// In-app replacements for window.confirm, alert and prompt. Call confirmDialog / alertDialog / promptDialog from any
// client component and await the answer; <DialogHost /> (mounted once in the root layout) shows them as et-modal
// dialogs inside the current page's .et-app, so they follow its light or dark theme.

type Base = { title: string; body?: string };
type ConfirmOptions = Base & { confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type AlertOptions = Base & { okLabel?: string };
type PromptOptions = Base & { label?: string; placeholder?: string; defaultValue?: string; confirmLabel?: string; type?: "text" | "url" };

type Request =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (value: string | null) => void };

const queue: Request[] = [];
let wake: (() => void) | null = null;

function enqueue(req: Request) {
  queue.push(req);
  wake?.();
}

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => enqueue({ kind: "confirm", opts: o, resolve }));
}

export function alertDialog(opts: AlertOptions | string): Promise<void> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => enqueue({ kind: "alert", opts: o, resolve }));
}

export function promptDialog(opts: PromptOptions | string): Promise<string | null> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => enqueue({ kind: "prompt", opts: o, resolve }));
}

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    const next = () => {
      setReq((cur) => {
        if (cur || !queue.length) return cur;
        const r = queue.shift()!;
        settled.current = false;
        setValue(r.kind === "prompt" ? (r.opts.defaultValue ?? "") : "");
        return r;
      });
    };
    wake = next;
    next();
    return () => {
      wake = null;
    };
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!req || !el || el.open) return;
    el.showModal();
    // showModal focuses the first button (the close X); put focus on the text field or the main action instead.
    el.querySelector<HTMLElement>("input, button[type=submit]")?.focus();
  }, [req]);

  function finish(answer: boolean) {
    if (!req || settled.current) return;
    settled.current = true;
    if (req.kind === "confirm") req.resolve(answer);
    else if (req.kind === "alert") req.resolve();
    else req.resolve(answer ? value : null);
    dialog.current?.close();
    setReq(null);
    // Show the next waiting dialog, if any, after this one has closed.
    setTimeout(() => wake?.(), 0);
  }

  if (!req) return null;
  const target = document.querySelector<HTMLElement>(".et-app") ?? document.body;
  const danger = req.kind === "confirm" && req.opts.danger;
  const Icon = req.kind === "prompt" ? Link2 : danger ? AlertTriangle : Info;
  const okLabel =
    req.kind === "confirm" ? (req.opts.confirmLabel ?? "Continue") : req.kind === "alert" ? (req.opts.okLabel ?? "OK") : (req.opts.confirmLabel ?? "Save");

  return createPortal(
    <dialog
      ref={dialog}
      className="et-modal et-modal-sm"
      aria-label={req.opts.title}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      onClick={(e) => e.target === dialog.current && finish(false)}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <div className="et-modal-head">
          <div className="et-blog-modal-title">
            <span className={`et-blog-modal-icon${danger ? " is-danger" : ""}`}>
              <Icon size={17} />
            </span>
            <div>
              <h2>{req.opts.title}</h2>
              {req.opts.body && <p className="et-dialog-text">{req.opts.body}</p>}
            </div>
          </div>
          <button type="button" className="et-icon-btn" onClick={() => finish(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {req.kind === "prompt" && (
          <div className="et-modal-body">
            <div className="et-field">
              {req.opts.label && <label htmlFor="et-dialog-input">{req.opts.label}</label>}
              <input
                id="et-dialog-input"
                className="et-input"
                type={req.opts.type ?? "text"}
                value={value}
                placeholder={req.opts.placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="et-modal-foot">
          {req.kind !== "alert" && (
            <button type="button" className="et-btn et-btn-ghost" onClick={() => finish(false)}>
              {req.kind === "confirm" ? (req.opts.cancelLabel ?? "Cancel") : "Cancel"}
            </button>
          )}
          <button type="submit" className={`et-btn ${danger ? "et-btn-danger" : "et-btn-primary"}`}>
            {okLabel}
          </button>
        </div>
      </form>
    </dialog>,
    target,
  );
}
