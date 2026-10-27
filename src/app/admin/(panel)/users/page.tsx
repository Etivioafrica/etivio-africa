import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { purgeExpiredUsers } from "./actions";
import { UsersTable } from "./UsersTable";
import { ROLE_TABS } from "./tabs";

export const metadata = { title: "Users" };

// Up to this many accounts load at once, so search and role tabs filter in the browser as you type. Past it, the
// list switches to searching on the server.
const LOAD_ALL = 2000;
const PAGE = 25;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string; deleted?: string }> }) {
  const { db, admin } = await requireAdmin("users");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = ROLE_TABS.find((t) => t.value === sp.role)?.value;
  const page = Math.max(1, Number(sp.page) || 1);
  const deleted = sp.deleted === "1";

  await purgeExpiredUsers(db);
  const [{ data: all }, { count: pendingApps }] = await Promise.all([
    db.rpc("admin_list_users", { p_deleted: deleted, p_limit: LOAD_ALL, p_offset: 0 }),
    db.from("role_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const everyone = all ?? [];
  const total = Number(everyone[0]?.total_count ?? 0);
  const local = total <= LOAD_ALL;

  // Too many to hold in the browser: search, filter and page on the server instead.
  const rows = local
    ? everyone
    : ((
        await db.rpc("admin_list_users", {
          p_search: q || undefined,
          p_role: role,
          p_deleted: deleted,
          p_limit: PAGE,
          p_offset: (page - 1) * PAGE,
        })
      ).data ?? []);

  return (
    <div className="et-page">
      <PageHead title={deleted ? "Deleted users" : "Users"} sub={deleted ? "Restorable for 30 days, then erased automatically." : `${total} ${total === 1 ? "account" : "accounts"}`}>
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
      <UsersTable
        key={local ? "local" : `${q}|${role}|${page}`}
        rows={rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.full_name ?? "",
          avatar: u.avatar_url,
          roles: u.roles,
          status: u.status,
          enrolled: u.enrollment_count,
          courses: u.course_count,
          joined: u.created_at,
          lastSignIn: u.last_sign_in_at,
          confirmed: u.email_confirmed,
        }))}
        local={local}
        serverTotal={local ? 0 : Number(rows[0]?.total_count ?? 0)}
        initial={{ q, role, page }}
        deleted={deleted}
        adminId={admin.id}
      />
    </div>
  );
}
