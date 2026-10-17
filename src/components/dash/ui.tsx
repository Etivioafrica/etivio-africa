import Link from "next/link";
import { BookOpen, type LucideIcon } from "lucide-react";

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="et-page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, href }: { label: string; value: number | string; icon: LucideIcon; href?: string }) {
  const body = (
    <>
      <span className="et-stat-icon">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="et-card et-stat">
      {body}
    </Link>
  ) : (
    <div className="et-card et-stat">{body}</div>
  );
}

export function Cover({ url, level, small }: { url: string | null; level?: string; small?: boolean }) {
  return (
    <div className={small ? "et-list-thumb" : "et-cover"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : <BookOpen size={small ? 16 : 28} strokeWidth={1.6} />}
      {level && !small && <span className="et-cover-level">{level}</span>}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="et-progress-row">
      <div className="et-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${value}%` }} />
      </div>
      <span>{label ?? `${value}%`}</span>
    </div>
  );
}

const statusColor: Record<string, string> = {
  published: "green",
  draft: "amber",
  archived: "grey",
  completed: "green",
  "in progress": "blue",
  open: "blue",
  pending: "amber",
  closed: "grey",
  success: "green",
  failed: "red",
  refunded: "violet",
  paid: "green",
  cancelled: "grey",
  active: "green",
  suspended: "red",
  public: "green",
  enrolled: "blue",
  private: "grey",
  student: "grey",
  instructor: "blue",
  admin: "violet",
  "super admin": "amber",
  replied: "green",
};

export function Status({ value }: { value: string }) {
  const label = value.replace("_", " ");
  return <span className={`et-status et-status-${statusColor[label] ?? "grey"}`}>{label}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="et-empty et-empty-lg">
      <h3>{title}</h3>
      {children}
      {action && (
        <div>
          <Link href={action.href} className="et-btn et-btn-primary">
            {action.label}
          </Link>
        </div>
      )}
    </div>
  );
}
