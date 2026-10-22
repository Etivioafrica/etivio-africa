import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Clock, Layers, ShieldCheck } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Review queue" };

type Props = { searchParams: Promise<{ tab?: string }> };

// The page is rendered per request (it reads searchParams), so reading the clock here is fine.
const clock = () => Date.now();

// How long something has been waiting, in the largest sensible unit.
function waiting(since: string | null, now: number) {
  if (!since) return "–";
  const mins = Math.max(0, Math.round((now - Date.parse(since)) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

export default function ReviewQueue({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Review queue</h1>
          <p>Tutor courses and products waiting to go live, oldest first. Check each one, then approve it or ask for changes.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Queue({ searchParams }: Props) {
  const { tab } = await searchParams;
  const { db } = await requireAdmin("review");
  const now = clock();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const [{ data: courses }, { data: products }, { data: lessons }, { count: decided }] = await Promise.all([
    db
      .from("courses")
      .select("id, title, cover_url, price_minor, currency, submitted_at, updated_at, instructor:profiles!courses_instructor_id_fkey(full_name)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true, nullsFirst: false }),
    db
      .from("products")
      .select("id, kind, title, cover_url, price_minor, currency, updated_at, creator:profiles!products_creator_id_fkey(full_name)")
      .eq("status", "pending")
      .order("updated_at", { ascending: true }),
    db.from("lessons").select("course_id, courses!inner(status)").eq("courses.status", "pending"),
    db.from("admin_audit_log").select("id", { count: "exact", head: true }).in("action", ["course.approve", "course.reject", "product.approve", "product.reject"]).gte("created_at", weekAgo),
  ]);
  const lessonCount = new Map<string, number>();
  for (const l of lessons ?? []) lessonCount.set(l.course_id, (lessonCount.get(l.course_id) ?? 0) + 1);

  const cs = courses ?? [];
  const ps = products ?? [];
  const active = tab === "products" ? "products" : "courses";
  const oldest = [...cs.map((c) => c.submitted_at ?? c.updated_at), ...ps.map((p) => p.updated_at)].sort()[0] ?? null;

  return (
    <>
      <div className="et-stats">
        <Stat label="Courses waiting" value={cs.length} icon={BookOpen} href="/admin/review?tab=courses" />
        <Stat label="Products waiting" value={ps.length} icon={Layers} href="/admin/review?tab=products" />
        <Stat label="Oldest in queue" value={oldest ? waiting(oldest, now) : "Nothing waiting"} icon={Clock} />
        <Stat label="Decisions this week" value={decided ?? 0} icon={ShieldCheck} />
      </div>

      <section className="et-card">
        <nav className="et-seg" style={{ margin: 16, width: "fit-content" }}>
          <Link href="/admin/review?tab=courses" className={active === "courses" ? "is-on" : ""}>
            Courses
            {cs.length > 0 && <span className="et-seg-count">{cs.length}</span>}
          </Link>
          <Link href="/admin/review?tab=products" className={active === "products" ? "is-on" : ""}>
            Products
            {ps.length > 0 && <span className="et-seg-count">{ps.length}</span>}
          </Link>
        </nav>

        {active === "courses" ? (
          cs.length ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Tutor</th>
                    <th className="et-th-right">Lessons</th>
                    <th>Price</th>
                    <th>Waiting</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cs.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/review/courses/${c.id}`} className="et-mk-row">
                          <span className="et-pd-thumb">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {c.cover_url ? <img src={c.cover_url} alt="" /> : <BookOpen size={16} />}
                          </span>
                          <span>
                            <b>{c.title}</b>
                            <small>Course</small>
                          </span>
                        </Link>
                      </td>
                      <td>{c.instructor?.full_name || "Unknown"}</td>
                      <td className="et-td-right">{lessonCount.get(c.id) ?? 0}</td>
                      <td>{c.price_minor ? formatPrice(c.price_minor, c.currency) : "Free"}</td>
                      <td className="et-muted">{waiting(c.submitted_at ?? c.updated_at, now)}</td>
                      <td className="et-td-right">
                        <Link href={`/admin/review/courses/${c.id}`} className="et-btn et-btn-ghost">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Clear what="courses" />
          )
        ) : ps.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Creator</th>
                  <th>Price</th>
                  <th>Waiting</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ps.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/review/products/${p.id}`} className="et-mk-row">
                        <span className="et-pd-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.cover_url ? <img src={p.cover_url} alt="" /> : <Layers size={16} />}
                        </span>
                        <span>
                          <b>{p.title}</b>
                          <small>{ITEM_TYPES[p.kind].label}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{p.creator?.full_name || "Unknown"}</td>
                    <td>{p.price_minor ? formatPrice(p.price_minor, p.currency) : "Free"}</td>
                    <td className="et-muted">{waiting(p.updated_at, now)}</td>
                    <td className="et-td-right">
                      <Link href={`/admin/review/products/${p.id}`} className="et-btn et-btn-ghost">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Clear what="products" />
        )}
      </section>
    </>
  );
}

function Clear({ what }: { what: string }) {
  return (
    <div className="et-empty-mini" style={{ padding: "32px 16px" }}>
      <ClipboardCheck size={20} />
      <p>
        <b>All caught up.</b> No {what} are waiting for review.
      </p>
    </div>
  );
}
