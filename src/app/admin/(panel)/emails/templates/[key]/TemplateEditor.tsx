"use client";
import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { RotateCcw, Save, Send } from "lucide-react";
import type { EditorRef, EmailEditorProps } from "react-email-editor";
import { useToast } from "@/components/dash/useToast";
import type { Json } from "@/lib/database.types";
import type { Placeholder } from "@/lib/email/registry";
import { resetTemplate, saveTemplate, sendTemplateTest } from "../actions";
import { uploadFile } from "@/lib/upload-client";

// Unlayer only runs in the browser.
const EmailEditor = dynamic(() => import("react-email-editor"), { ssr: false, loading: () => <div className="et-skel" style={{ height: "100%" }} /> });

type Exported = { design: Json; html: string };

export function TemplateEditor({
  templateKey,
  label,
  when,
  subject: initialSubject,
  design,
  placeholders,
  customised,
  isAuth,
}: {
  templateKey: string;
  label: string;
  when: string;
  subject: string;
  design: object;
  placeholders: Placeholder[];
  customised: boolean;
  isAuth: boolean;
}) {
  const editor = useRef<EditorRef>(null);
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  const [subject, setSubject] = useState(initialSubject);
  const [ready, setReady] = useState(false);

  const exportDesign = () =>
    new Promise<Exported>((resolve, reject) => {
      const ed = editor.current?.editor;
      if (!ed) return reject(new Error("Editor isn't ready yet."));
      ed.exportHtml((data: { design: unknown; html: string }) => resolve({ design: data.design as Json, html: data.html }));
    });

  const run = (fn: (e: Exported) => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      try {
        show(await fn(await exportDesign()));
      } catch (e) {
        show({ error: e instanceof Error ? e.message : "Something went wrong." });
      }
    });

  const onReady: EmailEditorProps["onReady"] = (ed) => {
    ed.loadDesign(design as never);
    // Images dropped into the editor are stored in Etivio's R2 bucket, not Unlayer's.
    ed.registerCallback("image", (file: { attachments: File[] }, done: (r: { progress: number; url?: string }) => void) => {
      const f = file.attachments[0];
      done({ progress: 10 });
      uploadFile("blog", f, f.name, { onProgress: (p) => done({ progress: Math.max(10, p) }) })
        .then(({ url }) => done({ progress: 100, url }))
        .catch((err: Error) => show({ error: err.message }));
    });
    setReady(true);
  };

  const mergeTags = Object.fromEntries(placeholders.map((p) => [p.tag, { name: p.label, value: `{{${p.tag}}}`, sample: p.sample }]));

  return (
    <div className="et-tpl-editor">
      {toast}
      <div className="et-tpl-bar">
        <div className="et-tpl-title">
          <p className="et-set-crumb">
            <Link href="/admin/emails">Emails</Link> <span>/</span> <Link href="/admin/emails/templates">Templates</Link> <span>/</span> {label}
          </p>
          <h1>
            {label} <span className={`et-tag${customised ? "" : " is-muted"}`}>{customised ? "Customised" : "Built-in design"}</span>
          </h1>
          <small>Sent when: {when}</small>
        </div>
        <div className="et-inline">
          {customised && (
            <button
              type="button"
              className="et-btn et-btn-ghost"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Go back to the built-in design? Your custom design will be deleted.")) return;
                start(async () => {
                  show(await resetTemplate(templateKey));
                  window.location.reload();
                });
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button type="button" className="et-btn et-btn-ghost" disabled={!ready || busy} onClick={() => run((e) => sendTemplateTest(templateKey, { subject, html: e.html }))}>
            <Send size={14} /> Send test to me
          </button>
          <button type="button" className="et-btn et-btn-primary" disabled={!ready || busy} onClick={() => run((e) => saveTemplate(templateKey, { subject, design: e.design, html: e.html }))}>
            <Save size={14} /> {busy ? "Working…" : "Save"}
          </button>
        </div>
      </div>

      <div className="et-tpl-meta">
        <label className="et-field">
          <span>Subject line</span>
          <input className="et-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </label>
        <div className="et-tpl-tags">
          <span>Placeholders</span>
          <p>
            {placeholders.map((p) => (
              <code key={p.tag} title={`${p.label}, e.g. ${p.sample}`}>{`{{${p.tag}}}`}</code>
            ))}
          </p>
          <small>Type them in text or links, or use Merge Tags in the text toolbar. They&apos;re filled in for each person.{isAuth ? " Saving also updates Supabase, which sends this email." : ""}</small>
        </div>
      </div>

      <div className="et-tpl-canvas">
        <EmailEditor
          ref={editor}
          onReady={onReady}
          minHeight="100%"
          style={{ height: "100%" }}
          options={{ displayMode: "email", mergeTags, appearance: { theme: "modern_light" }, features: { textEditor: { spellChecker: true } } } as EmailEditorProps["options"]}
        />
      </div>
    </div>
  );
}
