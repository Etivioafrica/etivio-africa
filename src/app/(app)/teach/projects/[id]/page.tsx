import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActionForm } from "@/components/dash/ActionForm";
import { PageHead, Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canEarn } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProject, submissionsFor } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";
import { ProjectForm } from "../ProjectForm";
import { deleteProject, reviewSubmission, setProjectStatus } from "../actions";

export const metadata = { title: "Project" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!canEarn(user.roles)) redirect("/teach");
  const project = await getProject(id);
  if (!project || project.authorId !== user.id) notFound();
  const [subs, { data: courses }] = await Promise.all([
    submissionsFor(project.id),
    createAdminClient().from("courses").select("id, title").eq("instructor_id", user.id).order("title"),
  ]);

  return (
    <div className="et-page">
      <Link href="/teach/projects" className="et-back">
        <ArrowLeft size={14} /> Projects
      </Link>
      <PageHead title={project.title} sub={project.status === "open" ? "Open: learners can see this brief and submit." : project.status === "draft" ? "Draft: only you can see this." : "Closed: no new submissions."}>
        {project.status !== "draft" && (
          <Link href={`/projects/${project.id}`} className="et-btn et-btn-ghost">
            <ExternalLink size={14} /> View public page
          </Link>
        )}
        <form action={setProjectStatus}>
          <input type="hidden" name="id" value={project.id} />
          {project.status === "open" ? (
            <button name="status" value="closed" className="et-btn et-btn-ghost">Close submissions</button>
          ) : project.status === "closed" ? (
            <button name="status" value="open" className="et-btn et-btn-ghost">Reopen</button>
          ) : null}
        </form>
      </PageHead>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Submissions ({subs.length})</h2>
        </div>
        {subs.length ? (
          <div className="et-card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {subs.map((s) => (
              <article key={s.id} style={{ border: "1px solid var(--a-border)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <b>{s.title}</b>
                    <small className="et-muted" style={{ display: "block" }}>
                      {s.username ? <Link href={`/@${s.username}`}>{s.name}</Link> : s.name} · {formatDate(s.createdAt)}
                    </small>
                  </div>
                  <Status value={s.status === "featured" ? "published" : s.status === "reviewed" ? "completed" : "open"} label={s.status === "featured" ? "Featured" : s.status === "reviewed" ? "Reviewed" : "New"} />
                </div>
                {s.summary && <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{s.summary}</p>}
                {s.linkUrl && (
                  <a href={s.linkUrl} target="_blank" rel="noreferrer nofollow" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 14 }}>
                    <ExternalLink size={13} /> Open their work
                  </a>
                )}
                <ActionForm action={reviewSubmission} toast>
                  <input type="hidden" name="id" value={s.id} />
                  <div className="et-field" style={{ marginTop: 12 }}>
                    <label htmlFor={`fb-${s.id}`}>Your feedback</label>
                    <textarea id={`fb-${s.id}`} name="feedback" rows={3} maxLength={2000} defaultValue={s.feedback ?? ""} placeholder="What worked, and one thing to improve." />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button name="action" value="save" className="et-btn et-btn-ghost et-btn-sm">Save feedback</button>
                    {s.status !== "featured" && <button name="action" value="feature" className="et-btn et-btn-primary et-btn-sm">Feature in showcase</button>}
                    <button name="action" value="hide" className="et-btn et-btn-danger-text et-btn-sm">Hide</button>
                  </div>
                </ActionForm>
              </article>
            ))}
          </div>
        ) : (
          <p className="et-card-pad et-muted">{project.status === "draft" ? "Publish the project to start receiving submissions." : "No submissions yet."}</p>
        )}
      </section>

      <section className="et-card et-card-pad">
        <ProjectForm
          courses={courses ?? []}
          initial={{ id: project.id, title: project.title, brief: project.brief, skills: project.skills, level: project.level, due: project.dueAt?.slice(0, 10), courseId: project.courseId, status: project.status }}
        />
        <form action={deleteProject} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={project.id} />
          <button className="et-btn et-btn-danger-text et-btn-sm">Delete project</button>
        </form>
      </section>
    </div>
  );
}
