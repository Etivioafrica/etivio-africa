import { Suspense } from "react";
import { after } from "next/server";
import { sendDueAnnouncements } from "@/lib/email/notify";
import { createClient } from "@/lib/supabase/server";
import { liveDate, type Announcement, type ViewMode } from "@/lib/announcements";
import { AnnouncementFeed } from "./AnnouncementFeed";

export const metadata = { title: "Announcements" };

type Props = { searchParams: Promise<{ view?: string }> };

export default function AnnouncementsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <Feed searchParams={searchParams} />
    </Suspense>
  );
}

async function Feed({ searchParams }: Props) {
  const { view } = await searchParams;
  // Scheduled announcements go out by email the first time someone loads the feed after their time.
  after(sendDueAnnouncements);
  const supabase = await createClient();
  // RLS returns only live posts: published, or scheduled with a time that has passed.
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, status, pinned, created_at, scheduled_at, cover_image_url, cover_video_url")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  const items = ((data ?? []) as Announcement[]).sort((a, b) => Number(b.pinned) - Number(a.pinned) || liveDate(b).localeCompare(liveDate(a)));
  return <AnnouncementFeed announcements={items} initialViewMode={(view === "list" ? "list" : "grid") satisfies ViewMode} />;
}
