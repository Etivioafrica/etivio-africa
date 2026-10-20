import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { formatBytes, formatDate } from "@/lib/format";
import { addDocument, deleteDocument } from "./actions";
import { VisibilitySelect } from "./VisibilitySelect";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "Documents" };

export default async function AdminDocuments({ searchParams }: { searchParams: Promise<{ course?: string; q?: string }> }) {
  const { db } = await requireAdmin("documents");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  let query = db
    .from("documents")
    .select("id, title, description, file_url, file_name, file_size, visibility, created_at, course:courses(id, title)")
    .order("created_at", { ascending: false });
  if (sp.course) query = query.eq("course_id", sp.course);
  if (q) query = query.ilike("title", `%${q}%`);
  const [{ data: docs }, { data: courses }] = await Promise.all([query, db.from("courses").select("id, title").order("title")]);

  return (
    <div className="et-page">
      <PageHead title="Documents" sub="Resource library: PDFs, worksheets, and files for students." />

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
        <section className="et-card">
          <div className="et-filters">
            <form action="/admin/documents" className="et-inline" style={{ flex: 1 }}>
              <input name="q" defaultValue={q} className="et-input" placeholder="Search documents" aria-label="Search documents" />
              <Select name="course" defaultValue={sp.course ?? ""} className="et-input" aria-label="Filter by course">
                <option value="">All courses</option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
              <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                Filter
              </button>
            </form>
          </div>
          {docs?.length ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Course</th>
                    <th>Visible to</th>
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <b>{d.title}</b>
                        <small>
                          {d.file_name ?? "File"}
                          {d.file_size ? ` · ${formatBytes(d.file_size)}` : ""}
                        </small>
                      </td>
                      <td>{d.course ? <Link href={`/admin/courses/${d.course.id}`}>{d.course.title}</Link> : "None"}</td>
                      <td>
                        <VisibilitySelect id={d.id} value={d.visibility} />
                      </td>
                      <td>{formatDate(d.created_at)}</td>
                      <td>
                        <div className="et-row-actions">
                          <a href={d.file_url} target="_blank" rel="noreferrer" aria-label="Open file" data-tip="Open file">
                            <Download size={14} />
                          </a>
                          <form action={deleteDocument}>
                            <input type="hidden" name="id" value={d.id} />
                            <button type="submit" className="is-danger" aria-label="Delete document" data-tip="Delete">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="et-empty">No documents yet. Upload one on the right.</p>
          )}
        </section>

        <section className="et-card">
          <div className="et-card-head">
            <h2>Upload a document</h2>
          </div>
          <div className="et-card-pad">
            <ActionForm action={addDocument}>
              <Uploader name="file" kind="document" label="Click or drop a file (up to 200 MB)" />
              <div className="et-field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" placeholder="Defaults to the file name" />
              </div>
              <div className="et-field">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows={2} />
              </div>
              <div className="et-field">
                <label htmlFor="course_id">Course</label>
                <Select id="course_id" name="course_id" defaultValue={sp.course ?? ""}>
                  <option value="">Not attached to a course</option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="et-field">
                <label htmlFor="visibility">Visible to</label>
                <Select id="visibility" name="visibility" defaultValue="enrolled">
                  <option value="enrolled">Students enrolled in the course</option>
                  <option value="public">Everyone</option>
                  <option value="private">Admins only</option>
                </Select>
              </div>
              <div className="et-form-foot">
                <SubmitButton>Add document</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
