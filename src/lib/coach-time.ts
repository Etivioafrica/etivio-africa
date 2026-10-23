// Turning a coach's weekly hours (in their own timezone) into bookable start times. Shared by server and client.

export type Hours = { weekday: number; start_min: number; end_min: number };
export type Busy = { starts_at: string; ends_at: string };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Africa first, then the rest of the world people are likely to coach from.
export const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Kigali",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Casablanca",
  "Africa/Abidjan",
  "Africa/Dakar",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Dubai",
];

export const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// The wall-clock parts of an instant in a timezone.
function parts(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// How far the timezone is ahead of UTC at that instant, in ms.
function offset(ms: number, tz: string) {
  const p = parts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

// The instant when it is `minutes` past midnight on y-m-d in the timezone.
export function zonedInstant(y: number, m: number, d: number, minutes: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - offset(guess, tz);
  const second = guess - offset(first, tz);
  return second;
}

// "2026-10-23" for an instant, in the timezone.
export function zonedDate(ms: number, tz: string) {
  const p = parts(ms, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export const minutesLabel = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const parseMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || +m[1] > 24 || +m[2] > 59) return null;
  const total = +m[1] * 60 + +m[2];
  return total <= 1440 ? total : null;
};

// Every free start time (ISO) from `notice` hours from now up to `windowDays` ahead, grouped by the coach's date.
export function freeSlots({
  hours,
  daysOff,
  busy,
  minutes,
  tz,
  noticeHours,
  windowDays,
  now,
}: {
  hours: Hours[];
  daysOff: string[];
  busy: Busy[];
  minutes: number;
  tz: string;
  noticeHours: number;
  windowDays: number;
  now: number;
}) {
  const earliest = now + noticeHours * 3_600_000;
  const off = new Set(daysOff);
  const taken = busy.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);
  const out: { date: string; slots: string[] }[] = [];
  const start = parts(now, tz);
  for (let i = 0; i <= windowDays; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (off.has(date)) continue;
    const slots: string[] = [];
    for (const h of hours.filter((x) => x.weekday === day.getUTCDay()).sort((a, b) => a.start_min - b.start_min)) {
      for (let t = h.start_min; t + minutes <= h.end_min; t += minutes) {
        const s = zonedInstant(y, m, d, t, tz);
        const e = s + minutes * 60_000;
        if (s < earliest) continue;
        if (taken.some(([bs, be]) => s < be && bs < e)) continue;
        slots.push(new Date(s).toISOString());
      }
    }
    if (slots.length) out.push({ date, slots: [...new Set(slots)] });
  }
  return out;
}
