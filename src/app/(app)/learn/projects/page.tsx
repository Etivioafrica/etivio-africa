import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Empty, PageHead, Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { mySubmissions, openProjects, LEVELS } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Projects" };

export default async function LearnProjects() {
  const user = await getCurrentUser();
  const [projects, mine] = await Promise.all([openProjects(30), mySubmissions(user.id)]);
  const handedIn = new Set(mine.map((s) => s.projectId));
  return (
    <div className="et-page">
      <PageHead title="Projects" sub="Practical briefs from Etivio tutors. Build it, hand it in and get feedback.">
        <Link href="/projects" className="et-btn et-btn-ghost">
          See the showcase
        </Link>
      </PageHead>

      {mine.length > 0 && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your submissions</h2>
          </div>
          <div className="et-table-wrap">
            <table className="et-table">
              <tbody>
                {mine.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/projects/${s.projectId}`}>
                        <b>{s.title}</b>
                      </Link>
                      <small className="et-muted" style={{ display: "block" }}>Handed in {formatDate(s.createdAt)}</small>
                    </td>
                    <td>
                      <Status value={s.status === "featured" ? "published" : s.status === "reviewed" ? "completed" : "open"} label={s.status === "featured" ? "Featured" : s.status === "reviewed" ? "Feedback ready" : s.status === "hidden" ? "Hidden" : "Waiting for review"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="et-card">
        <div className="et-card-head">
          <h2>Open briefs</h2>
        </div>
        {projects.length ? (
          <div className="et-card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 16, border: "1px solid var(--a-border)", borderRadius: 12 }}>
                <small className="et-muted">{LEVELS[p.level]} · by {p.authorName}</small>
                <b>{p.title}</b>
                {p.dueAt && <small className="et-muted">Due {formatDate(p.dueAt)}</small>}
                <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600 }}>
                  {handedIn.has(p.id) ? "Handed in, update it" : "Start this project"} <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No open projects yet">When tutors publish project briefs, they show up here.</Empty>
        )}
      </section>
    </div>
  );
}
