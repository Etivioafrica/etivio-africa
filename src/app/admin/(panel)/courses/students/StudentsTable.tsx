"use client";
import { useState } from "react";
import Link from "next/link";
import { Award, Download, Search } from "lucide-react";
import { Progress } from "@/components/dash/ui";
import { fmtShort } from "@/lib/blog";
import type { StudentRow } from "@/lib/data/courses-admin";
import { Avatar } from "@/components/dash/Avatar";

type State = "all" | "not_started" | "in_progress" | "completed";
const stateOf = (r: StudentRow): Exclude<State, "all"> => (r.completed ? "completed" : r.progress > 0 ? "in_progress" : "not_started");
const LABEL: Record<Exclude<State, "all">, string> = { not_started: "Not started", in_progress: "In progress", completed: "Completed" };

// Shared by Courses › Students (all courses) and a course's Students tab (`fixedCourse`).
export function StudentsTable({ rows, courses, initialCourse = "all", fixedCourse }: { rows: StudentRow[]; courses: { id: string; title: string }[]; initialCourse?: string; fixedCourse?: boolean }) {
  const [course, setCourse] = useState(initialCourse);
  const [state, setState] = useState<State>("all");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const inCourse = rows.filter((r) => course === "all" || r.courseId === course);
  const counts = { all: inCourse.length, not_started: 0, in_progress: 0, completed: 0 };
  for (const r of inCourse) counts[stateOf(r)]++;
  const shown = inCourse.filter((r) => (state === "all" || stateOf(r) === state) && (!q || r.name.toLowerCase().includes(q) || r.course.toLowerCase().includes(q)));

  function exportCsv() {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Name", "Course", "Status", "Progress %", "Enrolled", "Last active", "Certificate"].map(esc).join(","),
      ...shown.map((r) => [r.name, r.course, LABEL[stateOf(r)], r.progress, r.enrolledAt.slice(0, 10), r.lastActive?.slice(0, 10) ?? "", r.certificate ?? ""].map(esc).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `etivio-students-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="et-card">
      <div className="et-blog-bar">
        <nav className="et-blog-filter" aria-label="Filter by progress">
          {(["all", "not_started", "in_progress", "completed"] as State[]).map((s) => (
            <button key={s} type="button" className={state === s ? "is-on" : ""} onClick={() => setState(s)} aria-pressed={state === s}>
              {s === "all" ? "All" : LABEL[s]}
              <span>{counts[s]}</span>
            </button>
          ))}
        </nav>
        <div className="et-inline">
          {!fixedCourse && (
            <select className="et-input" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter by course">
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <label className="et-blog-search">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learners…" aria-label="Search learners" />
          </label>
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={exportCsv} disabled={!shown.length}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="et-empty">{rows.length ? "No learners match these filters." : "No one is enrolled yet."}</p>
      ) : (
        <div className="et-table-wrap">
          <table className="et-table">
            <thead>
              <tr>
                <th>Learner</th>
                {!fixedCourse && <th>Course</th>}
                <th style={{ minWidth: 170 }}>Progress</th>
                <th>Enrolled</th>
                <th>Last active</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.userId}:${r.courseId}`}>
                  <td>
                    <Link href={`/admin/users/${r.userId}`} className="et-cell-main">
                                            <Avatar src={r.avatar} initial={r.name.charAt(0).toUpperCase()} className="et-avatar" />
                      <span>
                        <b>{r.name}</b>
                        <small>{LABEL[stateOf(r)]}</small>
                      </span>
                    </Link>
                  </td>
                  {!fixedCourse && (
                    <td>
                      <Link href={`/admin/courses/${r.courseId}?tab=students`}>{r.course}</Link>
                    </td>
                  )}
                  <td>
                    <Progress value={r.progress} label={`${r.progress}%`} />
                  </td>
                  <td className="et-nowrap">{fmtShort(r.enrolledAt)}</td>
                  <td className="et-nowrap">{r.lastActive ? fmtShort(r.lastActive) : "Not yet"}</td>
                  <td>
                    {r.certificate ? (
                      <Link href={`/certificate/${r.certificate}`} target="_blank" className="et-tag">
                        <Award size={12} /> {r.certificate}
                      </Link>
                    ) : (
                      <span className="et-muted">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
