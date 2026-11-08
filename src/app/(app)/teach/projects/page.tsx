import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Empty, PageHead, Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canEarn } from "@/lib/roles";
import { projectsByAuthor } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Projects" };

const LABEL = { draft: "Draft", open: "Open", closed: "Closed" } as const;

export default async function TeachProjects() {
  const user = await getCurrentUser();
  if (!canEarn(user.roles)) redirect("/teach");
  const projects = await projectsByAuthor(user.id);
  return (
    <div className="et-page">
      <PageHead title="Projects" sub="Set practical briefs, review what learners build and feature the best work in the public showcase.">
        <Link href="/teach/projects/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New project
        </Link>
      </PageHead>
      {projects.length ? (
        <section className="et-card">
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th className="et-th-right">Submissions</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/teach/projects/${p.id}`}>
                        <b>{p.title}</b>
                      </Link>
                      {p.courseTitle && <small className="et-muted" style={{ display: "block" }}>{p.courseTitle}</small>}
                    </td>
                    <td>
                      <Status value={p.status === "open" ? "published" : p.status === "draft" ? "draft" : "archived"} label={LABEL[p.status]} />
                    </td>
                    <td className="et-td-right">{p.submissions}</td>
                    <td>{p.dueAt ? formatDate(p.dueAt) : "No due date"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="et-card">
          <Empty title="No projects yet" action={{ href: "/teach/projects/new", label: "Create your first project" }}>
            A project is a practical brief learners build on their own, like a landing page, a sales plan or a data report. You give feedback and feature the best work.
          </Empty>
        </section>
      )}
    </div>
  );
}
