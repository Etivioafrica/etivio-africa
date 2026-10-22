import Link from "next/link";
import { COURSE_STATUS_LABEL } from "@/lib/course-status";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Cover, Empty, PageHead, Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { getMyTeachingCourses } from "@/lib/data/teach";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata = { title: "Courses" };

export default async function TeachCourses() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const courses = await getMyTeachingCourses();

  return (
    <div className="et-page">
      <PageHead title="Courses" sub={`${courses.length} course${courses.length === 1 ? "" : "s"}`}>
        <Link href="/teach/courses/new" className="et-btn et-btn-primary">
          <Plus size={15} />
          New course
        </Link>
      </PageHead>
      <section className="et-card">
        {courses.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th className="et-hide-sm">Lessons</th>
                  <th>Students</th>
                  <th className="et-hide-sm">Price</th>
                  <th>Status</th>
                  <th className="et-hide-sm">Updated</th>
                  <th className="et-th-right" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/teach/courses/${c.id}`} className="et-cell-main">
                        <Cover url={c.cover_url} small />
                        <span>
                          <b>{c.title}</b>
                          <small>/{c.slug}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="et-hide-sm">{c.lessonCount}</td>
                    <td>{c.studentCount}</td>
                    <td className="et-hide-sm">{formatPrice(c.price_minor, c.currency)}</td>
                    <td>
                      <Status value={c.status} label={COURSE_STATUS_LABEL[c.status]} />
                    </td>
                    <td className="et-hide-sm">{formatDate(c.updated_at)}</td>
                    <td>
                      <div className="et-row-actions">
                        <Link href={`/teach/courses/${c.id}`} aria-label="Edit course" data-tip="Edit">
                          <Pencil size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No courses yet" action={{ href: "/teach/courses/new", label: "Create your first course" }}>
            Courses you create start as drafts until you publish them.
          </Empty>
        )}
      </section>
    </div>
  );
}
