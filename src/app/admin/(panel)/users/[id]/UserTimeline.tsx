import { BookCheck, GraduationCap, Rocket, UserPlus, Zap, type LucideIcon } from "lucide-react";

type Event = { id: number; type: string; path: string | null; created_at: string; course: { title: string } | null };

const TZ = "Africa/Lagos";

const KEY_EVENTS: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  signup: { icon: UserPlus, color: "#2563eb", label: "Signed up" },
  enroll: { icon: GraduationCap, color: "#7c3aed", label: "Enrolled in" },
  lesson_complete: { icon: BookCheck, color: "#16a34a", label: "Completed a lesson in" },
  course_published: { icon: Rocket, color: "#ea580c", label: "Published" },
};

const PAGES: Record<string, string> = {
  "/learn": "Dashboard",
  "/learn/courses": "My courses",
  "/learn/browse": "Browse courses",
  "/learn/announcements": "Announcements",
  "/profile": "Profile",
  "/profile/activity": "Profile · Activity",
  "/profile/badges": "Profile · Badges",
  "/profile/certificates": "Profile · Certificates",
  "/profile/courses": "Profile · Courses",
  "/profile/notes": "Profile · Notes",
  "/learn/saved": "Saved",
  "/settings": "Settings",
  "/settings/account": "Settings · Account",
  "/settings/billing": "Settings · Billing",
  "/settings/notifications": "Settings · Notifications",
  "/settings/security": "Settings · Security",
  "/support": "Support",
  "/teach": "Teach",
};

// Turns a path into something readable: known pages by name, the rest from their first segments.
function pageName(path: string | null, course: string | null) {
  if (!path) return course ?? "a page";
  const clean = path.split("?")[0].replace(/\/$/, "") || "/";
  if (PAGES[clean]) return PAGES[clean];
  if (course) return course;
  if (clean.startsWith("/learn/announcements/")) return "An announcement";
  if (clean.startsWith("/support/")) return "A support chat";
  if (clean === "/") return "Home page";
  return clean;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const VISIT_GAP = 30 * 60_000;

type Page = { label: string; count: number };
type Visit = { kind: "visit"; id: number; start: string; end: string; views: number; pages: Page[] };
type Moment = { kind: "key"; id: number; type: string; course: string | null; at: string };

// Compact timeline: one row per day's visits (page views 30+ minutes apart start a new visit),
// with key moments (enrolled, lesson done) on their own line. A visit opens to show its pages.
export function UserTimeline({ events }: { events: Event[] }) {
  if (!events.length) return <p className="et-empty">No activity yet.</p>;

  const days: { key: string; rows: (Visit | Moment)[]; views: number; visits: number }[] = [];
  let lastViewAt = 0;
  for (const e of events) {
    const key = dayKey(e.created_at);
    let day = days.at(-1);
    if (day?.key !== key) {
      days.push((day = { key, rows: [], views: 0, visits: 0 }));
      lastViewAt = 0;
    }
    const at = Date.parse(e.created_at);
    if (e.type !== "page_view") {
      day.rows.push({ kind: "key", id: e.id, type: e.type, course: e.course?.title ?? null, at: e.created_at });
      continue;
    }
    day.views++;
    const last = day.rows.at(-1);
    let visit = last?.kind === "visit" && lastViewAt - at < VISIT_GAP ? last : null;
    if (!visit) {
      day.visits++;
      day.rows.push((visit = { kind: "visit", id: e.id, start: e.created_at, end: e.created_at, views: 0, pages: [] }));
    }
    lastViewAt = at;
    visit.start = e.created_at;
    visit.views++;
    // Events come newest first; keep pages in the order they were opened, merging repeats in a row.
    const label = pageName(e.path, e.course?.title ?? null);
    if (visit.pages[0]?.label === label) visit.pages[0].count++;
    else visit.pages.unshift({ label, count: 1 });
  }

  return (
    <div className="et-tl">
      {days.map((d) => (
        <section key={d.key}>
          <h3>
            {dayLabel(d.key)}
            {d.views > 0 && (
              <span>
                {d.visits === 1 ? "1 visit" : `${d.visits} visits`} · {d.views === 1 ? "1 page" : `${d.views} pages`}
              </span>
            )}
          </h3>
          <ul>
            {d.rows.map((r) => {
              if (r.kind === "key") {
                const key = KEY_EVENTS[r.type];
                const Icon = key?.icon ?? Zap;
                return (
                  <li key={r.id} className="et-tl-row">
                    <span className="et-tl-icon" style={{ background: key?.color ?? "#64748b" }}>
                      <Icon size={11} />
                    </span>
                    <span className="et-tl-text">
                      {key?.label ?? r.type.replace(/_/g, " ")} {r.course && <b>{r.course}</b>}
                    </span>
                    <time>{time(r.at)}</time>
                  </li>
                );
              }
              const distinct = [...new Set(r.pages.map((p) => p.label))];
              const range = time(r.start) === time(r.end) ? time(r.end) : `${time(r.start)} to ${time(r.end)}`;
              return (
                <li key={r.id}>
                  <details className="et-tl-visit">
                    <summary className="et-tl-row">
                      <span className="et-tl-dot" />
                      <span className="et-tl-text">
                        <b>{r.views === 1 ? "1 page" : `${r.views} pages`}</b> · {distinct.slice(0, 3).join(", ")}
                        {distinct.length > 3 && ` +${distinct.length - 3} more`}
                      </span>
                      <time>{range}</time>
                    </summary>
                    <ol>
                      {r.pages.map((p, i) => (
                        <li key={i}>
                          {p.label}
                          {p.count > 1 && <em>×{p.count}</em>}
                        </li>
                      ))}
                    </ol>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
