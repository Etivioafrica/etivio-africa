"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, UserX, Video, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { confirmDialog, promptDialog } from "@/components/dash/dialogs";
import { useToast } from "@/components/dash/useToast";
import { cancelSession, markNoShow } from "@/app/(app)/teach/coaching/actions";
import { formatPrice } from "@/lib/format";
import type { SessionRow } from "@/lib/data/coaching";

const noop = () => () => {};
const clock = () => Date.now();
const STATUS: Record<SessionRow["status"], string> = { pending: "Pending", confirmed: "Booked", completed: "Done", cancelled: "Cancelled", no_show: "No-show" };

// Upcoming and past coaching sessions, for the learner (`as="learner"`) or the coach. Times are in the viewer's zone.
export function SessionList({ sessions, as, cancelHours }: { sessions: SessionRow[]; as: "learner" | "coach"; cancelHours: number }) {
  // False on the server, so times render in the viewer's own zone only.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const now = mounted ? clock() : 0;
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pending, start] = useTransition();
  const [toastNode, toast] = useToast();
  if (!now) return <div className="et-skel" style={{ height: 200 }} />;

  const upcoming = sessions.filter((s) => s.status === "confirmed" && Date.parse(s.endsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.filter((s) => !upcoming.includes(s));
  const list = tab === "upcoming" ? upcoming : past;

  const run = (fn: () => Promise<{ ok?: string; error?: string } | null>) =>
    start(async () => {
      const r = await fn();
      if (r) toast(r);
    });

  const cancel = async (s: SessionRow) => {
    const late = as === "learner" && Date.parse(s.startsAt) - now < cancelHours * 3_600_000;
    if (late) {
      await confirmDialog({ title: "Too late to cancel here", body: `Sessions can be cancelled up to ${cancelHours} hours before. Message your coach if something came up.`, confirmLabel: "OK" });
      return;
    }
    const reason = await promptDialog({
      title: "Cancel this session?",
      label: as === "coach" ? "Tell the learner why (they'll see this)" : "Reason (optional)",
      placeholder: as === "coach" ? "Something came up..." : "",
      confirmLabel: "Cancel session",
    });
    if (reason === null) return;
    run(() => cancelSession(s.id, reason));
  };

  const noShow = async (s: SessionRow) => {
    if (!(await confirmDialog({ title: "Mark as a no-show?", body: "Use this when the learner didn't join. You're still paid for the session.", confirmLabel: "Mark no-show" }))) return;
    run(() => markNoShow(s.id));
  };

  return (
    <section className="et-card">
      {toastNode}
      <div className="et-cb-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "upcoming"} className={tab === "upcoming" ? "is-on" : ""} onClick={() => setTab("upcoming")}>
          Upcoming <span>{upcoming.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "past"} className={tab === "past" ? "is-on" : ""} onClick={() => setTab("past")}>
          Past and cancelled <span>{past.length}</span>
        </button>
      </div>
      {!list.length ? (
        <div className="et-cb-empty">
          <CalendarDays size={22} />
          <p>{tab === "upcoming" ? (as === "learner" ? "No upcoming sessions." : "No upcoming sessions yet. Share your coach page to get booked.") : "Nothing here yet."}</p>
          {tab === "upcoming" && as === "learner" && (
            <Link href="/coaches" className="et-btn et-btn-primary et-btn-sm">
              Find a coach
            </Link>
          )}
        </div>
      ) : (
        <ul className="et-cb-sessions">
          {list.map((s) => {
            const start = new Date(s.startsAt);
            // The call room opens 15 minutes before the start.
            const live = s.status === "confirmed" && Date.parse(s.startsAt) - now < 15 * 60_000 && Date.parse(s.endsAt) + 30 * 60_000 > now;
            const isUpcoming = tab === "upcoming";
            return (
              <li key={s.id} className="et-cb-session">
                <div className="et-cb-date">
                  <small>{start.toLocaleDateString(undefined, { month: "short" })}</small>
                  <b>{start.getDate()}</b>
                  <small>{start.toLocaleDateString(undefined, { weekday: "short" })}</small>
                </div>
                <div className="et-cb-session-main">
                  <div className="et-cb-session-who">
                    <Avatar src={s.other.avatar} initial={s.other.name.charAt(0).toUpperCase()} seed={s.other.name} className="et-cb-avatar is-sm" />
                    <div>
                      <b>{as === "learner" && s.other.slug ? <Link href={`/coaches/${s.other.slug}`}>{s.other.name}</Link> : s.other.name}</b>
                      <small>
                        {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} to {new Date(s.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {s.priceMinor > 0 && ` · ${formatPrice(s.priceMinor, s.currency)}`}
                      </small>
                    </div>
                    <span className={`et-cb-status is-${s.status}`}>{STATUS[s.status]}</span>
                  </div>
                  {s.note && <p className="et-cb-session-note">{s.note}</p>}
                  {s.status === "cancelled" && s.cancelReason && <p className="et-cb-session-note">Reason: {s.cancelReason}</p>}
                  {isUpcoming && (
                    <div className="et-cb-actions">
                      {live ? (
                        <Link href={`/sessions/${s.id}`} className="et-btn et-btn-sm et-btn-primary">
                          <Video size={14} /> Join call
                        </Link>
                      ) : (
                        <Link href={`/sessions/${s.id}`} className="et-btn et-btn-sm et-btn-ghost">
                          <Video size={14} /> Call room
                        </Link>
                      )}
                      {as === "coach" && s.learnerJoinedAt && <span className="et-cb-muted">Learner joined</span>}
                      {as === "coach" && Date.parse(s.startsAt) < now && !s.learnerJoinedAt && (
                        <button className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => noShow(s)}>
                          <UserX size={14} /> No-show
                        </button>
                      )}
                      {Date.parse(s.startsAt) > now && (
                        <button className="et-btn et-btn-danger-text et-btn-sm" disabled={pending} onClick={() => cancel(s)}>
                          <X size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
