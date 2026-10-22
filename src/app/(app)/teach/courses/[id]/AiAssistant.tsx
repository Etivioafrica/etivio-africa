"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, ListTree, Sparkles } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { aiFillCourse } from "../../ai-actions";

// AI helpers for a tutor's own course. Each one writes straight to the course; the tutor reviews and edits after.
export function AiAssistant({ courseId, hasModules, coverUrl }: { courseId: string; hasModules: boolean; coverUrl: string | null }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [useWeb, setUseWeb] = useState(true);

  const run = (what: "outline" | "copy" | "cover") => {
    if (what === "copy" && !window.confirm("This replaces the summary, description and skills with AI-written versions. Continue?")) return;
    if (what === "cover" && coverUrl && !window.confirm("Replace the current cover with a new AI image?")) return;
    setRunning(what);
    start(async () => {
      const res = await aiFillCourse(courseId, what, { useWeb });
      setRunning(null);
      show(res.ok ? { ok: res.data } : { error: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <section className="et-card et-card-pad et-ai-tools">
      {toast}
      <div className="et-ai-head">
        <span className="et-ai-badge">
          <Sparkles size={14} />
        </span>
        <div>
          <b>AI course assistant</b>
          <small>Drafts to get you started. Always read and edit what it writes before you submit.</small>
        </div>
      </div>
      {!hasModules && (
        <div className="et-ai-tool">
          <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => run("outline")}>
            <ListTree size={15} /> {running === "outline" ? "Planning your course…" : "Generate course outline"}
          </button>
          <label className="et-check">
            <input type="checkbox" checked={useWeb} onChange={(e) => setUseWeb(e.target.checked)} /> Research how this topic is taught online first
          </label>
        </div>
      )}
      <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => run("copy")}>
        <FileText size={15} /> {running === "copy" ? "Writing…" : "Write summary and description"}
      </button>
      <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => run("cover")}>
        <ImagePlus size={15} /> {running === "cover" ? "Creating cover…" : coverUrl ? "Generate a new cover" : "Generate a cover image"}
      </button>
    </section>
  );
}
