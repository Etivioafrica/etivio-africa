import { Suspense } from "react";
import Link from "next/link";
import { Bookmark, NotebookPen } from "lucide-react";
import { EmptyMini } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Notes" };

type NoteRow = {
  lesson_id: string;
  body: string;
  bookmarked: boolean;
  updated_at: string;
  lesson: { title: string; course_id: string; course: { title: string } | null } | null;
};

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 240 }} />}>
      <Notes />
    </Suspense>
  );
}

async function Notes() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_notes")
    .select("lesson_id, body, bookmarked, updated_at, lesson:lessons(title, course_id, course:courses(title))")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const rows = ((data ?? []) as unknown as NoteRow[]).filter((r) => r.lesson);

  if (!rows.length)
    return (
      <section className="et-card">
        <EmptyMini icon={NotebookPen} title="No notes or bookmarks yet" action={{ href: "/profile/courses", label: "Open a course" }}>
          Take notes or bookmark lessons while you learn, and they collect here.
        </EmptyMini>
      </section>
    );

  // Group by course, keeping the most recently touched course first.
  const byCourse = new Map<string, { title: string; notes: NoteRow[] }>();
  for (const r of rows) {
    const key = r.lesson!.course_id;
    const g = byCourse.get(key) ?? { title: r.lesson!.course?.title ?? "Course", notes: [] };
    g.notes.push(r);
    byCourse.set(key, g);
  }

  return (
    <>
      {[...byCourse].map(([courseId, g]) => (
        <section key={courseId} className="et-card">
          <div className="et-card-head">
            <h2>{g.title}</h2>
            <span className="et-muted" style={{ fontSize: 12.5 }}>
              {g.notes.length} lesson{g.notes.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="et-note-list">
            {g.notes.map((n) => (
              <li key={n.lesson_id}>
                <Link href={`/learn/course/${courseId}?lesson=${n.lesson_id}`}>
                  <span className="et-note-title">
                    {n.bookmarked && <Bookmark size={13} fill="currentColor" aria-label="Bookmarked" />}
                    <b>{n.lesson!.title}</b>
                    <small>{formatDate(n.updated_at)}</small>
                  </span>
                  {n.body.trim() ? <p>{n.body}</p> : <p className="et-muted">Bookmarked, no notes.</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
