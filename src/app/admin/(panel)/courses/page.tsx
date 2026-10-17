import Link from "next/link";
import { Plus } from "lucide-react";
import { Cover, Empty, PageHead, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatPrice } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const metadata = { title: "Courses" };

type CourseStatus = Database["public"]["Enums"]["course_status"];
const TABS: { label: string; value?: CourseStatus }[] = [
  { label: "All" },
  { label: "Published", value: "published" },
  { label: "Drafts", value: "draft" },
  { label: "Archived", value: "archived" },
];

export default async function AdminCourses({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { db } = await requireAdmin("courses");
  const sp = await searchParams;
  const status = TABS.find((t) => t.value === sp.status)?.value;
  const q = sp.q?.trim() ?? "";

  let query = db
    .from("courses")
    .select("id, title, cover_url, level, status, price_minor, currency, updated_at, instructor:profiles!courses_instructor_id_fkey(id, full_name)")
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: courses } = await query;
  const list = courses ?? [];
  const ids = list.map((c) => c.id);

  const [{ data: lessons }, { data: enrollments }] = ids.length
    ? await Promise.all([
        db.from("lessons").select("course_id").in("course_id", ids),
        db.from("enrollments").select("course_id").in("course_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const tally = (rows: { course_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1);
    return m;
  };
  const lessonsBy = tally(lessons);
  const studentsBy = tally(enrollments);

  return (
    <div className="et-page">
      <PageHead title="Courses" sub="Every course on Etivio, from every instructor.">
        <Link href="/admin/courses/new" className="et-btn et-btn-primary">
          <Plus size={15} />
          New course
        </Link>
      </PageHead>
      <section className="et-card">
        <div className="et-filters">
          <div className="et-tabs">
            {TABS.map((t) => (
              <Link key={t.label} href={t.value ? `/admin/courses?status=${t.value}` : "/admin/courses"} className={t.value === status ? "is-on" : ""}>
                {t.label}
              </Link>
            ))}
          </div>
          <form action="/admin/courses" style={{ marginLeft: "auto" }}>
            {status && <input type="hidden" name="status" value={status} />}
            <input name="q" defaultValue={q} className="et-input" placeholder="Search courses" aria-label="Search courses" />
          </form>
        </div>
        {list.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                  <th className="et-th-right">Lessons</th>
                  <th className="et-th-right">Students</th>
                  <th className="et-th-right">Price</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/courses/${c.id}`} className="et-cell-main">
                        <Cover url={c.cover_url} small />
                        <span>
                          <b>{c.title}</b>
                          <small>{c.instructor?.full_name || "Unknown instructor"}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td className="et-td-right">{lessonsBy.get(c.id) ?? 0}</td>
                    <td className="et-td-right">{studentsBy.get(c.id) ?? 0}</td>
                    <td className="et-td-right et-money">{formatPrice(c.price_minor, c.currency)}</td>
                    <td>{formatDate(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No courses here" action={{ href: "/admin/courses/new", label: "Create a course" }} />
        )}
      </section>
    </div>
  );
}
