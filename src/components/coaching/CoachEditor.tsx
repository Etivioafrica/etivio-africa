"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Select } from "@/components/dash/Select";
import { useToast } from "@/components/dash/useToast";
import { saveCoachProfile, saveHours, setCoachStatus, toggleDayOff } from "@/app/(app)/teach/coaching/actions";
import { TIMEZONES, WEEKDAYS, minutesLabel, parseMinutes, type Hours } from "@/lib/coach-time";

export type CoachProfileValues = {
  headline: string | null;
  bio: string | null;
  topics: string[];
  session_minutes: number;
  price_minor: number;
  timezone: string;
  notice_hours: number;
  window_days: number;
  meeting_url: string | null;
} | null;

export function CoachProfileForm({ profile }: { profile: CoachProfileValues }) {
  const zones = profile && !TIMEZONES.includes(profile.timezone) ? [profile.timezone, ...TIMEZONES] : TIMEZONES;
  return (
    <ActionForm action={saveCoachProfile} toast>
      <div className="et-form-grid">
        <div className="et-field et-field-wide">
          <label htmlFor="cp-headline">Headline</label>
          <input id="cp-headline" name="headline" maxLength={120} required defaultValue={profile?.headline ?? ""} placeholder="Product designer helping you land your first design job" />
        </div>
        <div className="et-field et-field-wide">
          <label htmlFor="cp-bio">About you</label>
          <textarea id="cp-bio" name="bio" rows={6} maxLength={3000} defaultValue={profile?.bio ?? ""} placeholder="Your experience, who you help, and what a session with you looks like." />
        </div>
        <div className="et-field et-field-wide">
          <label htmlFor="cp-topics">Topics</label>
          <input id="cp-topics" name="topics" defaultValue={profile?.topics.join(", ") ?? ""} placeholder="Career advice, Portfolio review, UX design" />
          <small>Separate with commas. Up to 8. Learners filter coaches by these.</small>
        </div>
        <div className="et-field">
          <label htmlFor="cp-minutes">Session length</label>
          <Select id="cp-minutes" name="session_minutes" defaultValue={String(profile?.session_minutes ?? 60)}>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </Select>
        </div>
        <div className="et-field">
          <label htmlFor="cp-price">Price per session (₦)</label>
          <input id="cp-price" name="price" inputMode="numeric" defaultValue={profile ? String(profile.price_minor / 100) : ""} placeholder="15000" />
          <small>Etivio keeps a commission; the rest goes to your Earnings.</small>
        </div>
        <div className="et-field">
          <label htmlFor="cp-tz">Your time zone</label>
          <Select id="cp-tz" name="timezone" defaultValue={profile?.timezone ?? "Africa/Lagos"}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="et-field">
          <label htmlFor="cp-notice">Minimum notice</label>
          <Select id="cp-notice" name="notice_hours" defaultValue={String(profile?.notice_hours ?? 12)}>
            {[0, 2, 6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={String(h)}>
                {h === 0 ? "No notice" : `${h} hours`}
              </option>
            ))}
          </Select>
        </div>
        <div className="et-field">
          <label htmlFor="cp-window">Book up to</label>
          <Select id="cp-window" name="window_days" defaultValue={String(profile?.window_days ?? 30)}>
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={String(d)}>
                {d} days ahead
              </option>
            ))}
          </Select>
        </div>
        <div className="et-field">
          <label htmlFor="cp-meet">Your call link</label>
          <input id="cp-meet" name="meeting_url" type="url" defaultValue={profile?.meeting_url ?? ""} placeholder="https://meet.google.com/..." />
          <small>Added to every new booking. You can change it per session.</small>
        </div>
      </div>
      <div>
        <SubmitButton>{profile ? "Save profile" : "Create profile"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StatusControls({ status }: { status: string }) {
  const [pending, start] = useTransition();
  const [node, toast] = useToast();
  const go = (s: "live" | "paused" | "draft") =>
    start(async () => {
      const r = await setCoachStatus(s);
      if (r) toast(r);
    });
  return (
    <div className="et-cb-status-bar">
      {node}
      {status === "live" ? (
        <button className="et-btn et-btn-ghost" disabled={pending} onClick={() => go("paused")}>
          Pause bookings
        </button>
      ) : status !== "suspended" ? (
        <button className="et-btn et-btn-primary" disabled={pending} onClick={() => go("live")}>
          {status === "paused" ? "Resume bookings" : "Publish my page"}
        </button>
      ) : null}
    </div>
  );
}

type Row = { key: number; weekday: number; start: string; end: string };
let nextKey = 1;

// Weekly hours: any number of ranges per day, in the coach's time zone.
export function HoursEditor({ hours }: { hours: Hours[] }) {
  const [rows, setRows] = useState<Row[]>(() => hours.map((h) => ({ key: nextKey++, weekday: h.weekday, start: minutesLabel(h.start_min), end: minutesLabel(h.end_min) })));
  const json = JSON.stringify(
    rows
      .map((r) => ({ weekday: r.weekday, start_min: parseMinutes(r.start), end_min: parseMinutes(r.end === "00:00" ? "24:00" : r.end) }))
      .filter((r) => r.start_min !== null && r.end_min !== null),
  );
  const add = (weekday: number) => {
    const last = rows.filter((r) => r.weekday === weekday).at(-1);
    const startMin = last ? Math.min(parseMinutes(last.end) ?? 780, 1380) : 540;
    setRows([...rows, { key: nextKey++, weekday, start: minutesLabel(startMin), end: minutesLabel(Math.min(startMin + 180, 1440)) }]);
  };
  const copyWeekdays = () => {
    const monday = rows.filter((r) => r.weekday === 1);
    if (!monday.length) return;
    setRows([...rows.filter((r) => r.weekday === 0 || r.weekday === 1 || r.weekday === 6), ...[2, 3, 4, 5].flatMap((d) => monday.map((m) => ({ ...m, key: nextKey++, weekday: d })))]);
  };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ActionForm action={saveHours} toast>
      <input type="hidden" name="hours" value={json} />
      <ul className="et-cb-hours">
        {order.map((d) => {
          const day = rows.filter((r) => r.weekday === d);
          return (
            <li key={d}>
              <b>{WEEKDAYS[d]}</b>
              <div className="et-cb-ranges">
                {!day.length && <span className="et-cb-muted">Unavailable</span>}
                {day.map((r) => (
                  <div key={r.key} className="et-cb-range">
                    <input type="time" step={900} value={r.start} aria-label={`${WEEKDAYS[d]} start`} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, start: e.target.value } : x)))} />
                    <span>to</span>
                    <input type="time" step={900} value={r.end} aria-label={`${WEEKDAYS[d]} end`} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, end: e.target.value } : x)))} />
                    <button type="button" className="et-icon-btn" aria-label="Remove" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="et-icon-btn" aria-label={`Add time on ${WEEKDAYS[d]}`} onClick={() => add(d)}>
                <Plus size={15} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="et-cb-hours-foot">
        <SubmitButton>Save hours</SubmitButton>
        <button type="button" className="et-btn et-btn-ghost" onClick={copyWeekdays} disabled={!rows.some((r) => r.weekday === 1)}>
          Copy Monday to Tuesday-Friday
        </button>
      </div>
    </ActionForm>
  );
}

export function DaysOff({ days }: { days: string[] }) {
  const [day, setDay] = useState("");
  const [pending, start] = useTransition();
  const [node, toast] = useToast();
  const run = (d: string, off: boolean) =>
    start(async () => {
      const r = await toggleDayOff(d, off);
      if (r) toast(r);
      if (off && !r?.error) setDay("");
    });
  return (
    <div className="et-cb-off">
      {node}
      <div className="et-cb-off-add">
        <input type="date" className="et-input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day off" />
        <button className="et-btn et-btn-ghost" disabled={!day || pending} onClick={() => run(day, true)}>
          Add day off
        </button>
      </div>
      {days.length ? (
        <ul className="et-cb-off-list">
          {days.map((d) => (
            <li key={d}>
              {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              <button className="et-icon-btn" aria-label="Remove day off" disabled={pending} onClick={() => run(d, false)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="et-cb-muted">No days off coming up.</p>
      )}
    </div>
  );
}
