"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { audit, requireAdmin } from "@/lib/admin";
import { emailCourseDecision } from "@/lib/email/notify";
import { setProductStatus } from "../marketplace/actions";

type Result = { ok?: string; error?: string };

// Approve a tutor's course (it goes live) or send it back with a note. Only courses waiting in the queue.
export async function decideCourse(id: string, approve: boolean, note = ""): Promise<Result> {
  const { admin, db } = await requireAdmin("review");
  const { data: c } = await db.from("courses").select("status, published_at").eq("id", id).maybeSingle();
  if (!c) return { error: "That course no longer exists." };
  if (c.status !== "pending") return { error: "This course isn't waiting for review any more." };
  if (!approve && !note.trim()) return { error: "Tell the tutor what to change." };
  const now = new Date().toISOString();
  await db
    .from("courses")
    .update(
      approve
        ? { status: "published", published_at: c.published_at ?? now, review_note: null, reviewed_at: now, reviewed_by: admin.id }
        : { status: "rejected", review_note: note.trim().slice(0, 1000), reviewed_at: now, reviewed_by: admin.id },
    )
    .eq("id", id);
  await audit(admin.id, approve ? "course.approve" : "course.reject", { type: "course", id }, note ? { note } : {});
  after(() => emailCourseDecision(id, approve));
  refresh();
  return { ok: approve ? "Approved. The course is live and the tutor has been told." : "Sent back to the tutor with your note." };
}

export async function decideProduct(id: string, approve: boolean, note = ""): Promise<Result> {
  return setProductStatus(id, approve ? "approve" : "reject", note);
}
