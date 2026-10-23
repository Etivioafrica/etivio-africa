import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHead, Progress, Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { getMyStudents } from "@/lib/data/teach";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/dash/Avatar";

export const metadata = { title: "Students" };

export default async function Students() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const students = await getMyStudents();
  const unique = new Set(students.map((s) => s.userId)).size;

  return (
    <div className="et-page">
      <PageHead title="Students" sub={`${unique} student${unique === 1 ? "" : "s"} across ${students.length} enrollment${students.length === 1 ? "" : "s"}.`} />
      <section className="et-card">
        {students.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th className="et-hide-sm">Enrolled</th>
                  <th>Progress</th>
                  <th className="et-hide-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={`${s.userId}:${s.courseId}`}>
                    <td>
                      <Link href={`/teach/students/${s.userId}`} className="et-cell-main">
                                                <Avatar src={s.avatarUrl} initial={s.name.charAt(0).toUpperCase()} seed={s.name} className="et-avatar" />
                        <b>{s.name}</b>
                      </Link>
                    </td>
                    <td>{s.courseTitle}</td>
                    <td className="et-hide-sm">{formatDate(s.enrolledAt)}</td>
                    <td style={{ minWidth: 160 }}>
                      <Progress value={s.progress} label={`${s.done}/${s.total}`} />
                    </td>
                    <td className="et-hide-sm">
                      <Status value={s.total > 0 && s.done >= s.total ? "completed" : "in progress"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No students yet">Once learners enroll in your published courses, they appear here.</Empty>
        )}
      </section>
    </div>
  );
}
