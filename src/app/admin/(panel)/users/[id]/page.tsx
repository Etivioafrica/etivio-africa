import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Trash2, X } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { isAdminRole, requireAdmin } from "@/lib/admin";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { deleteUser, grantCourseAccess, revokeCourseAccess, sendPasswordReset, setUserRole, setUserStatus } from "../actions";

export const metadata = { title: "User" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, db } = await requireAdmin();

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.auth.admin.getUserById(id),
  ]);
  if (!profile || !authUser.user) notFound();
  const user = authUser.user;

  const [enrollments, taught, payments, threads, courses, events] = await Promise.all([
    db.from("enrollments").select("course_id, enrolled_at, completed_at, course:courses(title)").eq("user_id", id).order("enrolled_at", { ascending: false }),
    db.from("courses").select("id, title, status, created_at").eq("instructor_id", id).order("created_at", { ascending: false }),
    db.from("payments").select("id, amount_minor, currency, status, reference, paid_at, created_at, course:courses(title)").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("support_threads").select("id, subject, status, last_message_at").eq("user_id", id).order("last_message_at", { ascending: false }),
    db.from("courses").select("id, title").order("title"),
    db.from("activity_events").select("id, type, path, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(12),
  ]);

  const isSelf = id === admin.id;
  const targetIsAdmin = isAdminRole(profile.role);
  const canEdit = !isSelf && (!targetIsAdmin || admin.isSuper);
  const enrolledIds = new Set((enrollments.data ?? []).map((e) => e.course_id));
  const roleOptions = admin.isSuper ? ["student", "instructor", "admin", "super_admin"] : ["student", "instructor"];
  const name = profile.full_name || "Unnamed";

  return (
    <div className="et-page">
      <Link href="/admin/users" className="et-back">
        <ArrowLeft size={14} />
        Users
      </Link>
      <div className="et-page-head">
        <div className="et-cell-main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="et-avatar et-avatar-xl" /> : <span className="et-avatar et-avatar-xl">{name.charAt(0).toUpperCase()}</span>}
          <div>
            <h1>{name}</h1>
            <p className="et-inline" style={{ marginTop: 6 }}>
              {user.email} <Status value={profile.role} /> <Status value={profile.status} />
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="et-inline">
            <form action={setUserStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={profile.status === "active" ? "suspended" : "active"} />
              <button type="submit" className={`et-btn ${profile.status === "active" ? "et-btn-ghost" : "et-btn-success"}`}>
                {profile.status === "active" ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                {profile.status === "active" ? "Suspend" : "Reactivate"}
              </button>
            </form>
            {admin.isSuper && (
              <form action={deleteUser}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="et-btn et-btn-danger-text" data-tip="Permanently deletes the account">
                  <Trash2 size={15} />
                  Delete
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Enrollments</h2>
              <span className="et-muted">{enrollments.data?.length ?? 0}</span>
            </div>
            {enrollments.data?.length ? (
              <table className="et-table">
                <tbody>
                  {enrollments.data.map((e) => (
                    <tr key={e.course_id}>
                      <td>
                        <Link href={`/admin/courses/${e.course_id}`}>
                          <b>{e.course?.title ?? "Deleted course"}</b>
                        </Link>
                        <small>Enrolled {formatDate(e.enrolled_at)}</small>
                      </td>
                      <td>{e.completed_at ? <Status value="completed" /> : <Status value="in progress" />}</td>
                      <td className="et-td-right">
                        <form action={revokeCourseAccess} className="et-row-actions">
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="course_id" value={e.course_id} />
                          <button type="submit" className="is-danger" aria-label="Remove access" data-tip="Remove access">
                            <X size={14} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="et-empty">Not enrolled in any course.</p>
            )}
            <div style={{ borderTop: "1px solid var(--a-border)", padding: "14px 20px" }}>
              <ActionForm action={grantCourseAccess} className="et-inline">
                <input type="hidden" name="id" value={id} />
                <select name="course_id" className="et-input" aria-label="Course" defaultValue="" style={{ flex: 1, height: 36, width: "auto" }}>
                  <option value="" disabled>
                    Grant access to a course…
                  </option>
                  {(courses.data ?? [])
                    .filter((c) => !enrolledIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
                <SubmitButton className="et-btn et-btn-ghost et-btn-sm" pendingLabel="Granting…">
                  Grant access
                </SubmitButton>
              </ActionForm>
            </div>
          </section>

          {!!taught.data?.length && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Courses they teach</h2>
              </div>
              <table className="et-table">
                <tbody>
                  {taught.data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/courses/${c.id}`}>
                          <b>{c.title}</b>
                        </Link>
                      </td>
                      <td>
                        <Status value={c.status} />
                      </td>
                      <td>{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {admin.isSuper && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Payments</h2>
              </div>
              {payments.data?.length ? (
                <table className="et-table">
                  <tbody>
                    {payments.data.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.course?.title ?? "Course"}</b>
                          <small>{p.reference}</small>
                        </td>
                        <td className="et-money">{formatMoney(p.amount_minor, p.currency)}</td>
                        <td>
                          <Status value={p.status} />
                        </td>
                        <td>{formatDate(p.paid_at ?? p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="et-empty">No payments.</p>
              )}
            </section>
          )}

          <section className="et-card">
            <div className="et-card-head">
              <h2>Support conversations</h2>
            </div>
            {threads.data?.length ? (
              <ul className="et-feed">
                {threads.data.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/chats/${t.id}`}>
                      <b>{t.subject}</b>
                    </Link>
                    <Status value={t.status} />
                    <time>{formatDateTime(t.last_message_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="et-empty">No conversations.</p>
            )}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Account</h2>
            </div>
            <dl className="et-kv et-card-pad">
              <dt>Email</dt>
              <dd>
                {user.email} {user.email_confirmed_at ? "" : "(unconfirmed)"}
              </dd>
              <dt>Joined</dt>
              <dd>{formatDate(profile.created_at)}</dd>
              <dt>Last sign-in</dt>
              <dd>{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"}</dd>
              <dt>Bio</dt>
              <dd>{profile.bio || "None"}</dd>
              <dt>User ID</dt>
              <dd style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5 }}>{id}</dd>
            </dl>
          </section>

          {canEdit && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Role</h2>
              </div>
              <div className="et-card-pad">
                <ActionForm action={setUserRole}>
                  <input type="hidden" name="id" value={id} />
                  <div className="et-field">
                    <label htmlFor="role">User type</label>
                    <select id="role" name="role" defaultValue={profile.role}>
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                    <small>Admins run content, users and chats. Super admins also manage the team and financials.</small>
                  </div>
                  <div className="et-form-foot">
                    <SubmitButton>Save role</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </section>
          )}

          <section className="et-card">
            <div className="et-card-head">
              <h2>Password</h2>
            </div>
            <div className="et-card-pad">
              <ActionForm action={sendPasswordReset}>
                <input type="hidden" name="id" value={id} />
                <p className="et-muted" style={{ fontSize: 13 }}>
                  Email this user a link to set a new password.
                </p>
                <div className="et-form-foot">
                  <SubmitButton className="et-btn et-btn-ghost" pendingLabel="Sending…">
                    Send reset link
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Recent activity</h2>
            </div>
            {events.data?.length ? (
              <ul className="et-feed">
                {events.data.map((e) => (
                  <li key={e.id}>
                    <span>{e.type.replace(/_/g, " ")}</span>
                    {e.path && <span className="et-muted">{e.path}</span>}
                    <time>{formatDateTime(e.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="et-empty">No activity yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
