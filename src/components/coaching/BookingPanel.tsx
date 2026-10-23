"use client";
import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Wallet } from "lucide-react";
import { bookSession, type BookState } from "@/app/(public)/coaches/actions";
import { formatPrice } from "@/lib/format";

const noop = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Pick a day, pick a time (shown in the visitor's own timezone), say what you want to cover, then pay.
export function BookingPanel({
  slug,
  slots,
  minutes,
  priceMinor,
  currency,
  signedIn,
  walletMinor,
  isSelf,
}: {
  slug: string;
  slots: string[];
  minutes: number;
  priceMinor: number;
  currency: string;
  signedIn: boolean;
  walletMinor: number;
  isSelf: boolean;
}) {
  // Null on the server, so times only render once we know the visitor's timezone.
  const zone = useSyncExternalStore(noop, browserZone, () => null);
  const days = useMemo(() => {
    if (!zone) return [];
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    const map = new Map<string, string[]>();
    for (const s of slots) {
      const k = key.format(new Date(s));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].map(([date, times]) => ({ date, times }));
  }, [slots, zone]);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [state, action, pending] = useActionState<BookState, FormData>(bookSession, null);
  const current = days.find((d) => d.date === day) ?? days[0];
  const canWallet = priceMinor > 0 && walletMinor >= priceMinor;

  const dayLabel = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    return { week: d.toLocaleDateString(undefined, { weekday: "short" }), num: d.getDate(), month: d.toLocaleDateString(undefined, { month: "short" }) };
  };
  const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { timeZone: zone ?? undefined, hour: "numeric", minute: "2-digit" });

  return (
    <aside className="et-card et-cb-book">
      <div className="et-cb-book-head">
        <b>{priceMinor > 0 ? formatPrice(priceMinor, currency) : "Free"}</b>
        <span>
          <Clock size={14} /> {minutes} min session
        </span>
      </div>

      {!zone ? (
        <div className="et-skel" style={{ height: 180 }} />
      ) : !days.length ? (
        <p className="et-cb-none">
          <CalendarDays size={18} /> No free times right now. Check back soon.
        </p>
      ) : (
        <form action={action} className="et-cb-form">
          <input type="hidden" name="slug" value={slug} />
          {time && <input type="hidden" name="starts_at" value={time} />}
          <p className="et-cb-label">Pick a day</p>
          <div className="et-cb-days" role="listbox" aria-label="Days">
            {days.map((d) => {
              const l = dayLabel(d.date);
              const on = d.date === current?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`et-cb-day${on ? " is-on" : ""}`}
                  onClick={() => {
                    setDay(d.date);
                    setTime(null);
                  }}
                >
                  <small>{l.week}</small>
                  <b>{l.num}</b>
                  <small>{l.month}</small>
                </button>
              );
            })}
          </div>
          <p className="et-cb-label">Pick a time</p>
          <div className="et-cb-times">
            {current?.times.map((t) => (
              <button key={t} type="button" className={`et-cb-time${t === time ? " is-on" : ""}`} onClick={() => setTime(t)}>
                {timeLabel(t)}
              </button>
            ))}
          </div>
          <p className="et-cb-zone">Times are in your time zone ({zone.replace("_", " ")}).</p>

          {isSelf ? (
            <p className="et-cb-note">This is how learners see your page.</p>
          ) : !signedIn ? (
            <Link href={`/login?next=${encodeURIComponent(`/coaches/${slug}`)}`} className="et-btn et-btn-primary et-cb-submit">
              Sign in to book
            </Link>
          ) : (
            <>
              <label className="et-cb-label" htmlFor="cb-note">
                What would you like to cover? <small>(optional)</small>
              </label>
              <textarea id="cb-note" name="note" rows={3} maxLength={1000} placeholder="Your goals, questions, or where you're stuck" />
              {canWallet && (
                <label className="et-cb-wallet">
                  <input type="checkbox" name="wallet" value="1" defaultChecked />
                  <Wallet size={15} /> Pay from my wallet ({formatPrice(walletMinor, currency)})
                </label>
              )}
              <button type="submit" className="et-btn et-btn-primary et-cb-submit" disabled={!time || pending}>
                {pending ? "Booking…" : !time ? "Pick a time" : priceMinor > 0 ? `Book for ${formatPrice(priceMinor, currency)}` : "Book session"}
              </button>
              {state?.error && <p className="et-cb-error">{state.error}</p>}
              <p className="et-cb-small">Cancel up to 24 hours before for a full refund to your Etivio wallet.</p>
            </>
          )}
        </form>
      )}
    </aside>
  );
}
