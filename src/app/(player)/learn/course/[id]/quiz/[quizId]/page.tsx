import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { PlayerFrame } from "@/components/learn/PlayerFrame";
import { buildOutline } from "@/lib/player";
import { getCoursePlayer } from "@/lib/data/learn";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuizRunner } from "./QuizRunner";

export const metadata = { title: "Quiz" };

type Props = { params: Promise<{ id: string; quizId: string }> };

// The route's loading.tsx shows the player skeleton while this loads.
export default async function Content({ params }: Props) {
  const { id, quizId } = await params;
  const player = await getCoursePlayer(id);
  const idx = player?.modules.findIndex((m) => m.quiz?.id === quizId) ?? -1;
  if (!player || idx < 0) notFound();
  const mod = player.modules[idx];
  const quiz = mod.quiz!;
  const back = `/learn/course/${id}`;
  const nextModule = player.modules[idx + 1];
  const nextLesson = nextModule?.lessons[0];
  const next = quiz.passed && nextLesson && !nextModule.locked ? { href: `${back}?lesson=${nextLesson.id}`, label: "Next lesson" } : null;
  const frame = (children: React.ReactNode) => (
    <PlayerFrame
      course={{ id, title: player.course.title, slug: player.course.slug }}
      outline={buildOutline(back, player.modules)}
      activeId={quizId}
      progress={player.progress}
      steps={{ done: player.doneCount + player.passedCount, total: player.lessons.length + player.quizzes.length }}
      next={next}
    >
      {children}
    </PlayerFrame>
  );

  if (mod.locked)
    return frame(
      <section className="et-card et-quiz-locked">
        <Lock size={22} />
        <h1>This quiz is locked</h1>
        <p>Pass the quiz at the end of the previous module first.</p>
        <Link href={back} className="et-btn et-btn-primary">
          Back to the course
        </Link>
      </section>,
    );

  // Prompts and options only. The right answers stay on the server until the learner submits.
  const { data: questions } = await createAdminClient().from("quiz_questions").select("prompt, options").eq("quiz_id", quizId).order("position");

  return frame(
    <>
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
    </>,
  );
}
