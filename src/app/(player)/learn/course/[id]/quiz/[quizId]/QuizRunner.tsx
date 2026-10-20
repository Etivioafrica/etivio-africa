"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, ListChecks, RotateCcw, Trophy, X } from "lucide-react";
import { submitQuiz, type QuizResult } from "@/app/(app)/learn/course-actions";

export function QuizRunner({
  courseId,
  quizId,
  title,
  moduleTitle,
  passMark,
  alreadyPassed,
  best,
  questions,
  next,
}: {
  courseId: string;
  quizId: string;
  title: string;
  moduleTitle: string;
  passMark: number;
  alreadyPassed: boolean;
  best: number | null;
  questions: { prompt: string; options: string[] }[];
  next: { href: string; label: string };
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, start] = useTransition();
  const answered = answers.filter((a) => a !== null).length;
  const needed = Math.ceil((passMark / 100) * questions.length);

  function submit() {
    start(async () => {
      const res = await submitQuiz(courseId, quizId, answers as number[]);
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.querySelector(".et-main")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const graded = result?.results;
  return (
    <div className="et-quiz-run">
      <header className="et-card et-quiz-run-head">
        <span className="et-cta-icon">
          <ListChecks size={20} />
        </span>
        <div>
          <small>{moduleTitle} · quiz</small>
          <h1>{title}</h1>
          <p>
            {questions.length} questions · pass mark {passMark}% ({needed} right)
            {best !== null && ` · your best so far: ${best}%`}
          </p>
        </div>
      </header>

      {result?.error && <p className="et-flash et-flash-err">{result.error}</p>}

      {graded && (
        <section className={`et-card et-quiz-result${result.passed ? " is-pass" : " is-fail"}`}>
          <span className="et-quiz-score">{result.score}%</span>
          <div>
            <b>{result.passed ? (alreadyPassed ? "Passed again. Nice." : "You passed! The next module is unlocked.") : `Not quite. You need ${passMark}% to pass.`}</b>
            <p>{result.passed ? "Check the answers below, then carry on." : "Look at the answers below to see what to revisit, then try again. There's no limit on attempts."}</p>
          </div>
          <div className="et-inline">
            {result.passed ? (
              <Link href={next.href} className="et-btn et-btn-primary">
                {next.label} <ArrowRight size={14} />
              </Link>
            ) : (
              <button
                type="button"
                className="et-btn et-btn-primary"
                onClick={() => {
                  setAnswers(questions.map(() => null));
                  setResult(null);
                }}
              >
                <RotateCcw size={14} /> Try again
              </button>
            )}
          </div>
        </section>
      )}

      <ol className="et-quiz-qs">
        {questions.map((q, i) => {
          const g = graded?.[i];
          return (
            <li key={i} className="et-card">
              <p className="et-quiz-prompt">
                <span>{i + 1}</span>
                {q.prompt}
              </p>
              <div className="et-quiz-choices" role="radiogroup" aria-label={`Question ${i + 1}`}>
                {q.options.map((o, oi) => {
                  const state = g ? (oi === g.correct ? "is-right" : oi === g.chosen ? "is-wrong" : "") : answers[i] === oi ? "is-on" : "";
                  return (
                    <button
                      key={oi}
                      type="button"
                      role="radio"
                      aria-checked={answers[i] === oi}
                      disabled={!!g || pending}
                      className={state}
                      onClick={() => setAnswers((a) => a.map((x, xi) => (xi === i ? oi : x)))}
                    >
                      <span className="et-quiz-letter">{g && oi === g.correct ? <Check size={12} strokeWidth={3} /> : g && oi === g.chosen ? <X size={12} strokeWidth={3} /> : String.fromCharCode(65 + oi)}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
              {g?.explanation && <p className="et-quiz-why">{g.explanation}</p>}
            </li>
          );
        })}
      </ol>

      {!graded && (
        <div className="et-quiz-submit">
          <span className="et-muted">
            {answered} of {questions.length} answered
          </span>
          <button type="button" className="et-btn et-btn-primary" disabled={pending || answered < questions.length} onClick={submit}>
            <Trophy size={15} /> {pending ? "Checking…" : "Submit answers"}
          </button>
        </div>
      )}
    </div>
  );
}
