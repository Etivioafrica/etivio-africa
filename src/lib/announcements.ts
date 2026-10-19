// Announcements: shared types and helpers (ported from the nnamdi-obi community platform).

export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  pinned: boolean;
  created_at: string;
  scheduled_at: string | null;
  cover_image_url: string | null;
  cover_video_url: string | null;
};

export type ViewMode = "grid" | "list";

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

const youtubeId = (url: string) => url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/)?.[1] ?? null;

export function getYoutubeThumbnail(url: string) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function getYoutubeEmbedUrl(url: string) {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function formatAnnouncementDate(dateStr: string, long = false) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: long ? "long" : "short", year: "numeric" });
}

// When a learner sees it: the scheduled time for scheduled posts, otherwise when it was created.
export const liveDate = (a: Pick<Announcement, "status" | "scheduled_at" | "created_at">) => (a.status === "scheduled" && a.scheduled_at ? a.scheduled_at : a.created_at);
