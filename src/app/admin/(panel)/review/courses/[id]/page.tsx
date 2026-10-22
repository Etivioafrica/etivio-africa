import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, FileText, PlayCircle, ShieldCheck, X } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { COURSE_STATUS_LABEL } from "@/lib/course-status";
import { formatBytes, formatDateTime, formatPrice } from "@/lib/format";
import { signedDownloadUrl } from "@/lib/r2";
import { Decision } from "../../Decision";

export const metadata = { title: "Review course" };

type Props = { params: Promise<{ id: string }> };

const text = (html: string | null) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function ReviewCourse({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 560 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id } = await params;
  const { db } = await requireAdmin("review");
  const [{ data: c }, { data: modules }, { data: lessons }, { data: files }] = await Promise.all([
    db
      .from("courses")
      .select("*, instructor:profiles!courses_instructor_id_fkey(id, full_name, trusted_tutor), category:course_categories(name), reviewer:profiles!courses_reviewed_by_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    db.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    db.from("lessons").select("id, module_id, title, kind, video_url, content, is_preview, position").eq("course_id", id).order("position"),
    db.from("documents").select("id, lesson_id, file_key, file_name, file_size, mime_type").eq("course_id", id).not("lesson_id", "is", null),
  ]);
  if (!c) notFound();

  const all = lessons ?? [];
  const filesBy = new Map<string, NonNullable<typeof files>>();
  for (const f of files ?? []) filesBy.set(f.lesson_id!, [...(filesBy.get(f.lesson_id!) ?? []), f]);
  // Short-lived links so the reviewer can open each file. Nothing here is public.
  const links = new Map(await Promise.all((files ?? []).filter((f) => f.file_key).map(async (f) => [f.id, await signedDownloadUrl(f.file_key!, f.file_name ?? "file", 900)] as const)));
  const empty = all.filter((l) => !l.video_url && !text(l.content) && !filesBy.get(l.id)?.length);

  const checks = [
    { ok: !!c.cover_url, label: "Has a cover image" },
    { ok: text(c.summary).length >= 20, label: "Has a short summary" },
    { ok: text(c.description).length >= 100, label: "Has a description of at least 100 characters" },
    { ok: !!c.category_id, label: "Has a category" },
    { ok: all.length >= 1, label: "Has at least one lesson" },
    { ok: all.length > 0 && empty.length === 0, label: empty.length ? `Every lesson has content (${empty.length} empty)` : "Every lesson has content" },
    { ok: c.price_minor === 0 || c.price_minor >= 50_000, label: c.price_minor ? `Price is ${formatPrice(c.price_minor, c.currency)}` : "Free course" },
  ];
  const ready = checks.every((k) => k.ok);

  return (
    <>
      <Link href="/admin/review?tab=courses" className="et-back">
        <ArrowLeft size={14} /> Review queue
      </Link>

      <div className="et-page-head">
        <div>
          <h1>{c.title}</h1>
          <p>
            By <b>{c.instructor?.full_name || "Unknown"}</b>
            {c.instructor?.trusted_tutor ? " · Trusted tutor" : ""} · {COURSE_STATUS_LABEL[c.status]}
            {c.submitted_at ? ` · Submitted ${formatDateTime(c.submitted_at)}` : ""}
          </p>
        </div>
        {c.status === "published" && (
          <Link href={`/courses/${c.slug}`} className="et-btn et-btn-ghost" target="_blank">
            View live page
          </Link>
        )}
      </div>

      {c.status !== "pending" && (
        <p className="et-rv-done">
          <ShieldCheck size={15} />
          {c.status === "rejected" ? "Changes were requested" : "This course isn't waiting for review"}
          {c.reviewed_at ? ` · ${formatDateTime(c.reviewed_at)}` : ""}
          {c.reviewer?.full_name ? ` by ${c.reviewer.full_name}` : ""}
          {c.review_note ? `: "${c.review_note}"` : ""}
        </p>
      )}

      <div className="et-grid-main">
        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="et-card et-card-pad et-rv-overview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.cover_url && <img src={c.cover_url} alt="" className="et-rv-cover" />}
            <dl className="et-rv-facts">
              <div>
                <dt>Price</dt>
                <dd>{c.price_minor ? formatPrice(c.price_minor, c.currency) : "Free"}</dd>
              </div>
              <div>
                <dt>Level</dt>
                <dd style={{ textTransform: "capitalize" }}>{c.level}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{c.category?.name ?? "None"}</dd>
              </div>
              <div>
                <dt>Lessons</dt>
                <dd>{all.length}</dd>
              </div>
            </dl>
            {c.summary && <p className="et-rv-summary">{c.summary}</p>}
            {c.description && <p className="et-rv-desc">{text(c.description)}</p>}
            {!!c.skills?.length && (
              <p className="et-muted" style={{ fontSize: 12.5 }}>
                Skills: {c.skills.join(", ")}
              </p>
            )}
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Curriculum</h2>
            </div>
            {(modules ?? []).map((m) => {
              const ls = all.filter((l) => l.module_id === m.id);
              return (
                <div key={m.id} className="et-rv-module">
                  <h3>{m.title}</h3>
                  {ls.length ? (
                    <ul>
                      {ls.map((l) => {
                        const fs = filesBy.get(l.id) ?? [];
                        const body = text(l.content);
                        const isEmpty = !l.video_url && !body && !fs.length;
                        return (
                          <li key={l.id} className={isEmpty ? "is-empty" : ""}>
                            <div className="et-rv-lesson-head">
                              {l.video_url ? <PlayCircle size={15} /> : <FileText size={15} />}
                              <b>{l.title}</b>
                              {l.is_preview && <span className="et-tag">Free preview</span>}
                              {isEmpty && <span className="et-rv-flag">No content</span>}
                            </div>
                            {l.video_url && (
                              <a href={l.video_url} target="_blank" rel="noreferrer" className="et-rv-link">
                                {l.video_url.length > 70 ? `${l.video_url.slice(0, 70)}…` : l.video_url}
                              </a>
                            )}
                            {body && <p className="et-rv-excerpt">{body.length > 260 ? `${body.slice(0, 260)}…` : body}</p>}
                            {fs.map((f) => (
                              <a key={f.id} href={links.get(f.id) ?? "#"} className="et-rv-file">
                                <Download size={13} /> {f.file_name} <small>{formatBytes(f.file_size ?? 0)}</small>
                              </a>
                            ))}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="et-muted" style={{ padding: "0 20px 14px", fontSize: 13 }}>
                      No lessons in this section.
                    </p>
                  )}
                </div>
              );
            })}
            {!modules?.length && <p className="et-empty">No curriculum yet.</p>}
          </section>
        </div>

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="et-card et-card-pad">
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Checklist</h2>
            <ul className="et-rv-checks">
              {checks.map((k) => (
                <li key={k.label} className={k.ok ? "is-ok" : "is-miss"}>
                  {k.ok ? <Check size={14} /> : <X size={14} />} {k.label}
                </li>
              ))}
            </ul>
          </section>
          {c.status === "pending" && <Decision kind="course" id={c.id} ready={ready} />}
        </div>
      </div>
    </>
  );
}
