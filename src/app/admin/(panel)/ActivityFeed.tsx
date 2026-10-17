import Link from "next/link";
import { EVENT_LABELS, type FeedItem } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (!items.length) return <p className="et-empty">No activity yet.</p>;
  return (
    <ul className="et-feed">
      {items.map((e) => (
        <li key={e.id}>
          <span className="et-feed-dot" />
          <span>
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
      ))}
    </ul>
  );
}
