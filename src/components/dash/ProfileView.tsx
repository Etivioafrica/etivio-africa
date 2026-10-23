import Link from "next/link";
import { Activity, BookCheck, CalendarDays, CheckCircle2, Clock, Compass, Globe, Library, MapPin, PartyPopper } from "lucide-react";
import { Cover, EmptyMini, Progress, StatStrip, Status } from "@/components/dash/ui";
import type { LearnerProfile, ProfileActivity, ProfileCourse, ProfileDetails } from "@/lib/data/profile";
import { ActivityHeatmap } from "@/components/dash/ActivityHeatmap";
import { ProfileCompleteness, SkillsCard, WeeklyGoal, profileSteps } from "@/components/dash/ProfileCards";
import { Badges } from "@/components/dash/Badges";
import { allBadges, nextBadge } from "@/lib/badges";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { Avatar } from "@/components/dash/Avatar";

export function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z" />
    </svg>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Banner, avatar, name, bio, interests, and links. Used by /profile, a tutor's student view, and public /@username pages.
export function ProfileHero({ profile: p, actions, badges, skills = [] }: { profile: ProfileDetails; actions?: React.ReactNode; badges?: React.ReactNode; skills?: string[] }) {
  const initial = p.name.charAt(0).toUpperCase();
  const links = [
    p.websiteUrl && { href: p.websiteUrl, label: host(p.websiteUrl), icon: <Globe size={14} /> },
    p.linkedinUrl && { href: p.linkedinUrl, label: "LinkedIn", icon: <LinkedInIcon /> },
    p.xUrl && { href: p.xUrl, label: "X", icon: <XIcon /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <section className="et-card et-pf-hero">
      <div className={`et-pf-cover${p.coverUrl ? " has-img" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.coverUrl && <img src={p.coverUrl} alt="" />}
      </div>
      <div className="et-pf-main">
                <Avatar src={p.avatarUrl} initial={initial} seed={p.name} className="et-avatar et-pf-avatar" />
        <div className="et-pf-id">
          <h1>{p.name}</h1>
          {p.headline && <p className="et-pf-headline">{p.headline}</p>}
          <ul className="et-pf-meta">
            {p.username && <li>@{p.username}</li>}
            {p.location && (
              <li>
                <MapPin size={13} />
                {p.location}
              </li>
            )}
            <li>
              <CalendarDays size={13} />
              Joined {formatDate(p.joinedAt)}
            </li>
          </ul>
        </div>
        {actions && <div className="et-pf-actions">{actions}</div>}
      </div>
      {(p.bio || links.length > 0 || p.interests.length > 0 || skills.length > 0 || badges) && (
        <div className={`et-pf-about${badges ? " has-badges" : ""}`}>
          <div className="et-pf-about-main">
            {p.bio && <p className="et-pf-bio">{p.bio}</p>}
            {skills.length > 0 && (
              <div className="et-pf-skills">
                <span>Skills</span>
                {skills.map((s) => (
                  <span key={s} className="et-skill">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {p.interests.length > 0 && (
              <div className="et-pf-tags">
                {p.interests.map((t) => (
                  <span key={t} className="et-tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div className="et-pf-links">
                {links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer nofollow">
                    {l.icon}
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {badges}
        </div>
      )}
    </section>
  );
}

// Badge panel for the hero: latest recorded badge (or the best one earned), or the first one to aim for.
export function profileBadges(data: LearnerProfile, own?: boolean) {
  const input = { joinedAt: data.profile.joinedAt, lessonsDone: data.stats.lessonsDone, coursesCompleted: data.stats.completed, longestStreak: data.heatmap.longestStreak };
  const all = allBadges(input);
  const earned = all.filter((b) => b.earned);
  const latest = data.badges[0];
  const featured = (latest && all.find((b) => b.badge.id === latest.id)) || earned[0] || (own ? nextBadge(input) : null);
  if (!featured) return undefined;
  return (
    <Badges
      featured={featured}
      earnedAt={latest?.id === featured.badge.id ? latest.earnedAt : undefined}
      earned={earned.length}
      total={own ? all.length : undefined}
      viewAllHref={own ? "/profile/badges" : undefined}
    />
  );
}

type CourseHref = (courseId: string) => string;

export function ProfileStats({ data }: { data: LearnerProfile }) {
  const { stats } = data;
  return (
    <StatStrip
      items={[
        { label: "Courses", value: stats.enrolled, icon: Library },
        { label: "Completed", value: stats.completed, icon: CheckCircle2 },
        { label: "Lessons done", value: stats.lessonsDone, icon: BookCheck },
        { label: "Learning time", value: formatDuration(stats.secondsLearned) || "0 min", icon: Clock },
      ]}
    />
  );
}

// `courseHref` decides where rows link (the player for your own profile, nowhere for a tutor's view).
function CourseList({ title, courses, courseHref, empty, meta }: { title: string; courses: ProfileCourse[]; courseHref?: CourseHref; empty: React.ReactNode; meta?: string }) {
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>{title}</h2>
        {meta && (
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            {meta}
          </span>
        )}
      </div>
      {courses.length ? (
        <div className="et-list">
          {courses.map((c) => {
            const body = (
              <>
                <Cover url={c.coverUrl} small />
                <div className="et-list-main">
                  <b>{c.title}</b>
                  <Progress value={c.progress} label={`${c.done}/${c.total}`} />
                </div>
                <span className="et-hide-sm">
                  <Status value={c.completed ? "completed" : "in progress"} />
                </span>
              </>
            );
            return courseHref ? (
              <Link key={c.id} href={courseHref(c.id)} className="et-list-item">
                {body}
              </Link>
            ) : (
              <div key={c.id} className="et-list-item">
                {body}
              </div>
            );
          })}
        </div>
      ) : (
        empty
      )}
    </section>
  );
}

// Completed lessons, newest first. `grouped` splits them under a heading per day.
function ActivityFeed({ items, title, limit, grouped, moreHref }: { items: ProfileActivity[]; title: string; limit?: number; grouped?: boolean; moreHref?: string }) {
  const shown = limit ? items.slice(0, limit) : items;
  const days = new Map<string, ProfileActivity[]>();
  for (const r of shown) {
    const day = formatDate(r.at);
    days.set(day, [...(days.get(day) ?? []), r]);
  }
  const row = (r: ProfileActivity) => (
    <li key={`${r.lessonId}-${r.at}`}>
      <span className="et-feed-dot" />
      <span style={{ flex: 1, minWidth: 0 }}>
        Completed <b style={{ color: "var(--a-fg)" }}>{r.lessonTitle}</b>
        <br />
        <small className="et-muted">
          {r.courseTitle} · {grouped ? new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : formatDateTime(r.at)}
        </small>
      </span>
    </li>
  );
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>{title}</h2>
        {moreHref && items.length > 0 && <Link href={moreHref}>View all</Link>}
      </div>
      {!shown.length ? (
        <EmptyMini icon={Activity} title="No activity yet">
          Lessons you complete show up here.
        </EmptyMini>
      ) : grouped ? (
        [...days].map(([day, rows]) => (
          <div key={day}>
            <p className="et-feed-day">{day}</p>
            <ul className="et-feed">{rows.map(row)}</ul>
          </div>
        ))
      ) : (
        <ul className="et-feed">{shown.map(row)}</ul>
      )}
    </section>
  );
}

// The course to pick up next: most recently active one that isn't finished.
function ContinueLearning({ data, courseHref }: { data: LearnerProfile; courseHref: CourseHref }) {
  const current = data.courses.find((c) => !c.completed);
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Continue learning</h2>
        {data.courses.length > 0 && <Link href="/profile/courses">All courses</Link>}
      </div>
      {current ? (
        <div className="et-continue">
          <Cover url={current.coverUrl} level={current.level} />
          <div className="et-continue-body">
            <small>{current.instructor}</small>
            <h3>{current.title}</h3>
            <Progress value={current.progress} label={`${current.done} of ${current.total} lessons`} />
            <div>
              <Link href={courseHref(current.id)} className="et-btn et-btn-primary">
                {current.done ? "Resume course" : "Start course"}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <EmptyMini
          icon={data.courses.length ? PartyPopper : Compass}
          title={data.courses.length ? "You're all caught up" : "Start your first course"}
          action={{ href: "/learn/browse", label: "Browse courses" }}
        >
          {data.courses.length ? "Every course you're enrolled in is complete. Pick your next one." : "Pick a course and your progress shows up here."}
        </EmptyMini>
      )}
    </section>
  );
}

// Profile tabs: Overview, Courses, Activity. Badges has its own page.
export function ProfileOverview({ data, courseHref }: { data: LearnerProfile; courseHref: CourseHref }) {
  const setupLeft = profileSteps(data).some((s) => !s.done);
  return (
    <>
      <ProfileStats data={data} />
      <div className="et-grid-2 is-stretch">
        <WeeklyGoal data={data} />
        {setupLeft ? <ProfileCompleteness data={data} /> : <SkillsCard skills={data.skills} />}
      </div>
      <div className="et-grid-main is-stretch">
        <ContinueLearning data={data} courseHref={courseHref} />
        <ActivityFeed items={data.recent} title="Recent activity" limit={5} moreHref="/profile/activity" />
      </div>
    </>
  );
}

export function ProfileCourses({ data, courseHref }: { data: LearnerProfile; courseHref: CourseHref }) {
  const active = data.courses.filter((c) => !c.completed);
  const done = data.courses.filter((c) => c.completed);
  const browse = (
    <EmptyMini icon={Compass} title="Nothing in progress" action={{ href: "/learn/browse", label: "Browse courses" }}>
      Courses you start show up here.
    </EmptyMini>
  );
  return (
    <>
      <CourseList title="In progress" courses={active} courseHref={courseHref} meta={`${active.length} course${active.length === 1 ? "" : "s"}`} empty={browse} />
      <CourseList
        title="Completed"
        courses={done}
        courseHref={courseHref}
        meta={`${done.length} course${done.length === 1 ? "" : "s"}`}
        empty={
          <EmptyMini icon={CheckCircle2} title="No completed courses yet">
            Finish every lesson in a course and it moves here.
          </EmptyMini>
        }
      />
    </>
  );
}

export function ProfileActivity({ data }: { data: LearnerProfile }) {
  return (
    <>
      <ActivityHeatmap data={data.heatmap} />
      <ActivityFeed items={data.recent} title="Lesson history" grouped />
    </>
  );
}

// Everything on one page, for a tutor's view of one of their students.
export function ProfileView({ data, emptyCourses }: { data: LearnerProfile; emptyCourses: React.ReactNode }) {
  return (
    <>
      <ProfileHero profile={data.profile} badges={profileBadges(data)} skills={data.skills} />
      <ProfileStats data={data} />
      <ActivityHeatmap data={data.heatmap} />
      <div className="et-grid-main">
        <CourseList title="Courses" courses={data.courses} empty={emptyCourses} meta={`${data.stats.completed} of ${data.stats.enrolled} completed`} />
        <ActivityFeed items={data.recent} title="Recent activity" limit={8} />
      </div>
    </>
  );
}
