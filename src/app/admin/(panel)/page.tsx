import Link from "next/link";
import { BookOpen, GraduationCap, MessagesSquare, Newspaper, Presentation, Users, Wallet, FileText } from "lucide-react";
import { PageHead, Stat, Status } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel, getActivityFeed } from "@/lib/data/admin";
import { compactMoney, formatDate } from "@/lib/format";
import { ActivityFeed } from "./ActivityFeed";

export const metadata = { title: "Dashboard" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { admin, db } = await requireAdmin();
  const { denied } = await searchParams;
  const count = { count: "exact", head: true } as const;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [users, instructors, published, enrollments, posts, docs, openChats, revenue, daily, recent, feed] = await Promise.all([
    db.from("profiles").select("id", count),
    db.from("profiles").select("id", count).eq("role", "instructor"),
    db.from("courses").select("id", count).eq("status", "published"),
    db.from("enrollments").select("user_id", count),
    db.from("blog_posts").select("id", count).eq("status", "published"),
    db.from("documents").select("id", count),
    db.from("support_threads").select("id", count).neq("status", "closed"),
    admin.isSuper
      ? db.from("payments").select("amount_minor").eq("status", "success").gte("paid_at", monthStart.toISOString())
      : Promise.resolve({ data: [] as { amount_minor: number }[] }),
    db.rpc("admin_daily_activity", { p_days: 14 }),
    db.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(6),
    getActivityFeed(db, 10),
  ]);

  const monthRevenue = (revenue.data ?? []).reduce((n, p) => n + p.amount_minor, 0);
  const signups = (daily.data ?? []).map((d) => ({ label: dayLabel(d.day), value: d.signups }));

  return (
    <div className="et-page">
      <PageHead title="Admin dashboard" sub="Everything happening on Etivio right now." />
      {denied && <p className="et-flash et-flash-err">That area is for super admins only.</p>}

      <div className="et-stats">
        <Stat label="Users" value={users.count ?? 0} icon={Users} href="/admin/users" />
        <Stat label="Instructors" value={instructors.count ?? 0} icon={Presentation} href="/admin/users?role=instructor" />
        <Stat label="Live courses" value={published.count ?? 0} icon={BookOpen} href="/admin/courses?status=published" />
        <Stat label="Enrollments" value={enrollments.count ?? 0} icon={GraduationCap} href="/admin/tracking" />
      </div>
      <div className="et-stats">
        {admin.isSuper ? (
          <Stat label="Revenue this month" value={compactMoney(monthRevenue)} icon={Wallet} href="/admin/financials" />
        ) : (
          <Stat label="Documents" value={docs.count ?? 0} icon={FileText} href="/admin/documents" />
        )}
        <Stat label="Open chats" value={openChats.count ?? 0} icon={MessagesSquare} href="/admin/chats" />
        <Stat label="Blog posts" value={posts.count ?? 0} icon={Newspaper} href="/admin/blog" />
        {admin.isSuper ? (
          <Stat label="Documents" value={docs.count ?? 0} icon={FileText} href="/admin/documents" />
        ) : (
          <Stat label="All enrollments" value={enrollments.count ?? 0} icon={GraduationCap} />
        )}
      </div>

      <div className="et-grid-main">
        <section className="et-card">
          <div className="et-card-head">
            <h2>New sign-ups, last 14 days</h2>
            <Link href="/admin/tracking">Tracking</Link>
          </div>
          <BarChart data={signups} />
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Newest users</h2>
            <Link href="/admin/users">All users</Link>
          </div>
          <ul className="et-feed">
            {(recent.data ?? []).map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`}>
                  <b>{u.full_name || "Unnamed"}</b>
                </Link>
                <Status value={u.role} />
                <time>{formatDate(u.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>
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
