import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import type { Announcement } from "@/lib/announcements";
import { AnnouncementsAdmin } from "./AnnouncementsAdmin";

export const metadata = { title: "Announcements" };

export default function AdminAnnouncementsPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <AdminAnnouncements />
    </Suspense>
  );
}

async function AdminAnnouncements() {
  const { db } = await requireAdmin("announcements");
  const [{ data }, { data: courses }] = await Promise.all([
    db
      .from("announcements")
      .select("id, title, body, status, pinned, created_at, scheduled_at, cover_image_url, cover_video_url, course_id")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    db.from("courses").select("id, title").neq("status", "archived").order("title"),
  ]);
  return <AnnouncementsAdmin announcements={(data ?? []) as Announcement[]} courses={courses ?? []} />;
}
