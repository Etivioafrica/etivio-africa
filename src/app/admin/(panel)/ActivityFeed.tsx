import Link from "next/link";
import { BookCheck, Eye, GraduationCap, Rocket, UserPlus, Zap, type LucideIcon } from "lucide-react";
import { EVENT_LABELS, type FeedItem } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";

// One icon (with its own solid colour) per kind of event, so the feed scans at a glance.
const EVENT_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  signup: { icon: UserPlus, color: "#2563eb" },
  enroll: { icon: GraduationCap, color: "#7c3aed" },
  lesson_complete: { icon: BookCheck, color: "#16a34a" },
  course_published: { icon: Rocket, color: "#ea580c" },
  page_view: { icon: Eye, color: "#64748b" },
};

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (!items.length) return <p className="et-empty">No activity yet.</p>;
  return (
    <ul className="et-feed et-activity">
      {items.map((e) => {
        const { icon: Icon, color } = EVENT_ICONS[e.type] ?? { icon: Zap, color: "#64748b" };
        return (
          <li key={e.id}>
            <span className="et-activity-icon" style={{ background: color }}>
              <Icon size={14} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {e.userId ? (
                <Link href={`/admin/users/${e.userId}`}>
                  <b>{e.who}</b>
                </Link>
              ) : (
                <b>{e.who}</b>
              )}{" "}
              {EVENT_LABELS[e.type] ?? e.type.replace(/_/g, " ")} {e.course ? <b>{e.course}</b> : e.path ? <b>{e.path}</b> : null}
            </span>
            <time>{formatDateTime(e.at)}</time>
          </li>
        );
      })}
    </ul>
  );
}
