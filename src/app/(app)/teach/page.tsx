import Link from "next/link";
import { BookOpen, Globe, Layers, Plus, Presentation, Users } from "lucide-react";
import { Empty, PageHead, Progress, Stat, Status } from "@/components/dash/ui";
import { canTeach, getCurrentUser } from "@/lib/auth";
import { getMyStudents, getMyTeachingCourses } from "@/lib/data/teach";
import { formatDate, formatPrice } from "@/lib/format";
import { becomeInstructor } from "./actions";

export const metadata = { title: "Teach" };

export default async function TeachDashboard() {
  const user = await getCurrentUser();
  if (!canTeach(user.role)) return <BecomeInstructor />;

  const [courses, students] = await Promise.all([getMyTeachingCourses(), getMyStudents(8)]);
  const published = courses.filter((c) => c.status === "published").length;
  const totalStudents = courses.reduce((n, c) => n + c.studentCount, 0);
  const totalLessons = courses.reduce((n, c) => n + c.lessonCount, 0);

  return (
    <div className="et-page">
      <PageHead title="Teaching dashboard" sub="Your courses and students at a glance.">
        <Link href="/teach/courses/new" className="et-btn et-btn-primary">
          <Plus size={15} />
          New course
        </Link>
      </PageHead>

      <div className="et-stats">
        <Stat label="Courses" value={courses.length} icon={BookOpen} href="/teach/courses" />
        <Stat label="Published" value={published} icon={Globe} href="/teach/courses" />
        <Stat label="Enrollments" value={totalStudents} icon={Users} href="/teach/students" />
        <Stat label="Lessons" value={totalLessons} icon={Layers} />
      </div>

      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your courses</h2>
            <Link href="/teach/courses">View all</Link>
          </div>
          {courses.length ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Students</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.slice(0, 6).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/teach/courses/${c.id}`}>
                          <b>{c.title}</b>
                          <small>
                            {c.lessonCount} lessons · {formatPrice(c.price_minor, c.currency)}
                          </small>
                        </Link>
                      </td>
                      <td>{c.studentCount}</td>
                      <td>
                        <Status value={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No courses yet" action={{ href: "/teach/courses/new", label: "Create your first course" }} />
          )}
        </section>

        <section className="et-card">
          <div className="et-card-head">
            <h2>Recent enrollments</h2>
            <Link href="/teach/students">View all</Link>
          </div>
          {students.length ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={`${s.userId}:${s.courseId}`}>
                      <td>
                        <b>{s.name}</b>
                        <small>
                          {s.courseTitle} · {formatDate(s.enrolledAt)}
                        </small>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <Progress value={s.progress} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="et-empty">Students who enroll in your courses show up here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function BecomeInstructor() {
  return (
    <div className="et-page">
      <section className="et-card et-cta">
        <span className="et-cta-icon">
          <Presentation size={24} />
        </span>
        <h2>Teach on Etivio</h2>
        <p>Share what you know with learners across Africa. Build a course, publish it, and track your students from one place.</p>
        <ul>
          <li>
            <b>Build</b>Organise lessons into modules with video and notes.
          </li>
          <li>
            <b>Publish</b>Offer it free or set your own price.
          </li>
          <li>
            <b>Track</b>See who enrolled and how far they have got.
          </li>
        </ul>
        <form action={becomeInstructor}>
          <button type="submit" className="et-btn et-btn-primary">
            Start teaching
          </button>
        </form>
      </section>
    </div>
  );
}
