"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Rocket, X } from "lucide-react";
import { updateGuide } from "@/app/(app)/guide-actions";
import { startTour } from "@/lib/guide";
import type { ChecklistItem } from "@/lib/data/guide";

// Getting-started card on the learner dashboard. Steps tick themselves off; the card goes once they're all done
// or the learner closes it.
export function GettingStarted({ items }: { items: ChecklistItem[] }) {
  const [hidden, setHidden] = useState(false);
  const done = items.filter((i) => i.done).length;
  if (hidden || done === items.length) return null;
  const pct = Math.round((done / items.length) * 100);

  return (
    <section className="et-card et-gs">
      <div className="et-gs-head">
        <span className="et-gs-icon">
          <Rocket size={18} />
        </span>
        <div>
          <h2>Get started with Etivio</h2>
          <p>
            {done} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          className="et-icon-btn"
          aria-label="Hide getting started"
          onClick={() => {
            setHidden(true);
            updateGuide({ checklistHidden: true });
          }}
        >
          <X size={15} />
        </button>
      </div>
      <div className="et-gs-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ul>
        {items.map((i) => {
          const body = (
            <>
              <span className={`et-gs-check${i.done ? " is-done" : ""}`}>{i.done && <Check size={12} strokeWidth={3} />}</span>
              <span className="et-gs-text">
                <b>{i.label}</b>
                <small>{i.hint}</small>
              </span>
              {!i.done && <ChevronRight size={16} className="et-gs-go" />}
            </>
          );
          if (i.done) return <li key={i.key} className="is-done">{body}</li>;
          return (
            <li key={i.key}>
              {i.href ? (
                <Link href={i.href}>{body}</Link>
              ) : (
                <button type="button" onClick={startTour}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
