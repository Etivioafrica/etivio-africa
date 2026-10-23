import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarCheck, CalendarClock, Banknote, Users } from "lucide-react";
import { Stat, Status } from "@/components/dash/ui";
import { Avatar } from "@/components/dash/Avatar";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { adminCoaches, adminSessions } from "@/lib/data/coaching";
import { compactMoney, formatDateTime, formatMoney } from "@/lib/format";
import "@/components/coaching/coaching.css";
import { adminCancelSession, setCoachCommission, setCoachSuspended } from "./actions";

export const metadata = { title: "Coaching" };

const STATUS_LABEL: Record<string, string> = { draft: "Not published", live: "Live", paused: "Paused", suspended: "Suspended" };
const SESSION_LABEL: Record<string, string> = { confirmed: "Booked", completed: "Done", cancelled: "Cancelled", no_show: "No-show" };
const clock = () => Date.now();

export default function CoachingAdminPage() {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Coaching</h1>
          <p>Coaches, their sessions and Etivio&apos;s commission. Give someone the Coach role from Users (or approve their application), then they set up their page in Teach.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  const { db } = await requireAdmin("coaching");
  await connection();
  const [{ coaches, notStarted }, sessions, { data: settings }] = await Promise.all([adminCoaches(), adminSessions(), db.from("platform_settings").select("coach_commission_percent").maybeSingle()]);
  const now = clock();
  const upcoming = sessions.filter((s) => s.status === "confirmed" && Date.parse(s.ends_at) > now).length;
  const held = sessions.filter((s) => ["confirmed", "completed", "no_show"].includes(s.status) && Date.parse(s.ends_at) <= now);
  const value = sessions.filter((s) => s.status !== "cancelled").reduce((n, s) => n + s.price_minor, 0);
  const commission = Number(settings?.coach_commission_percent ?? 20);

  return (
    <>
      <div className="et-stats">
        <Stat label="Live coaches" value={coaches.filter((c) => c.status === "live").length} icon={Users} />
        <Stat label="Upcoming sessions" value={upcoming} icon={CalendarClock} />
        <Stat label="Sessions held" value={held.length} icon={CalendarCheck} />
        <Stat label="Booked value" value={compactMoney(value)} icon={Banknote} hint={`Etivio keeps ${commission}%`} />
      </div>

      <section className="et-card et-card-pad">
        <ActionForm action={setCoachCommission} toast className="et-cb-commission">
          <div className="et-field">
            <label htmlFor="cc-pct">Etivio&apos;s commission on coaching sessions (%)</label>
            <input id="cc-pct" name="percent" type="number" min={0} max={100} step="0.5" defaultValue={commission} />
            <small>Applies to new bookings. Coaches get the rest in Earnings once each session has happened.</small>
          </div>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Coaches</h2>
          <span className="et-muted">{coaches.length}</span>
        </div>
        {coaches.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>Price</th>
                  <th>Upcoming</th>
                  <th>Held</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coaches.map((c) => (
                  <tr key={c.user_id}>
                    <td>
                      <div className="et-cb-admin-who">
                        <Avatar src={c.avatar} initial={c.name.charAt(0).toUpperCase()} seed={c.name} className="et-cb-avatar is-sm" />
                        <div>
                          <b>
                            <Link href={`/admin/users/${c.user_id}`}>{c.name}</Link>
                          </b>
                          <small>
                            {c.headline ?? "No headline"} · <Link href={`/coaches/${c.slug}`}>Page</Link>
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="et-money">
                      {c.price_minor > 0 ? formatMoney(c.price_minor, c.currency) : "Free"} <small>/ {c.session_minutes} min</small>
                    </td>
                    <td>{c.upcoming}</td>
                    <td>{c.done}</td>
                    <td>
                      <Status value={c.status === "live" ? "published" : c.status === "suspended" ? "rejected" : "draft"} label={STATUS_LABEL[c.status]} />
                    </td>
                    <td className="et-td-right">
                      <ActionForm action={setCoachSuspended} toast className="et-cb-inline">
                        <input type="hidden" name="id" value={c.user_id} />
                        <input type="hidden" name="suspend" value={c.status === "suspended" ? "0" : "1"} />
                        <SubmitButton className={`et-btn et-btn-sm ${c.status === "suspended" ? "et-btn-ghost" : "et-btn-danger-text"}`} pendingLabel="…">
                          {c.status === "suspended" ? "Restore" : "Suspend"}
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-empty">No coach pages yet.</p>
        )}
        {notStarted.length > 0 && (
          <p className="et-cb-admin-note">
            Coach role but no page yet:{" "}
            {notStarted.map((n, i) => (
              <span key={n.userId}>
                {i > 0 && ", "}
                <Link href={`/admin/users/${n.userId}`}>{n.name}</Link>
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Sessions</h2>
          <span className="et-muted">Latest {sessions.length}</span>
        </div>
        {sessions.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Coach</th>
                  <th>Learner</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.starts_at)}</td>
                    <td>{s.coach?.profile?.full_name ?? "Coach"}</td>
                    <td>{s.learner?.full_name ?? "Learner"}</td>
                    <td className="et-money">{s.price_minor > 0 ? formatMoney(s.price_minor, s.currency) : "Free"}</td>
                    <td>
                      <Status value={s.status === "cancelled" ? "rejected" : s.status === "confirmed" && Date.parse(s.ends_at) > now ? "pending" : "approved"} label={SESSION_LABEL[s.status] ?? s.status} />
                    </td>
                    <td className="et-td-right">
                      {s.status === "confirmed" && Date.parse(s.starts_at) > now && (
                        <ActionForm action={adminCancelSession} toast className="et-cb-inline">
                          <input type="hidden" name="id" value={s.id} />
                          <SubmitButton className="et-btn et-btn-sm et-btn-danger-text" pendingLabel="…">
                            Cancel and refund
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-empty">No sessions booked yet.</p>
        )}
      </section>
    </>
  );
}
