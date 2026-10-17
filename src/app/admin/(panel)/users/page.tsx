import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import type { Role } from "@/lib/auth";

export const metadata = { title: "Users" };

const PAGE = 25;
const ROLE_TABS: { label: string; value?: Role }[] = [
  { label: "All" },
  { label: "Students", value: "student" },
  { label: "Instructors", value: "instructor" },
  { label: "Admins", value: "admin" },
  { label: "Super admins", value: "super_admin" },
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = ROLE_TABS.find((t) => t.value === sp.role)?.value;
  const page = Math.max(1, Number(sp.page) || 1);

  const { data } = await db.rpc("admin_list_users", {
    p_search: q || undefined,
    p_role: role,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, role, page: undefined as number | undefined, ...over };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <div className="et-page">
      <PageHead title="Users" sub={`${total} ${total === 1 ? "account" : "accounts"}${role ? ` · ${role.replace("_", " ")}s` : ""}`} />
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
            <input name="q" defaultValue={q} className="et-input" placeholder="Search name or email" aria-label="Search users" />
          </form>
        </div>
        {rows.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="et-avatar" /> : <span className="et-avatar">{(u.full_name || u.email).charAt(0).toUpperCase()}</span>}
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
                      <Status value={u.role} />
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
