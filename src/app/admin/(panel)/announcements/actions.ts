"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { sendDueAnnouncements } from "@/lib/email/notify";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { sanitizeRichText } from "@/lib/sanitize";
import { stripHtml, type Announcement, type AnnouncementStatus } from "@/lib/announcements";

const COLS = "id, title, body, status, pinned, created_at, scheduled_at, cover_image_url, cover_video_url, course_id";

export type AnnouncementInput = {
  title: string;
  body: string;
  status: Exclude<AnnouncementStatus, "archived"> | "archived";
  pinned: boolean;
  scheduled_at: string | null;
  cover_image_url: string | null;
  cover_video_url: string | null;
  // null sends it to everyone; a course id sends it only to that course's learners.
  course_id: string | null;
};

type Result = { data?: Announcement; error?: string };

function validate(input: AnnouncementInput): string | null {
  if (!input.title.trim()) return "Add a title.";
  if (!stripHtml(input.body)) return "Write the announcement.";
  if (input.status === "scheduled") {
    if (!input.scheduled_at) return "Please pick a date and time.";
    if (Date.parse(input.scheduled_at) <= Date.now()) return "Scheduled time must be in the future.";
  }
  if (input.cover_image_url && !/^https?:\/\//.test(input.cover_image_url)) return "Cover image must be an uploaded image.";
  if (input.cover_video_url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(input.cover_video_url)) return "Cover video must be a YouTube link.";
  if (input.course_id && !/^[0-9a-f-]{36}$/i.test(input.course_id)) return "Pick a course from the list.";
  return null;
}

const clean = (input: AnnouncementInput) => ({
  title: input.title.trim().slice(0, 160),
  body: sanitizeRichText(input.body),
  status: input.status,
  pinned: input.pinned,
  scheduled_at: input.status === "scheduled" ? input.scheduled_at : null,
  cover_image_url: input.cover_image_url || null,
  cover_video_url: input.cover_video_url?.trim() || null,
  course_id: input.course_id || null,
});

export async function createAnnouncement(input: AnnouncementInput): Promise<Result> {
  const { admin, db } = await requireAdmin("announcements");
  const problem = validate(input);
  if (problem) return { error: problem };
  const { data, error } = await db
    .from("announcements")
    .insert({ ...clean(input), author_id: admin.id })
    .select(COLS)
    .single();
  if (error) return { error: "Could not save the announcement." };
  await audit(admin.id, "announcement.create", { type: "announcement", id: data.id }, { title: data.title, status: data.status });
  after(sendDueAnnouncements);
  refresh();
  return { data };
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<Result> {
  const { admin, db } = await requireAdmin("announcements");
  const problem = validate(input);
  if (problem) return { error: problem };
  const { data: before } = await db.from("announcements").select("cover_image_url").eq("id", id).maybeSingle();
  const { data, error } = await db.from("announcements").update(clean(input)).eq("id", id).select(COLS).single();
  if (error) return { error: "Could not save the announcement." };
  if (before?.cover_image_url && before.cover_image_url !== data.cover_image_url) await deleteObject(keyFromUrl(before.cover_image_url)).catch(() => {});
  await audit(admin.id, "announcement.update", { type: "announcement", id }, { title: data.title, status: data.status });
  after(sendDueAnnouncements);
  refresh();
  return { data };
}

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const { admin, db } = await requireAdmin("announcements");
  const { data: before } = await db.from("announcements").select("title, cover_image_url").eq("id", id).maybeSingle();
  const { error } = await db.from("announcements").delete().eq("id", id);
  if (error) return { error: "Delete failed." };
  if (before?.cover_image_url) await deleteObject(keyFromUrl(before.cover_image_url)).catch(() => {});
  await audit(admin.id, "announcement.delete", { type: "announcement", id }, { title: before?.title ?? "" });
  refresh();
  return {};
}
