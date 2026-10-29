"use client";
import Link from "next/link";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { OPEN_AI } from "@/components/shell/AiWidget";
import { startTour } from "@/lib/guide";

// One line in the dashboard's task list. No href means the step starts the in-app tour.
export type Task = { key: string; label: string; hint: string; href?: string; done: boolean; when?: string };

// What to do next: open steps first (next lesson, quizzes, sessions, getting started), then the ones already done.
export function TasksCard({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  return (
    <aside className="et-card et-lb-card et-lb-tasks">
      <div className="et-lb-head">
        <h3>Tasks</h3>
        <small>
          {open.length} to do{done.length ? ` · ${done.length} done` : ""}
        </small>
      </div>
      <ul className="et-lb-task-list">
        {[...open, ...done].map((t) => {
          const body = (
            <>
              <span className={`et-lb-check${t.done ? " is-done" : ""}`}>{t.done && <Check size={12} strokeWidth={3} />}</span>
              <span className="et-lb-task-text">
                <b>{t.label}</b>
                <small>
                  {t.hint}
                  {t.when && <em> · {t.when}</em>}
                </small>
              </span>
              {!t.done && <ChevronRight size={15} className="et-lb-task-go" />}
            </>
          );
          if (t.done) return <li key={t.key} className="is-done">{body}</li>;
          return (
            <li key={t.key}>
              {t.href ? (
                <Link href={t.href}>{body}</Link>
              ) : (
                <button type="button" onClick={startTour}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!tasks.length && <p className="et-lb-quiet">You&apos;re all caught up.</p>}
    </aside>
  );
}

// Opens the Etivio AI panel, for practice questions when a course has no quizzes yet.
export function QuizWithAi() {
  return (
    <button type="button" className="et-lb-ai-btn" onClick={() => window.dispatchEvent(new Event(OPEN_AI))}>
      <Sparkles size={15} /> Quiz yourself with Etivio AI
    </button>
  );
}
