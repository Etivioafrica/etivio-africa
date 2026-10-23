"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, Eye, PenLine, Plus, Search, Send, Star, Undo2 } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { useToast } from "@/components/dash/useToast";
import { compactMoney } from "@/lib/format";
import type { Category } from "@/components/dash/CategoryManager";
import type { AdminCourse, CourseMetric } from "@/lib/data/courses-admin";
import { setCourseFeatured, setCourseStatus } from "./actions";
import { Select } from "@/components/dash/Select";
import { COURSE_STATUS_LABEL as LABEL, type CourseStatus } from "@/lib/course-status";
import { confirmDialog } from "@/components/dash/dialogs";

type Filter = "all" | CourseStatus;

export function CourseList({ courses, categories, metrics }: { courses: AdminCourse[]; categories: Category[]; metrics: Record<string, CourseMetric> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, show] = useToast();
  const [pending, start] = useTransition();

  const counts = { all: courses.length, published: 0, pending: 0, rejected: 0, draft: 0, archived: 0 };
  for (const c of courses) counts[c.status]++;
  const parents = categories.filter((c) => !c.parent_id);
  const inCat = (c: AdminCourse) => {
    if (cat === "all") return true;
    const ids = new Set([cat, ...categories.filter((x) => x.parent_id === cat).map((x) => x.id)]);
    return !!c.category_id && ids.has(c.category_id);
  };
  const q = search.trim().toLowerCase();
  const shown = courses.filter((c) => (filter === "all" || c.status === filter) && inCat(c) && (!q || c.title.toLowerCase().includes(q) || (c.instructor ?? "").toLowerCase().includes(q)));
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      show(await fn());
    });

  return (
    <>
      {toast}
      <div className="et-page-head">
        <div>
          <h1>Courses</h1>
          <p>Every course on Etivio, from every instructor.</p>
        </div>
        <Link href="/admin/courses/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New course
        </Link>
      </div>

      <section className="et-card">
        <div className="et-blog-bar">
          <nav className="et-blog-filter" aria-label="Filter by status">
            {(["all", "published", "pending", "rejected", "draft", "archived"] as Filter[]).filter((f) => f === "all" || f === "published" || f === "draft" || counts[f] > 0).map((f) => (
              <button key={f} type="button" className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                {f === "all" ? "All" : LABEL[f]}
                <span>{counts[f]}</span>
              </button>
            ))}
          </nav>
          <div className="et-inline">
            <Select className="et-input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
              <option value="all">All categories</option>
              {parents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <label className="et-blog-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses or instructors…" aria-label="Search courses" />
            </label>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="et-empty">{q ? `No courses matching "${search}".` : "No courses here yet."}</p>
        ) : (
          <div className="et-table-wrap">
            <table className="et-table et-blog-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                  <th className="et-th-right">Students</th>
                  <th className="et-th-right">Completed</th>
                  <th>Rating</th>
                  <th className="et-th-right">Revenue</th>
                  <th className="et-td-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const m = metrics[c.id];
                  const rate = m?.students ? Math.round((m.completed / m.students) * 100) : null;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/courses/${c.id}`} className="et-cell-main">
                          <Cover url={c.cover_url} small />
                          <span>
                            <b>{c.title}</b>
                            <small>
                              {c.instructor ?? "No instructor"} · {c.lessons} {c.lessons === 1 ? "lesson" : "lessons"}
                              {c.quizzes ? ` · ${c.quizzes} ${c.quizzes === 1 ? "quiz" : "quizzes"}` : ""}
                              {catName(c.category_id) ? ` · ${catName(c.category_id)}` : ""}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className={`et-blog-status is-static is-${c.status === "published" ? "published" : c.status === "draft" || c.status === "rejected" ? "draft" : "scheduled"}`}>
                          <i />
                          {LABEL[c.status]}
                        </span>
                      </td>
                      <td className="et-td-right">{m?.students ?? 0}</td>
                      <td className="et-td-right">{rate === null ? "None yet" : `${rate}%`}</td>
                      <td>
                        {m?.rating ? (
                          <span className="et-stars-inline">
                            <Star size={13} fill="currentColor" /> {m.rating.toFixed(1)} <small>({m.reviews})</small>
                          </span>
                        ) : (
                          <span className="et-muted">No reviews</span>
                        )}
                        {!!m?.pendingReviews && <b className="et-blog-pending"> +{m.pendingReviews}</b>}
                      </td>
                      <td className="et-td-right et-money">{c.price_minor ? compactMoney(m?.revenue ?? 0) : "Free"}</td>
                      <td className="et-td-right">
                        <span className="et-row-actions">
                          <button
                            type="button"
                            className={c.featured ? "is-star" : ""}
                            disabled={pending || (c.status !== "published" && !c.featured)}
                            onClick={() => run(() => setCourseFeatured(c.id, !c.featured))}
                            data-tip={c.featured ? "Remove from homepage" : c.status !== "published" ? "Publish it first to feature it" : "Feature on the homepage"}
                            aria-label={c.featured ? "Remove from homepage" : "Feature on the homepage"}
                          >
                            <Star size={14} fill={c.featured ? "currentColor" : "none"} />
                          </button>
                          {c.status !== "published" ? (
                            <button type="button" disabled={pending || !c.lessons} onClick={() => run(() => setCourseStatus(c.id, "published"))} data-tip={c.lessons ? "Publish" : "Add a lesson first"} aria-label="Publish">
                              <Send size={14} />
                            </button>
                          ) : (
                            <button type="button" disabled={pending} onClick={async () => (await confirmDialog({ title: `Archive "${c.title}"?`, body: "Enrolled learners keep access; it leaves the catalog.", confirmLabel: "Archive" })) && run(() => setCourseStatus(c.id, "archived"))} data-tip="Archive" aria-label="Archive">
                              <Archive size={14} />
                            </button>
                          )}
                          {c.status === "archived" && (
                            <button type="button" disabled={pending} onClick={() => run(() => setCourseStatus(c.id, "draft"))} data-tip="Back to draft" aria-label="Back to draft">
                              <Undo2 size={14} />
                            </button>
                          )}
                          <Link href={`/learn/course/${c.id}`} target="_blank" data-tip="Preview as a learner" aria-label="Preview">
                            <Eye size={14} />
                          </Link>
                          <Link href={`/admin/courses/${c.id}`} data-tip="Edit" aria-label="Edit">
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
