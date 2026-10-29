import Link from "next/link";
import { Bell, BookOpen, Play, Search, SlidersHorizontal } from "lucide-react";
import { Avatar } from "./Avatar";
import type { MyCourse } from "@/lib/data/learn";

// The phone's Home header (under 860px, replacing the top bar and the banner there): a blue band with the learner's
// photo, a greeting, the inbox bell and course search, then a rounded sheet with the courses they're taking.
export function MobileHome({
  name,
  avatar,
  inbox,
  courses,
}: {
  name: string;
  avatar: { src: string | null; seed: string };
  inbox: string;
  courses: MyCourse[];
}) {
  return (
    <div className="et-mhome">
      <header className="et-mhome-top">
        <div className="et-mhome-hi">
          <Link href="/me" aria-label="Me">
            <Avatar src={avatar.src} initial={name.charAt(0).toUpperCase()} seed={avatar.seed} className="et-mhome-avatar" />
          </Link>
          <span>
            <b>Hello, {name}</b>
            <small>Find your courses and upskill</small>
          </span>
          <Link href={inbox} className="et-mhome-bell" aria-label="Inbox">
            <Bell size={22} />
          </Link>
        </div>
        <form action="/learn/explore" className="et-mhome-search" role="search">
          <Search size={19} />
          <input type="search" name="q" placeholder="Search courses" aria-label="Search courses" />
          <Link href="/learn/explore" aria-label="Filters">
            <SlidersHorizontal size={19} />
          </Link>
        </form>
      </header>

      <section className="et-mhome-sheet">
        <div className="et-mhome-head">
          <h2>Ongoing lessons</h2>
          <Link href="/learn/courses">View all</Link>
        </div>
        <div className="et-mhome-rail">
          {courses.length ? (
            courses.map((c) => (
              <Link key={c.id} href={`/learn/course/${c.id}`} className="et-mhome-card">
                <span className="et-mhome-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <BookOpen size={24} />}
                </span>
                <span className="et-mhome-text">
                  <b>{c.title}</b>
                  <small>
                    {c.done} {c.done === 1 ? "lesson" : "lessons"} completed · {c.progress}%
                  </small>
                </span>
                <span className="et-mhome-play" aria-hidden>
                  <Play size={20} fill="currentColor" />
                </span>
              </Link>
            ))
          ) : (
            <Link href="/learn/browse" className="et-mhome-card">
              <span className="et-mhome-thumb">
                <BookOpen size={24} />
              </span>
              <span className="et-mhome-text">
                <b>Start your first course</b>
                <small>Browse courses from creators across Africa</small>
              </span>
              <span className="et-mhome-play" aria-hidden>
                <Play size={20} fill="currentColor" />
              </span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
