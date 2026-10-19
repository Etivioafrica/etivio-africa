import { Suspense } from "react";
import Link from "next/link";
import { ListChecks, PenLine, Trophy, Users } from "lucide-react";
import { StatStrip } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Quizzes" };

export default function Quizzes() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { db } = await requireAdmin("courses");
  const [{ data: quizzes }, { data: questions }, { data: attempts }] = await Promise.all([
    db.from("course_quizzes").select("id, title, pass_mark, course_id, course:courses(title), module:course_modules(title)").order("created_at", { ascending: false }),
    db.from("quiz_questions").select("quiz_id"),
    db.from("quiz_attempts").select("quiz_id, user_id, passed, score"),
  ]);
  const list = quizzes ?? [];
  const qCount = (id: string) => (questions ?? []).filter((q) => q.quiz_id === id).length;
  const stats = (id: string) => {
    const a = (attempts ?? []).filter((x) => x.quiz_id === id);
    const takers = new Set(a.map((x) => x.user_id));
    const passers = new Set(a.filter((x) => x.passed).map((x) => x.user_id));
    return { attempts: a.length, takers: takers.size, passRate: takers.size ? Math.round((passers.size / takers.size) * 100) : null, avg: a.length ? Math.round(a.reduce((n, x) => n + x.score, 0) / a.length) : null };
  };
  const all = attempts ?? [];
  const takers = new Set(all.map((a) => `${a.quiz_id}:${a.user_id}`)).size;
  const passed = new Set(all.filter((a) => a.passed).map((a) => `${a.quiz_id}:${a.user_id}`)).size;

  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Quizzes</h1>
          <p>One quiz per module. Learners must pass it to unlock the next module and to finish the course. Add a quiz from a course&apos;s Curriculum tab.</p>
        </div>
      </div>
      <StatStrip
        items={[
          { label: "Quizzes", value: list.length, icon: ListChecks },
          { label: "Attempts", value: all.length, icon: Users },
          { label: "First-time pass rate", value: takers ? `${Math.round((passed / takers) * 100)}%` : "None yet", icon: Trophy },
        ]}
      />
      <section className="et-card">
        {list.length === 0 ? (
          <p className="et-empty">No quizzes yet. Open a course, go to Curriculum, and add one at the end of a module.</p>
        ) : (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th className="et-th-right">Questions</th>
                  <th className="et-th-right">Pass mark</th>
                  <th className="et-th-right">Learners</th>
                  <th className="et-th-right">Passed</th>
                  <th className="et-th-right">Avg. score</th>
                  <th className="et-td-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => {
                  const s = stats(q.id);
                  return (
                    <tr key={q.id}>
                      <td>
                        <Link href={`/admin/courses/${q.course_id}/quizzes/${q.id}`}>
                          <b>{q.title}</b>
                        </Link>
                        <small className="et-muted" style={{ display: "block" }}>
                          {q.course?.title} · {q.module?.title}
                        </small>
                      </td>
                      <td className="et-td-right">{qCount(q.id) || <span className="et-blog-pending">None</span>}</td>
                      <td className="et-td-right">{q.pass_mark}%</td>
                      <td className="et-td-right">{s.takers}</td>
                      <td className="et-td-right">{s.passRate === null ? "None yet" : `${s.passRate}%`}</td>
                      <td className="et-td-right">{s.avg === null ? "None yet" : `${s.avg}%`}</td>
                      <td className="et-td-right">
                        <span className="et-row-actions">
                          <Link href={`/admin/courses/${q.course_id}/quizzes/${q.id}`} aria-label="Edit quiz" data-tip="Edit quiz">
                            <PenLine size={14} />
                          </Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
