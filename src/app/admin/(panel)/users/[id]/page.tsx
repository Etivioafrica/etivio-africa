import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Ban, BookCheck, CheckCircle2, GraduationCap, RotateCcw, Trash2, Wallet, X } from "lucide-react";
import { Progress, Stat, Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { EVENT_LABELS } from "@/lib/data/admin";
import { compactMoney, formatDate, formatDateTime, formatMoney, percent } from "@/lib/format";
import { CREATOR_ROLES, LIVE_CREATOR_ROLES, ROLE_BLURBS, ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import { deleteUser, grantCourseAccess, purgeUser, restoreUser, revokeCourseAccess, sendPasswordReset, setUserRoles, setUserStatus } from "../actions";

export const metadata = { title: "User" };

const PURGE_AFTER_DAYS = 30;

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, db } = await requireAdmin("users");

  const [{ data: profile }, { data: authUser }, { data: roleRows }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.auth.admin.getUserById(id),
    db.from("user_roles").select("role, granted_at").eq("user_id", id),
  ]);
  if (!profile || !authUser.user) notFound();
  const user = authUser.user;
  const roles = (roleRows ?? []).map((r) => r.role);

  const [enrollments, progress, taught, payments, sales, payouts, threads, courses, events, applications] = await Promise.all([
    db.from("enrollments").select("course_id, enrolled_at, completed_at, course:courses(title)").eq("user_id", id).order("enrolled_at", { ascending: false }),
    db.from("lesson_progress").select("lesson:lessons(course_id)").eq("user_id", id),
    db.from("courses").select("id, title, status, created_at").eq("instructor_id", id).order("created_at", { ascending: false }),
    db.from("payments").select("id, amount_minor, currency, status, reference, paid_at, created_at, course:courses(title)").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("payments").select("instructor_share_minor").eq("instructor_id", id).eq("status", "success"),
    db.from("payouts").select("amount_minor, status").eq("instructor_id", id),
    db.from("support_threads").select("id, subject, status, last_message_at").eq("user_id", id).order("last_message_at", { ascending: false }),
    db.from("courses").select("id, title").order("title"),
    db
      .from("activity_events")
      .select("id, type, path, created_at, course:courses!activity_events_course_id_fkey(title)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("role_applications").select("id, role, status, message, created_at, review_note").eq("user_id", id).order("created_at", { ascending: false }),
  ]);

  const enrolled = enrollments.data ?? [];
  const courseIds = enrolled.map((e) => e.course_id);
  const { data: lessonRows } = courseIds.length ? await db.from("lessons").select("course_id").in("course_id", courseIds) : { data: [] };
  const totalBy = new Map<string, number>();
  for (const l of lessonRows ?? []) totalBy.set(l.course_id, (totalBy.get(l.course_id) ?? 0) + 1);
  const doneBy = new Map<string, number>();
  for (const p of progress.data ?? []) {
    const cid = p.lesson?.course_id;
    if (cid) doneBy.set(cid, (doneBy.get(cid) ?? 0) + 1);
  }
  const lessonsDone = progress.data?.length ?? 0;
  const spent = (payments.data ?? []).filter((p) => p.status === "success").reduce((n, p) => n + p.amount_minor, 0);
  const earned = (sales.data ?? []).reduce((n, p) => n + p.instructor_share_minor, 0);
  const paidOut = (payouts.data ?? []).filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_minor, 0);
  const lastActive = events.data?.[0]?.created_at ?? user.last_sign_in_at ?? null;

  const isSelf = id === admin.id;
  const enrolledIds = new Set(courseIds);
  const name = profile.full_name || "Unnamed";
  const deleted = !!profile.deleted_at;
  const purgeOn = deleted ? new Date(Date.parse(profile.deleted_at!) + PURGE_AFTER_DAYS * 86_400_000).toISOString() : null;
  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";

  return (
    <div className="et-page">
      <Link href={deleted ? "/admin/users?deleted=1" : "/admin/users"} className="et-back">
        <ArrowLeft size={14} />
        Users
      </Link>

      {deleted && (
        <div className="et-flash et-flash-err" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            Deleted {formatDate(profile.deleted_at)}. This account is hidden and signed out. It will be erased permanently on {formatDate(purgeOn)}.
          </span>
          <span className="et-inline">
            <form action={restoreUser}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="et-btn et-btn-sm" style={{ background: "#fff", color: "#111" }}>
                <RotateCcw size={14} />
                Restore
              </button>
            </form>
            <form action={purgeUser}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="et-btn et-btn-sm" style={{ background: "#7f1d1d", color: "#fff" }}>
                Erase now
              </button>
            </form>
          </span>
        </div>
      )}

      <div className="et-page-head">
        <div className="et-cell-main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="et-avatar et-avatar-xl" /> : <span className="et-avatar et-avatar-xl">{name.charAt(0).toUpperCase()}</span>}
          <div>
            <h1>{name}</h1>
            <p className="et-inline" style={{ marginTop: 6 }}>
              {user.email}
              {roles.map((r) => (
                <span key={r} className="et-tag">
                  {ROLE_LABELS[r]}
                </span>
              ))}
              <Status value={profile.status} />
            </p>
          </div>
        </div>
        {!isSelf && !deleted && (
          <div className="et-inline">
            <form action={setUserStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={profile.status === "active" ? "suspended" : "active"} />
              <button type="submit" className={`et-btn ${profile.status === "active" ? "et-btn-ghost" : "et-btn-success"}`}>
                {profile.status === "active" ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                {profile.status === "active" ? "Suspend" : "Reactivate"}
              </button>
            </form>
            <form action={deleteUser}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="et-btn et-btn-danger-text" data-tip={`Hides and signs them out. Restorable for ${PURGE_AFTER_DAYS} days.`}>
                <Trash2 size={15} />
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="et-stats">
        <Stat label="Courses enrolled" value={enrolled.length} icon={GraduationCap} />
        <Stat label="Lessons done" value={lessonsDone} icon={BookCheck} />
        <Stat label={roles.includes("tutor") ? "Earned as tutor" : "Total spent"} value={compactMoney(roles.includes("tutor") ? earned : spent)} icon={Wallet} />
        <Stat label="Last active" value={lastActive ? formatDate(lastActive) : "Never"} icon={Activity} />
      </div>

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Learning</h2>
              <span className="et-muted">{enrolled.length} courses</span>
            </div>
            {enrolled.length ? (
              <table className="et-table">
                <tbody>
                  {enrolled.map((e) => {
                    const total = totalBy.get(e.course_id) ?? 0;
                    const done = doneBy.get(e.course_id) ?? 0;
                    return (
                      <tr key={e.course_id}>
                        <td>
                          <Link href={`/admin/courses/${e.course_id}`}>
                            <b>{e.course?.title ?? "Deleted course"}</b>
                          </Link>
                          <small>Enrolled {formatDate(e.enrolled_at)}</small>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <Progress value={percent(done, total)} label={`${done}/${total}`} />
                        </td>
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
                    );
                  })}
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

          {(roles.includes("tutor") || !!taught.data?.length) && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Teaching</h2>
                <span className="et-muted">
                  Earned {formatMoney(earned)} · paid out {formatMoney(paidOut)} · owed {formatMoney(Math.max(0, earned - paidOut))}
                </span>
              </div>
              {taught.data?.length ? (
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
              ) : (
                <p className="et-empty">No courses yet.</p>
              )}
            </section>
          )}

          <section className="et-card">
            <div className="et-card-head">
              <h2>Payments</h2>
              <span className="et-muted">{formatMoney(spent)} spent</span>
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

          <section className="et-card">
            <div className="et-card-head">
              <h2>Activity timeline</h2>
              <span className="et-muted">last 30 events</span>
            </div>
            {events.data?.length ? (
              <ul className="et-feed">
                {events.data.map((e) => (
                  <li key={e.id}>
                    <span className="et-feed-dot" />
                    <span>
                      {EVENT_LABELS[e.type] ?? e.type.replace(/_/g, " ")} {e.course?.title ? <b>{e.course.title}</b> : e.path ? <b>{e.path}</b> : null}
                    </span>
                    <time>{formatDateTime(e.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="et-empty">No activity yet.</p>
            )}
          </section>

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
              <h2>Details</h2>
            </div>
            <dl className="et-kv et-card-pad">
              <dt>Email</dt>
              <dd>
                {user.email} {user.email_confirmed_at ? <Status value="active" /> : "(unconfirmed)"}
              </dd>
              <dt>Phone</dt>
              <dd>{user.phone || "Not added"}</dd>
              <dt>Signs in with</dt>
              <dd style={{ textTransform: "capitalize" }}>{provider}</dd>
              <dt>Joined</dt>
              <dd>{formatDateTime(profile.created_at)}</dd>
              <dt>Last sign-in</dt>
              <dd>{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"}</dd>
              <dt>Profile updated</dt>
              <dd>{formatDateTime(profile.updated_at)}</dd>
              <dt>Bio</dt>
              <dd>{profile.bio || "None"}</dd>
              <dt>User ID</dt>
              <dd style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5 }}>{id}</dd>
            </dl>
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Roles</h2>
            </div>
            <div className="et-card-pad">
              {isSelf ? (
                <p className="et-muted" style={{ fontSize: 13 }}>
                  You can&apos;t change your own roles. Ask another super admin.
                </p>
              ) : (
                <ActionForm action={setUserRoles}>
                  <input type="hidden" name="id" value={id} />
                  <p className="et-nav-label" style={{ padding: 0 }}>
                    Platform
                  </p>
                  {CREATOR_ROLES.map((r) => (
                    <label key={r} className="et-check" style={{ alignItems: "flex-start" }}>
                      <input type="checkbox" name="roles" value={r} defaultChecked={roles.includes(r)} style={{ marginTop: 2 }} />
                      <span>
                        <b style={{ color: "var(--a-fg)" }}>{ROLE_LABELS[r]}</b>
                        {!LIVE_CREATOR_ROLES.includes(r) && <span className="et-tag" style={{ marginLeft: 6 }}>Coming soon</span>}
                        <br />
                        <small>{ROLE_BLURBS[r]}</small>
                      </span>
                    </label>
                  ))}
                  <p className="et-nav-label" style={{ padding: "8px 0 0" }}>
                    Staff
                  </p>
                  {STAFF_ROLES.map((r) => (
                    <label key={r} className="et-check" style={{ alignItems: "flex-start" }}>
                      <input type="checkbox" name="roles" value={r} defaultChecked={roles.includes(r)} style={{ marginTop: 2 }} />
                      <span>
                        <b style={{ color: "var(--a-fg)" }}>{ROLE_LABELS[r]}</b>
                        <br />
                        <small>{ROLE_BLURBS[r]}</small>
                      </span>
                    </label>
                  ))}
                  <small className="et-muted">Everyone is always a student.</small>
                  <div className="et-form-foot">
                    <SubmitButton>Save roles</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </div>
          </section>

          {!!applications.data?.length && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Applications</h2>
                <Link href="/admin/users/applications">Review queue</Link>
              </div>
              <ul className="et-feed">
                {applications.data.map((a) => (
                  <li key={a.id}>
                    <span>
                      <b>{ROLE_LABELS[a.role]}</b>
                      <br />
                      <small className="et-muted">{a.review_note || a.message}</small>
                    </span>
                    <Status value={a.status === "approved" ? "active" : a.status} />
                    <time>{formatDate(a.created_at)}</time>
                  </li>
                ))}
              </ul>
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
        </div>
      </div>
    </div>
  );
}
