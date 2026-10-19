import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Megaphone,
  MessagesSquare,
  Newspaper,
  PenLine,
  Plus,
  Presentation,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { StatStrip } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel, getActivityFeed } from "@/lib/data/admin";
import { compactMoney, formatDate } from "@/lib/format";
import { ROLE_LABELS, primaryRole } from "@/lib/roles";
import { ActivityFeed } from "./ActivityFeed";
import { Avatar } from "@/components/dash/Avatar";

export const metadata = { title: "Dashboard" };

const DAY = 86_400_000;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { admin, db } = await requireAdmin();
  const { denied } = await searchParams;
  // Editors and accounts staff start in their own area.
  if (!admin.isSuper) redirect(admin.roles.includes("accountant") ? "/admin/financials" : "/admin/blog");
  const count = { count: "exact", head: true } as const;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [users, newUsers, tutors, published, drafts, enrollments, newEnrollments, posts, docs, openChats, applications, scheduled, revenue, daily, recent, feed] =
    await Promise.all([
      db.from("profiles").select("id", count),
      db.from("profiles").select("id", count).gte("created_at", weekAgo),
      db.from("user_roles").select("user_id", count).eq("role", "tutor"),
      db.from("courses").select("id", count).eq("status", "published"),
      db.from("courses").select("id", count).eq("status", "draft"),
      db.from("enrollments").select("user_id", count),
      db.from("enrollments").select("user_id", count).gte("enrolled_at", weekAgo),
      db.from("blog_posts").select("id", count).eq("status", "published"),
      db.from("documents").select("id", count),
      db.from("support_threads").select("id", count).neq("status", "closed"),
      db.from("role_applications").select("id", count).eq("status", "pending"),
      db.from("announcements").select("id", count).eq("status", "scheduled").gt("scheduled_at", now.toISOString()),
      db.from("payments").select("amount_minor").eq("status", "success").gte("paid_at", monthStart),
      db.rpc("admin_daily_activity", { p_days: 14 }),
      db
        .from("profiles")
        .select("id, full_name, avatar_url, created_at, roles:user_roles!user_roles_user_id_fkey(role)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      getActivityFeed(db, 8),
    ]);

  const n = (r: { count: number | null }) => r.count ?? 0;
  const monthRevenue = (revenue.data ?? []).reduce((sum, p) => sum + p.amount_minor, 0);
  const signups = (daily.data ?? []).map((d) => ({ label: dayLabel(d.day), value: d.signups }));
  const signupTotal = signups.reduce((sum, d) => sum + d.value, 0);
  const first = (admin.name || "there").split(" ")[0];
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

  const attention: { icon: LucideIcon; label: string; count: number; href: string }[] = [
    { icon: UserCheck, label: "Tutor applications to review", count: n(applications), href: "/admin/users/applications" },
    { icon: MessagesSquare, label: "Open support chats", count: n(openChats), href: "/admin/chats" },
    { icon: PenLine, label: "Draft courses", count: n(drafts), href: "/admin/courses?status=draft" },
    { icon: CalendarClock, label: "Scheduled announcements", count: n(scheduled), href: "/admin/announcements" },
  ];
  const pending = attention.filter((a) => a.count > 0);

  return (
    <div className="et-page">
      <div className="et-admin-head">
        <div>
          <p className="et-admin-date">{today}</p>
          <h1>Hello, {first}</h1>
          <p className="et-muted">Here&apos;s everything happening on Etivio right now.</p>
        </div>
        <div className="et-inline">
          <Link href="/" target="_blank" className="et-btn et-btn-ghost">
            <ExternalLink size={15} /> View site
          </Link>
          <Link href="/admin/courses/new" className="et-btn et-btn-ghost">
            <Plus size={15} /> New course
          </Link>
          <Link href="/admin/announcements" className="et-btn et-btn-primary">
            <Megaphone size={15} /> New announcement
          </Link>
        </div>
      </div>

      {denied && <p className="et-flash et-flash-err">That area is for super admins only.</p>}

      <StatStrip
        items={[
          { label: "Users", value: n(users), icon: Users, href: "/admin/users", hint: n(newUsers) ? `+${n(newUsers)} this week` : "No new users this week" },
          { label: "Tutors", value: n(tutors), icon: Presentation, href: "/admin/users?role=tutor", hint: n(applications) ? `${n(applications)} waiting for review` : "No pending applications" },
          { label: "Live courses", value: n(published), icon: BookOpen, href: "/admin/courses?status=published", hint: `${n(drafts)} in draft` },
          { label: "Enrollments", value: n(enrollments), icon: GraduationCap, href: "/admin/tracking", hint: n(newEnrollments) ? `+${n(newEnrollments)} this week` : "None this week" },
        ]}
      />
      <StatStrip
        items={[
          { label: "Revenue this month", value: compactMoney(monthRevenue), icon: Wallet, href: "/admin/financials", hint: "Successful payments" },
          { label: "Open chats", value: n(openChats), icon: MessagesSquare, href: "/admin/chats", hint: n(openChats) ? "Learners waiting" : "Inbox clear" },
          { label: "Blog posts", value: n(posts), icon: Newspaper, href: "/admin/blog", hint: "Published" },
          { label: "Documents", value: n(docs), icon: FileText, href: "/admin/documents", hint: "Shared files" },
        ]}
      />

      <div className="et-grid-main is-stretch">
        <section className="et-card">
          <div className="et-card-head">
            <h2>New sign-ups</h2>
            <span className="et-muted" style={{ fontSize: 12.5 }}>
              <b style={{ color: "var(--a-fg)" }}>{signupTotal}</b> in the last 14 days ·{" "}
              <Link href="/admin/tracking" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Tracking
              </Link>
            </span>
          </div>
          <BarChart data={signups} integer height={200} />
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Needs attention</h2>
            </div>
            {pending.length ? (
              <ul className="et-attn">
                {pending.map(({ icon: Icon, label, count: c, href }) => (
                  <li key={label}>
                    <Link href={href}>
                      <span className="et-set-icon">
                        <Icon size={16} />
                      </span>
                      <span>{label}</span>
                      <b>{c}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="et-attn-clear">
                <CheckCircle2 size={16} /> You&apos;re all caught up.
              </p>
            )}
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Newest users</h2>
              <Link href="/admin/users">All users</Link>
            </div>
            <ul className="et-people">
              {(recent.data ?? []).map((u) => {
                const name = u.full_name || "Unnamed";
                return (
                  <li key={u.id}>
                    <Link href={`/admin/users/${u.id}`}>
                                            <Avatar src={u.avatar_url} initial={name.charAt(0).toUpperCase()} className="et-avatar" />
                      <span className="et-people-main">
                        <b>{name}</b>
                        <small>{formatDate(u.created_at)}</small>
                      </span>
                      <span className="et-tag">{ROLE_LABELS[primaryRole(u.roles.map((r) => r.role))]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Recent activity</h2>
          <Link href="/admin/tracking">See all</Link>
        </div>
        <ActivityFeed items={feed} />
      </section>
    </div>
  );
}
