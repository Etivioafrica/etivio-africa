import type { PlayerModule } from "@/lib/data/learn";
import type { OutlineModule } from "@/components/learn/PlayerFrame";

// The player sidebar: each module's lessons, then its quiz, with done and locked states.
export function buildOutline(base: string, modules: PlayerModule[]): OutlineModule[] {
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    locked: m.locked,
    items: [
      ...m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        href: `${base}?lesson=${l.id}`,
        kind: l.kind,
        done: l.done,
        locked: m.locked,
        seconds: l.durationSeconds,
      })),
      ...(m.quiz
        ? [
            {
              id: m.quiz.id,
              title: m.quiz.title,
              href: `${base}/quiz/${m.quiz.id}`,
              kind: "quiz" as const,
              done: m.quiz.passed,
              locked: m.locked,
              note: m.quiz.passed ? "Passed" : m.quiz.best !== null ? `Best ${m.quiz.best}%` : "Quiz",
            },
          ]
        : []),
    ],
  }));
}
