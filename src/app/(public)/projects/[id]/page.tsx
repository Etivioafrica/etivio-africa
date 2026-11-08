import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProject, submissionsFor, LEVELS } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";
import { SubmitForm } from "./SubmitForm";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProject((await params).id);
  if (!p || p.status === "draft") return { title: "Project | Etivio" };
  return { title: `${p.title} | Etivio project`, description: `A practical ${LEVELS[p.level].toLowerCase()} project brief by ${p.authorName} on Etivio.`, alternates: { canonical: `/projects/${p.id}` } };
}

export default function ProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-mkt"><div className="et-skel" style={{ height: 420 }} /></div>}>
      <ProjectView params={params} />
    </Suspense>
  );
}

async function ProjectView({ params }: Props) {
  const project = await getProject((await params).id);
  if (!project || project.status === "draft") notFound();
  const featured = await submissionsFor(project.id, { featuredOnly: true });
  const pastDue = !!project.dueAt && Date.parse(project.dueAt) < Date.now();

  return (
    <div className="et-mkt">
      <Link href="/projects" className="et-back">
        <ArrowLeft size={14} /> All projects
      </Link>
      <section className="et-card et-card-pad" style={{ marginTop: 12 }}>
        <small className="et-muted">
          {LEVELS[project.level]} project · by {project.authorUsername ? <Link href={`/@${project.authorUsername}`}>{project.authorName}</Link> : project.authorName}
          {project.dueAt ? ` · due ${formatDate(project.dueAt)}` : ""}
        </small>
        <h1 style={{ margin: "8px 0 0", fontSize: "clamp(28px,3.4vw,42px)", letterSpacing: "-.02em" }}>{project.title}</h1>
        {project.skills.length > 0 && <p className="et-muted" style={{ marginTop: 8 }}>Skills: {project.skills.join(", ")}</p>}
        {project.courseTitle && (
          <p className="et-muted" style={{ marginTop: 4 }}>
            Part of the course {project.courseTitle}
          </p>
        )}
        <div className="et-prose" style={{ marginTop: 20 }} dangerouslySetInnerHTML={{ __html: project.brief }} />
      </section>

      <section className="et-card" style={{ marginTop: 20 }}>
        <div className="et-card-head">
          <h2>Hand in your work</h2>
        </div>
        <div className="et-card-pad">
          {project.status === "closed" || pastDue ? (
            <p className="et-muted">This project is no longer taking submissions.</p>
          ) : (
            <Suspense fallback={null}>
              <SubmitPanel projectId={project.id} authorId={project.authorId} />
            </Suspense>
          )}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="et-card" style={{ marginTop: 20 }}>
          <div className="et-card-head">
            <h2>Featured work</h2>
          </div>
          <div className="et-card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {featured.map((s) => (
              <article key={s.id} style={{ padding: 16, border: "1px solid var(--a-border)", borderRadius: 12 }}>
                <b>{s.title}</b>
                <small className="et-muted" style={{ display: "block" }}>by {s.username ? <Link href={`/@${s.username}`}>{s.name}</Link> : s.name}</small>
                <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 14 }}>{s.summary}</p>
                {s.linkUrl && (
                  <a href={s.linkUrl} target="_blank" rel="noreferrer nofollow" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 14 }}>
                    <ExternalLink size={13} /> View work
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function SubmitPanel({ projectId, authorId }: { projectId: string; authorId: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return (
      <p>
        <Link href={`/login?next=/projects/${projectId}`} className="et-btn et-btn-primary">
          Sign in to submit
        </Link>{" "}
        <Link href={`/signup?next=/projects/${projectId}`} className="et-btn et-btn-ghost">
          Create a free account
        </Link>
      </p>
    );
  if (user.id === authorId) return <p className="et-muted">This is your project. Review submissions from your Teach dashboard.</p>;
  const { data: mine } = await createAdminClient().from("project_submissions").select("title, summary, link_url, status, feedback").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  return (
    <>
      {mine?.feedback && (
        <div className="et-flash" style={{ background: "var(--a-panel-2)", border: "1px solid var(--a-border)", marginBottom: 16 }}>
          <b>Feedback from your tutor</b>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{mine.feedback}</p>
        </div>
      )}
      {mine?.status === "featured" && <p className="et-muted" style={{ marginBottom: 12 }}>Your work is featured in the showcase.</p>}
      <SubmitForm projectId={projectId} initial={mine ? { title: mine.title, summary: mine.summary, link: mine.link_url ?? "" } : undefined} />
    </>
  );
}
