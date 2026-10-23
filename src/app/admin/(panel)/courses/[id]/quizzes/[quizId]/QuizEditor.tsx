"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, Check, Copy, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { deleteQuiz, saveQuiz, type QuizQuestionInput } from "../../../actions";
import { confirmDialog } from "@/components/dash/dialogs";

type Q = QuizQuestionInput & { key: number };
let uid = 0;
const blank = (): Q => ({ key: ++uid, prompt: "", options: ["", ""], correct: 0, explanation: "" });

export function QuizEditor({
  quizId,
  courseId,
  courseTitle,
  moduleTitle,
  initial,
  stats,
}: {
  quizId: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  initial: { title: string; passMark: number; questions: QuizQuestionInput[] };
  stats: { attempts: number; takers: number; passed: number };
}) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [saving, start] = useTransition();
  const [title, setTitle] = useState(initial.title);
  const [passMark, setPassMark] = useState(initial.passMark);
  const [questions, setQuestions] = useState<Q[]>(initial.questions.length ? initial.questions.map((q) => ({ ...q, key: ++uid })) : [blank()]);
  const [dirty, setDirty] = useState(false);

  const edit = (i: number, patch: Partial<Q>) => {
    setDirty(true);
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };
  const move = (i: number, d: -1 | 1) => {
    setDirty(true);
    setQuestions((qs) => {
      const c = [...qs];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });
  };
  const needed = Math.ceil((passMark / 100) * questions.length);

  function save() {
    start(async () => {
      const res = await saveQuiz(quizId, { title, passMark, questions: questions.map((q) => ({ prompt: q.prompt, options: q.options, correct: q.correct, explanation: q.explanation })) });
      show(res);
      if (!res.error) setDirty(false);
    });
  }

  return (
    <>
      {toast}
      <p className="et-set-crumb">
        <BookOpen size={12} />
        <Link href="/admin/courses">Courses</Link> <span>/</span> <Link href={`/admin/courses/${courseId}?tab=curriculum`}>{courseTitle}</Link> <span>/</span> {moduleTitle} quiz
      </p>
      <div className="et-page-head">
        <div>
          <h1>Edit quiz</h1>
          <p>
            {stats.takers
              ? `${stats.takers} ${stats.takers === 1 ? "learner has" : "learners have"} taken it · ${Math.round((stats.passed / stats.takers) * 100)}% passed · ${stats.attempts} attempts`
              : "No one has taken this quiz yet."}
          </p>
        </div>
        <div className="et-inline">
          <button
            type="button"
            className="et-btn et-btn-danger-text"
            disabled={saving}
            onClick={async () =>
              (await confirmDialog({ title: "Delete this quiz?", body: "Everyone's results for it are deleted and the next module unlocks for everyone.", confirmLabel: "Delete quiz", danger: true })) &&
              start(async () => {
                await deleteQuiz(quizId);
                router.push(`/admin/courses/${courseId}?tab=curriculum`);
              })
            }
          >
            <Trash2 size={14} /> Delete quiz
          </button>
          <button type="button" className="et-btn et-btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save quiz" : "Saved"}
          </button>
        </div>
      </div>

      <section className="et-card et-card-pad et-form">
        <div className="et-form-grid">
          <div className="et-field">
            <label htmlFor="q-title">Quiz title</label>
            <input
              id="q-title"
              value={title}
              maxLength={120}
              onChange={(e) => {
                setDirty(true);
                setTitle(e.target.value);
              }}
            />
          </div>
          <div className="et-field">
            <label htmlFor="q-pass">
              Pass mark: <b>{passMark}%</b>
            </label>
            <input
              id="q-pass"
              type="range"
              min={10}
              max={100}
              step={5}
              value={passMark}
              onChange={(e) => {
                setDirty(true);
                setPassMark(Number(e.target.value));
              }}
            />
            <small>
              Learners need {needed} of {questions.length} right to pass and unlock the next module. They can retry as often as they like.
            </small>
          </div>
        </div>
      </section>

      <ol className="et-quiz-list">
        {questions.map((q, i) => (
          <li key={q.key} className="et-card">
            <div className="et-quiz-q-head">
              <span className="et-wiz-num">{i + 1}</span>
              <textarea className="et-input" rows={2} value={q.prompt} maxLength={500} onChange={(e) => edit(i, { prompt: e.target.value })} placeholder="Type the question…" aria-label={`Question ${i + 1}`} />
              <span className="et-row-actions">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" data-tip="Move up">
                  <ArrowUp size={14} />
                </button>
                <button type="button" disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label="Move down" data-tip="Move down">
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirty(true);
                    setQuestions((qs) => [...qs.slice(0, i + 1), { ...q, key: ++uid }, ...qs.slice(i + 1)]);
                  }}
                  aria-label="Duplicate"
                  data-tip="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className="is-danger"
                  disabled={questions.length === 1}
                  onClick={() => {
                    setDirty(true);
                    setQuestions((qs) => qs.filter((_, j) => j !== i));
                  }}
                  aria-label="Delete question"
                  data-tip="Delete question"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
            <ul className="et-quiz-opts" role="radiogroup" aria-label="Answers. Pick the correct one.">
              {q.options.map((o, oi) => (
                <li key={oi} className={q.correct === oi ? "is-correct" : ""}>
                  <button type="button" role="radio" aria-checked={q.correct === oi} className="et-quiz-mark" onClick={() => edit(i, { correct: oi })} title="Mark as the right answer">
                    {q.correct === oi && <Check size={12} strokeWidth={3} />}
                  </button>
                  <input
                    className="et-input"
                    value={o}
                    maxLength={200}
                    placeholder={`Answer ${String.fromCharCode(65 + oi)}`}
                    onChange={(e) => edit(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                    aria-label={`Answer ${String.fromCharCode(65 + oi)}`}
                  />
                  <button
                    type="button"
                    className="et-icon-btn"
                    disabled={q.options.length <= 2}
                    onClick={() => edit(i, { options: q.options.filter((_, xi) => xi !== oi), correct: q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct })}
                    aria-label="Remove answer"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="et-quiz-q-foot">
              {q.options.length < 6 && (
                <button type="button" className="et-wiz-add" onClick={() => edit(i, { options: [...q.options, ""] })}>
                  <Plus size={13} /> Add answer
                </button>
              )}
              <small className="et-muted">Tick the circle next to the right answer.</small>
            </div>
            <div className="et-field et-quiz-explain">
              <label htmlFor={`ex-${q.key}`}>Explanation (optional)</label>
              <input id={`ex-${q.key}`} value={q.explanation} maxLength={1000} onChange={(e) => edit(i, { explanation: e.target.value })} placeholder="Shown after they answer, to help them learn why." />
            </div>
          </li>
        ))}
      </ol>

      <div className="et-inline">
        <button
          type="button"
          className="et-btn et-btn-ghost"
          onClick={() => {
            setDirty(true);
            setQuestions((qs) => [...qs, blank()]);
          }}
        >
          <Plus size={14} /> Add question
        </button>
        <button type="button" className="et-btn et-btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save quiz"}
        </button>
      </div>
    </>
  );
}
