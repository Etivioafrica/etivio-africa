"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SendResult } from "@/components/chat/ChatThread";
import { featureOn } from "@/lib/data/features";
import { moderate } from "@/lib/moderation";

export type StartState = { error?: string } | null;
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// A student's first message to a course's tutor. Only people enrolled in the course can start one, and there's one
// conversation per student per course (a second "start" just adds to it).
export async function startConversation(_prev: StartState, fd: FormData): Promise<StartState> {
  const user = await getCurrentUser();
  if (!(await featureOn("messages"))) return { error: "Messages aren't available right now." };
  const courseId = str(fd, "course_id");
  const body = str(fd, "body").slice(0, 5000);
  if (body.length < 2) return { error: "Write a message first." };
  const db = createAdminClient();
  const [{ data: course }, { data: enrolled }] = await Promise.all([
    db.from("courses").select("id, instructor_id").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("user_id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!course) return { error: "That course wasn't found." };
  if (!enrolled) return { error: "Enrol in the course to message its tutor." };
  if (course.instructor_id === user.id) return { error: "This is your own course." };
  const mod = await moderate("message", user.id, [body]);
  if (mod.error) return { error: mod.error };
  const { data: convo } = await db
    .from("conversations")
    .upsert({ course_id: course.id, student_id: user.id, tutor_id: course.instructor_id }, { onConflict: "course_id,student_id" })
    .select("id")
    .single();
  if (!convo) return { error: "Couldn't start the conversation. Try again." };
  const { data: sent, error } = await db.from("conversation_messages").insert({ conversation_id: convo.id, sender_id: user.id, body, hidden: mod.hold }).select("id").single();
  if (error) return { error: "Couldn't send your message. Try again." };
  await mod.record(sent?.id);
  redirect(`/learn/messages/${convo.id}`);
}

// A reply from either side of a conversation.
export async function sendCourseMessage(fd: FormData): Promise<SendResult> {
  const user = await getCurrentUser();
  if (!(await featureOn("messages"))) return { error: "Messages aren't available right now." };
  const id = str(fd, "thread_id");
  const body = str(fd, "body").slice(0, 5000);
  if (!body) return { error: "Write a message first." };
  const db = createAdminClient();
  const { data: c } = await db.from("conversations").select("student_id, tutor_id").eq("id", id).maybeSingle();
  if (!c || (c.student_id !== user.id && c.tutor_id !== user.id)) return { error: "That conversation wasn't found." };
  const mod = await moderate("message", user.id, [body]);
  if (mod.error) return { error: mod.error };
  const { data, error } = await db.from("conversation_messages").insert({ conversation_id: id, sender_id: user.id, body, hidden: mod.hold }).select("id, body, sender_id, created_at, hidden").single();
  if (error || !data) return { error: "Couldn't send. Try again." };
  await mod.record(data.id);
  // The sender has read everything up to their own message.
  await db.from("conversations").update(c.student_id === user.id ? { student_unread: 0 } : { tutor_unread: 0 }).eq("id", id);
  return { message: data };
}
