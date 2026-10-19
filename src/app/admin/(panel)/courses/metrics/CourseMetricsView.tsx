"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Award, GraduationCap, ListChecks, Star, Users, Wallet } from "lucide-react";
import { BarChart } from "@/components/dash/BarChart";
import { Cover, StatStrip } from "@/components/dash/ui";
import { compactMoney } from "@/lib/format";

type Row = { id: string; title: string; cover_url: string | null; status: string; price_minor: number; students: number; completed: number; revenue: number; rating: number | null; reviews: number; avgProgress: number | null };
type Key = "students" | "completion" | "avgProgress" | "rating" | "revenue";

export function CourseMetricsView({
  courses,
  selected,
  funnel,
  enrolled,
  days,
  filtered,
}: {
  courses: Row[];
  selected: string | null;
  funnel: { label: string; kind: "lesson" | "quiz"; done: number }[];
  enrolled: number;
  days: { label: string; value: number }[];
  filtered: boolean;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<Key>("students");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const completion = (r: Row) => (r.students ? Math.round((r.completed / r.students) * 100) : -1);
  const val = (r: Row) => (sort === "completion" ? completion(r) : sort === "rating" ? (r.rating ?? -1) : sort === "avgProgress" ? (r.avgProgress ?? -1) : r[sort]);
  const sorted = useMemo(() => [...courses].sort((a, b) => (dir === "desc" ? val(b) - val(a) : val(a) - val(b))), [courses, sort, dir]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = courses.reduce((n, c) => n + c.students, 0);
  const completed = courses.reduce((n, c) => n + c.completed, 0);
  const revenue = courses.reduce((n, c) => n + c.revenue, 0);
  const rated = courses.filter((c) => c.rating !== null);
  const reviews = rated.reduce((n, c) => n + c.reviews, 0);
  const rating = reviews ? (rated.reduce((n, c) => n + (c.rating ?? 0) * c.reviews, 0) / reviews).toFixed(1) : null;
  const chosen = courses.find((c) => c.id === selected);
  const worst = funnel.reduce<{ i: number; drop: number } | null>((acc, step, i) => {
    if (i === 0) return acc;
    const drop = funnel[i - 1].done - step.done;
    return drop > 0 && (!acc || drop > acc.drop) ? { i, drop } : acc;
  }, null);

  function by(k: Key) {
    if (sort === k) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setDir("desc");
    }
  }

  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Course metrics</h1>
          <p>Enrolments, completion and where learners stop.</p>
        </div>
      </div>

      <StatStrip
        items={[
          { label: "Enrolments", value: students.toLocaleString(), icon: Users, href: "/admin/courses/students" },
          { label: "Completion rate", value: students ? `${Math.round((completed / students) * 100)}%` : "None yet", icon: Award, hint: `${completed} certificates issued` },
          { label: "Average rating", value: rating ? `${rating} ★` : "No reviews", icon: Star, href: "/admin/courses/reviews", hint: reviews ? `${reviews} reviews` : undefined },
          { label: "Course revenue", value: compactMoney(revenue), icon: Wallet, href: "/admin/financials" },
        ]}
      />

      <div className="et-grid-2" style={{ alignItems: "start" }}>
        <section className="et-card">
          <div className="et-card-head">
            <h2>New enrolments</h2>
            <span className="et-muted" style={{ fontSize: 12.5 }}>
              Last 30 days{filtered && chosen ? ` · ${chosen.title}` : ""}
            </span>
          </div>
          <BarChart data={days} integer height={200} />
        </section>

        <section className="et-card">
          <div className="et-card-head">
            <h2>Where learners stop</h2>
            <select className="et-input" value={selected ?? ""} onChange={(e) => router.replace(`/admin/courses/metrics?course=${e.target.value}`, { scroll: false })} aria-label="Course" style={{ height: 32, width: "auto", maxWidth: 220, fontSize: 12.5 }}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          {!funnel.length ? (
            <p className="et-empty">This course has no lessons yet.</p>
          ) : !enrolled ? (
            <p className="et-empty">No one has enrolled yet, so there&apos;s nothing to show.</p>
          ) : (
            <>
              {worst && (
                <p className="et-funnel-note">
                  Biggest drop: <b>{worst.drop}</b> {worst.drop === 1 ? "learner stops" : "learners stop"} before <b>{funnel[worst.i].label}</b>.
                </p>
              )}
              <ol className="et-funnel">
                {funnel.map((f, i) => {
                  const pct = Math.round((f.done / enrolled) * 100);
                  return (
                    <li key={i} className={worst?.i === i ? "is-worst" : ""}>
                      <span className="et-funnel-label">
                        {f.kind === "quiz" ? <ListChecks size={12} /> : <GraduationCap size={12} />}
                        {f.label}
                      </span>
                      <span className="et-funnel-bar">
                        <span style={{ width: `${Math.max(pct, 1)}%` }} />
                      </span>
                      <b>{pct}%</b>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>All courses</h2>
        </div>
        <div className="et-table-wrap">
          <table className="et-table">
            <thead>
              <tr>
                <th>Course</th>
                {(
                  [
                    ["students", "Students"],
                    ["completion", "Completion"],
                    ["avgProgress", "Avg. progress"],
                    ["rating", "Rating"],
                    ["revenue", "Revenue"],
                  ] as [Key, string][]
                ).map(([k, label]) => (
                  <th key={k} aria-sort={sort === k ? (dir === "desc" ? "descending" : "ascending") : "none"}>
                    <button type="button" className={`et-sort${sort === k ? " is-on" : ""}`} onClick={() => by(k)}>
                      {label}
                      {sort !== k ? <ArrowUpDown size={12} /> : dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/courses/${c.id}`} className="et-cell-main">
                      <Cover url={c.cover_url} small />
                      <span>
                        <b>{c.title}</b>
                        <small style={{ textTransform: "capitalize" }}>{c.status}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <b>{c.students}</b>
                  </td>
                  <td>{c.students ? `${completion(c)}%` : "None yet"}</td>
                  <td>{c.avgProgress === null ? "None yet" : `${c.avgProgress}%`}</td>
                  <td>{c.rating ? `${c.rating.toFixed(1)} ★ (${c.reviews})` : "No reviews"}</td>
                  <td className="et-money">{c.price_minor ? compactMoney(c.revenue) : "Free"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
