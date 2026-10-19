"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import { createQuiz } from "../actions";

// "Add quiz" under a module: creates the quiz, then opens its editor.
export function AddQuizButton({ moduleId, courseId }: { moduleId: string; courseId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="et-quiz-add"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createQuiz(moduleId);
          if (res.id) router.push(`/admin/courses/${courseId}/quizzes/${res.id}`);
          else if (res.error) window.alert(res.error);
        })
      }
    >
      <ListChecks size={14} />
      {pending ? "Adding quiz…" : "Add a quiz to this module"}
      <Plus size={13} />
    </button>
  );
}
