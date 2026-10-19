import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { getCoursePlayer } from "@/lib/data/learn";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuizRunner } from "./QuizRunner";

export const metadata = { title: "Quiz" };

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
  const player = await getCoursePlayer(id);
  const idx = player?.modules.findIndex((m) => m.quiz?.id === quizId) ?? -1;
  if (!player || idx < 0) notFound();
  const mod = player.modules[idx];
  const quiz = mod.quiz!;
  const back = `/learn/course/${id}`;

  if (mod.locked)
    return (
      <section className="et-card et-quiz-locked">
        <Lock size={22} />
        <h1>This quiz is locked</h1>
        <p>Pass the quiz at the end of the previous module first.</p>
        <Link href={back} className="et-btn et-btn-primary">
          Back to the course
        </Link>
      </section>
    );

  // Prompts and options only. The right answers stay on the server until the learner submits.
  const { data: questions } = await createAdminClient().from("quiz_questions").select("prompt, options").eq("quiz_id", quizId).order("position");
  const nextModule = player.modules[idx + 1];
  const nextLesson = nextModule?.lessons[0];

  return (
    <>
      <Link href={back} className="et-back">
        <ArrowLeft size={14} />
        {player.course.title}
      </Link>
      <QuizRunner
        courseId={id}
        quizId={quizId}
        title={quiz.title}
        moduleTitle={mod.title}
        passMark={quiz.passMark}
        alreadyPassed={quiz.passed}
        best={quiz.best}
        questions={questions ?? []}
        next={nextLesson ? { href: `${back}?lesson=${nextLesson.id}`, label: `Start ${nextModule.title}` } : { href: back, label: "Back to the course" }}
      />
    </>
  );
}
