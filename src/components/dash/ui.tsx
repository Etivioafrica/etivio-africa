import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BookOpen, type LucideIcon } from "lucide-react";

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

// One stat card: outlined icon, label, number and an optional hint line (the admin dashboard style, used everywhere).
export function Stat({ label, value, icon: Icon, href, hint }: { label: string; value: React.ReactNode; icon: LucideIcon; href?: string; hint?: React.ReactNode }) {
  const body = (
    <>
      <span className="et-statstrip-icon">
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint && <small className="et-statstrip-hint">{hint}</small>}
    </>
  );
  return href ? (
    <Link href={href} className="et-card et-statcard et-statstrip-link">
      {body}
    </Link>
  ) : (
    <div className="et-card et-statcard">{body}</div>
  );
}

// A Stat with its change against the previous period next to the number. `delta` is a percent change (or points,
// with unit "pts"); `invert` is for numbers where going down is good, like bounce rate.
export function Kpi({ label, value, icon, delta, unit = "%", invert, compare }: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  delta?: number | null;
  unit?: "%" | "pts";
  invert?: boolean;
  compare?: string;
}) {
  const shown = delta == null || !Number.isFinite(delta) ? null : Math.round(delta);
  const tone = shown == null || shown === 0 ? "flat" : (shown > 0) !== Boolean(invert) ? "up" : "down";
  return (
    <Stat
      label={label}
      icon={icon}
      value={
        <span className="et-kpi-mid">
          {value}
          {shown != null && (
            <span className={`et-kpi-delta is-${tone}`}>
              {shown > 0 ? <ArrowUpRight size={12} strokeWidth={2.4} /> : shown < 0 ? <ArrowDownRight size={12} strokeWidth={2.4} /> : null}
              {Math.abs(shown)}
              {unit === "%" ? "%" : " pts"}
            </span>
          )}
        </span>
      }
      // "vs previous period" only makes sense next to a badge; plain descriptions (no delta prop) always show.
      hint={compare && (delta === undefined || shown != null) ? compare : undefined}
    />
  );
}

// Percent change from `prev` to `cur`; null when there's nothing to compare against.
export const change = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

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
  rejected: "red",
  approved: "green",
  verified: "green",
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

// Slim stats row: separate light cards, a finer alternative to the big Stat cards.
export function StatStrip({ items }: { items: { label: string; value: number | string; icon: LucideIcon; href?: string; hint?: string }[] }) {
  return (
    <section className="et-statstrip">
      {items.map(({ label, value, icon: Icon, href, hint }) => {
        const body = (
          <>
            <span className="et-statstrip-icon">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <p>{label}</p>
            <strong>{value}</strong>
            {hint && <small className="et-statstrip-hint">{hint}</small>}
          </>
        );
        return href ? (
          <Link key={label} href={href} className="et-card et-statstrip-link">
            {body}
          </Link>
        ) : (
          <div key={label} className="et-card">
            {body}
          </div>
        );
      })}
    </section>
  );
}

// Compact empty state for cards: small icon, one line of guidance, optional small button.
export function EmptyMini({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="et-empty-mini">
      <span className="et-empty-mini-icon">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action && (
        <Link href={action.href} className="et-btn et-btn-ghost et-btn-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}

// Circular progress ring with a value in the middle.
export function Ring({ value, max, size = 84, children }: { value: number; max: number; size?: number; children?: React.ReactNode }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  return (
    <div className="et-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--a-border)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={pct >= 1 ? "#16a34a" : "var(--accent)"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}
