import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { QuizEditor } from "./QuizEditor";

export const metadata = { title: "Edit quiz" };

type Props = { params: Promise<{ id: string; quizId: string }> };

export default function QuizPage({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id, quizId } = await params;
  const { db } = await requireAdmin("courses");
  const [{ data: quiz }, { data: questions }, { data: attempts }] = await Promise.all([
    db.from("course_quizzes").select("id, title, pass_mark, course_id, course:courses(title), module:course_modules(title)").eq("id", quizId).eq("course_id", id).maybeSingle(),
    db.from("quiz_questions").select("prompt, options, correct_index, explanation").eq("quiz_id", quizId).order("position"),
    db.from("quiz_attempts").select("user_id, passed, score").eq("quiz_id", quizId),
  ]);
  if (!quiz) notFound();
  const takers = new Set((attempts ?? []).map((a) => a.user_id));
  const passers = new Set((attempts ?? []).filter((a) => a.passed).map((a) => a.user_id));
  return (
    <QuizEditor
      quizId={quiz.id}
      courseId={id}
      courseTitle={quiz.course?.title ?? "Course"}
      moduleTitle={quiz.module?.title ?? "Module"}
      initial={{
        title: quiz.title,
        passMark: quiz.pass_mark,
        questions: (questions ?? []).map((q) => ({ prompt: q.prompt, options: q.options, correct: q.correct_index, explanation: q.explanation ?? "" })),
      }}
      stats={{ attempts: attempts?.length ?? 0, takers: takers.size, passed: passers.size }}
    />
  );
}
