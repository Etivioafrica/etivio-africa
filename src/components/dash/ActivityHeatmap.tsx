"use client";
import { Flame, Trophy } from "lucide-react";
import type { Heatmap } from "@/lib/activity";

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

const label = (count: number, date: string) => {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${count ? `${count} lesson${count === 1 ? "" : "s"}` : "No lessons"} on ${day}`;
};

// GitHub-style grid of lessons completed per day over the last year.
export function ActivityHeatmap({ data, title = "Learning activity" }: { data: Heatmap; title?: string }) {
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>{title}</h2>
        <span className="et-muted" style={{ fontSize: 12.5 }}>
          {data.total} lesson{data.total === 1 ? "" : "s"} in the last year
        </span>
      </div>
      <div className="et-card-pad">
        {/* Scrolled to the newest week on narrow screens. */}
        <div className="et-hm-scroll" ref={(el) => void (el && (el.scrollLeft = el.scrollWidth))}>
          <div className="et-hm" style={{ ["--weeks" as string]: data.weeks.length }}>
            <div className="et-hm-months" aria-hidden="true">
              {data.months.map((m) => (
                <span key={`${m.label}-${m.week}`} style={{ gridColumn: m.week + 1 }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="et-hm-days" aria-hidden="true">
              {DAYS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="et-hm-grid" role="img" aria-label={`${data.total} lessons completed over ${data.activeDays} days in the last year`}>
              {data.weeks.map((week) =>
                week.map((c) =>
                  c.future ? (
                    <span key={c.date} className="et-hm-cell is-future" />
                  ) : (
                    <span key={c.date} className={`et-hm-cell l${c.level}`} data-tip={label(c.count, c.date)} title={label(c.count, c.date)} />
                  ),
                ),
              )}
            </div>
          </div>
        </div>
        <div className="et-hm-foot">
          <div className="et-hm-streaks">
            <span>
              <Flame size={14} />
              <b>{data.currentStreak}</b> day streak
            </span>
            <span>
              <Trophy size={14} />
              <b>{data.longestStreak}</b> longest
            </span>
            <span>
              <b>{data.activeDays}</b> active day{data.activeDays === 1 ? "" : "s"}
            </span>
          </div>
          <div className="et-hm-legend" aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className={`et-hm-cell l${l}`} />
            ))}
            More
          </div>
        </div>
      </div>
    </section>
  );
}
