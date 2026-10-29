"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, ListChecks, Lock, PanelRightClose, PanelRightOpen, PlayCircle, Star, Trophy } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { ShareButton } from "@/components/dash/ShareButton";
import { setLessonDone } from "@/app/(app)/learn/actions";
import { formatDuration } from "@/lib/format";

export type OutlineItem = { id: string; title: string; href: string; kind: "video" | "reading" | "quiz"; done: boolean; locked: boolean; seconds?: number | null; note?: string };
export type OutlineModule = { id: string; title: string; locked: boolean; items: OutlineItem[] };
export type PlayerTab = { id: string; label: string; content: React.ReactNode };
type Step = { href: string; label: string } | null;

// Full-screen course player, laid out like Udemy's: a dark top bar, the video stage, tabs underneath, and the
// course content down the right. On phones the course content becomes the first tab.
export function PlayerFrame({
  course,
  outline,
  activeId,
  progress,
  steps,
  prev = null,
  next = null,
  stage,
  bar,
  tabs,
  canRate = false,
  children,
}: {
  course: { id: string; title: string; slug: string };
  outline: OutlineModule[];
  activeId: string | null;
  progress: number;
  steps: { done: number; total: number };
  prev?: Step;
  next?: Step;
  stage?: React.ReactNode;
  bar?: React.ReactNode;
  tabs?: PlayerTab[];
  canRate?: boolean;
  children?: React.ReactNode;
}) {
  const { light } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const allTabs: PlayerTab[] = tabs ? [{ id: "content", label: "Course content", content: <Outline outline={outline} activeId={activeId} /> }, ...tabs] : [];
  const [tab, setTab] = useState(tabs?.[0]?.id ?? "content");
  const [tabFor, setTabFor] = useState(activeId);
  // A new lesson opens on its overview, except when browsing the outline on a phone.
  if (tabFor !== activeId) {
    setTabFor(activeId);
    if (tab !== "content") setTab(tabs?.[0]?.id ?? "content");
  }

  return (
    <div className={`et-app et-pl${light ? " is-light" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <header className="et-pl-top">
        <Link href="/learn" className="et-pl-logo" aria-label="Back to your dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" />
        </Link>
        <span className="et-pl-divider" />
        <Link href={`/learn/browse/${course.id}`} className="et-pl-course">
          {course.title}
        </Link>
        <div className="et-pl-actions">
          {canRate && tabs?.some((t) => t.id === "reviews") && (
            <button type="button" className="et-pl-link" onClick={() => setTab("reviews")}>
              <Star size={15} /> Leave a rating
            </button>
          )}
          <ProgressMenu progress={progress} steps={steps} />
          <ShareButton title={course.title} path={`/courses/${course.slug}`} className="et-pl-share" />
        </div>
      </header>

      <div className="et-pl-body">
        <main className="et-pl-main">
          {stage && (
            <div className="et-pl-stage">
              {stage}
              {prev && (
                <Link href={prev.href} className="et-pl-arrow is-prev" aria-label={prev.label} title={prev.label}>
                  <ChevronLeft size={22} />
                </Link>
              )}
              {next && (
                <Link href={next.href} className="et-pl-arrow is-next" aria-label={next.label} title={next.label}>
                  <ChevronRight size={22} />
                </Link>
              )}
            </div>
          )}
          {bar}
          {collapsed && (
            <button type="button" className="et-pl-reopen" onClick={() => setCollapsed(false)}>
              <PanelRightOpen size={16} /> Course content
            </button>
          )}
          {tabs ? (
            <>
              <nav className="et-pl-tabs" role="tablist" aria-label="Lesson">
                {allTabs.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`${tab === t.id ? "is-active" : ""}${t.id === "content" ? " et-pl-tab-content" : ""}`} onClick={() => setTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </nav>
              {allTabs.map((t) => (
                <section key={t.id} role="tabpanel" hidden={tab !== t.id} className={`et-pl-panel${t.id === "content" ? " et-pl-panel-content" : ""}`}>
                  {t.content}
                </section>
              ))}
            </>
          ) : (
            <div className="et-pl-panel">{children}</div>
          )}
        </main>

        <aside className="et-pl-side" aria-label="Course content">
          <div className="et-pl-side-head">
            <b>Course content</b>
            <button type="button" className="et-icon-btn" onClick={() => setCollapsed(true)} aria-label="Hide course content" title="Hide course content">
              <PanelRightClose size={17} />
            </button>
          </div>
          <Outline outline={outline} activeId={activeId} />
        </aside>
      </div>
    </div>
  );
}

function ProgressMenu({ progress, steps }: { progress: number; steps: { done: number; total: number } }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <details className="et-pl-progress" data-menu>
      <summary>
        <span className="et-pl-ring">
          <svg viewBox="0 0 36 36" aria-hidden="true" className="et-pl-ring-svg">
            <circle cx="18" cy="18" r={r} className="et-pl-ring-track" />
            <circle cx="18" cy="18" r={r} className="et-pl-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - progress / 100)} />
          </svg>
          <Trophy size={14} />
        </span>
        <span className="et-pl-progress-label">Your progress</span>
        <ChevronDown size={15} />
      </summary>
      <div className="et-pl-pop">
        <b>
          {steps.done} of {steps.total} complete.
        </b>
        <p>{progress >= 100 ? "You've finished the course. Your certificate is on your profile." : "Finish the course to get your certificate."}</p>
      </div>
    </details>
  );
}

// Sections that fold open, each with a done count and total length; tick boxes mark lessons complete.
function Outline({ outline, activeId }: { outline: OutlineModule[]; activeId: string | null }) {
  let n = 0;
  return (
    <div className="et-pl-outline">
      {outline.map((m, i) => {
        const lessons = m.items.filter((it) => it.kind !== "quiz");
        const seconds = lessons.reduce((s, it) => s + (it.seconds ?? 0), 0);
        const done = m.items.filter((it) => it.done).length;
        return (
          <details key={m.id} open={m.items.some((it) => it.id === activeId) || (i === 0 && !activeId)} className="et-pl-section">
            <summary>
              <span>
                <b>
                  {m.locked && <Lock size={13} />} Section {i + 1}: {m.title}
                </b>
                <small>
                  {done} / {m.items.length}
                  {seconds > 0 ? ` | ${formatDuration(seconds)}` : ""}
                </small>
              </span>
              <ChevronDown size={18} className="et-pl-chev" />
            </summary>
            <ul>
              {m.items.map((it) => {
                const num = it.kind === "quiz" ? null : ++n;
                return <OutlineRow key={it.id} item={it} num={num} active={it.id === activeId} />;
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function OutlineRow({ item: it, num, active }: { item: OutlineItem; num: number | null; active: boolean }) {
  const Icon = it.kind === "quiz" ? ListChecks : it.kind === "reading" ? FileText : PlayCircle;
  const label = (
    <>
      <span className="et-pl-row-title">
        {num !== null ? `${num}. ` : ""}
        {it.title}
      </span>
      <small>
        <Icon size={13} />
        {it.kind === "quiz" ? it.note : it.seconds ? formatDuration(it.seconds) : it.kind === "reading" ? "Reading" : "Video"}
      </small>
    </>
  );
  return (
    <li className={`et-pl-row${active ? " is-active" : ""}${it.locked ? " is-locked" : ""}`}>
      {it.kind === "quiz" || it.locked ? (
        <span className={`et-pl-box${it.done ? " is-done" : ""}`} aria-hidden="true">
          {it.locked ? <Lock size={10} /> : null}
        </span>
      ) : (
        <CompleteBox lessonId={it.id} done={it.done} title={it.title} />
      )}
      {it.locked ? (
        <span className="et-pl-row-link" title="Pass the previous section's quiz to unlock">
          {label}
        </span>
      ) : (
        <Link href={it.href} className="et-pl-row-link" aria-current={active ? "page" : undefined}>
          {label}
        </Link>
      )}
    </li>
  );
}

// Ticks instantly, then saves; the page refreshes with the new progress.
function CompleteBox({ lessonId, done, title }: { lessonId: string; done: boolean; title: string }) {
  const [checked, setChecked] = useState(done);
  const [saved, setSaved] = useState(done);
  // Follow the server once it has saved.
  if (saved !== done) {
    setSaved(done);
    setChecked(done);
  }
  return (
    <form action={setLessonDone} className="et-pl-box-form">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="done" value={checked ? "0" : "1"} />
      <button type="submit" className={`et-pl-box${checked ? " is-done" : ""}`} aria-pressed={checked} aria-label={checked ? `Mark "${title}" as not done` : `Mark "${title}" complete`} onClick={() => setChecked(!checked)} />
    </form>
  );
}

// Applies the viewer's light or dark theme to things rendered outside the frame (like the badge pop-up).
export function ThemeScope({ children }: { children: React.ReactNode }) {
  const { light } = useTheme();
  return <div className={`et-app et-theme-scope${light ? " is-light" : ""}`}>{children}</div>;
}
