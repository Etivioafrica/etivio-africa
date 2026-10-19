import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { purgeExpiredUsers } from "./actions";
import { Avatar } from "@/components/dash/Avatar";

export const metadata = { title: "Users" };

const PAGE = 25;
const ROLE_TABS: { label: string; value?: AppRole }[] = [
  { label: "All" },
  { label: "Tutors", value: "tutor" },
  { label: "Coaches", value: "coach" },
  { label: "Event managers", value: "event_manager" },
  { label: "Community owners", value: "community_owner" },
  { label: "Editors", value: "editor" },
  { label: "Accounts", value: "accountant" },
  { label: "Super admins", value: "super_admin" },
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string; deleted?: string }> }) {
  const { db } = await requireAdmin("users");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = ROLE_TABS.find((t) => t.value === sp.role)?.value;
  const page = Math.max(1, Number(sp.page) || 1);
  const deleted = sp.deleted === "1";

  await purgeExpiredUsers(db);
  const [{ data }, { count: pendingApps }] = await Promise.all([
    db.rpc("admin_list_users", {
      p_search: q || undefined,
      p_role: role,
      p_deleted: deleted,
      p_limit: PAGE,
      p_offset: (page - 1) * PAGE,
    }),
    db.from("role_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, role, deleted: deleted ? 1 : undefined, page: undefined as number | undefined, ...over };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <div className="et-page">
      <PageHead title={deleted ? "Deleted users" : "Users"} sub={deleted ? "Restorable for 30 days, then erased automatically." : `${total} ${total === 1 ? "account" : "accounts"}${role ? ` · ${ROLE_LABELS[role].toLowerCase()}s` : ""}`}>
        <div className="et-inline">
          <Link href="/admin/users/applications" className="et-btn et-btn-ghost">
            <Inbox size={15} />
            Applications {pendingApps ? <span className="et-count">{pendingApps}</span> : null}
          </Link>
          <Link href={deleted ? "/admin/users" : "/admin/users?deleted=1"} className="et-btn et-btn-ghost">
            {deleted ? "Active users" : "Deleted users"}
          </Link>
        </div>
      </PageHead>
      <section className="et-card">
        <div className="et-filters">
          <div className="et-tabs">
            {ROLE_TABS.map((t) => (
              <Link key={t.label} href={link({ role: t.value })} className={t.value === role ? "is-on" : ""}>
                {t.label}
              </Link>
            ))}
          </div>
          <form action="/admin/users" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {role && <input type="hidden" name="role" value={role} />}
            {deleted && <input type="hidden" name="deleted" value="1" />}
            <input name="q" defaultValue={q} className="et-input" placeholder="Search name or email" aria-label="Search users" />
          </form>
        </div>
        {rows.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th className="et-th-right">Enrolled</th>
                  <th className="et-th-right">Courses</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="et-cell-main">
                                                <Avatar src={u.avatar_url} initial={(u.full_name || u.email).charAt(0).toUpperCase()} className="et-avatar" />
                        <span>
                          <b>{u.full_name || "Unnamed"}</b>
                          <small>
                            {u.email}
                            {!u.email_confirmed && " · unconfirmed"}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="et-inline" style={{ gap: 4 }}>
                        {(u.roles.length > 1 ? u.roles.filter((r) => r !== "student") : u.roles).map((r) => (
                          <span key={r} className="et-tag">
                            {ROLE_LABELS[r]}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      <Status value={u.status} />
                    </td>
                    <td className="et-td-right">{u.enrollment_count}</td>
                    <td className="et-td-right">{u.course_count}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-empty">No users match.</p>
        )}
        {pages > 1 && (
          <div className="et-pager">
            <span>
              Page {page} of {pages}
            </span>
            <div>
              {page > 1 && (
                <Link href={link({ page: page - 1 })} className="et-btn et-btn-ghost et-btn-sm">
                  <ChevronLeft size={14} /> Prev
                </Link>
              )}
              {page < pages && (
                <Link href={link({ page: page + 1 })} className="et-btn et-btn-ghost et-btn-sm">
                  Next <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
