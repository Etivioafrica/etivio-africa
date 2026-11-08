import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Student-tutor conversations (migration 0044). Read with the service role after checking who's asking.

export type Side = "student" | "tutor";
export type ConversationRow = { id: string; courseId: string; courseTitle: string; otherName: string; otherAvatar: string | null; lastMessage: string | null; lastAt: string; unread: number };

export async function listConversations(userId: string, side: Side, courseId?: string): Promise<ConversationRow[]> {
  let q = createAdminClient()
    .from("conversations")
    .select("id, course_id, last_message, last_message_at, student_unread, tutor_unread, course:courses(title), student:profiles!conversations_student_id_fkey(full_name, avatar_url), tutor:profiles!conversations_tutor_id_fkey(full_name, avatar_url)")
    .eq(side === "student" ? "student_id" : "tutor_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (courseId) q = q.eq("course_id", courseId);
  const { data } = await q;
  return (data ?? []).map((c) => {
    const other = side === "student" ? c.tutor : c.student;
    return {
      id: c.id,
      courseId: c.course_id,
      courseTitle: c.course?.title ?? "Course",
      otherName: other?.full_name || (side === "student" ? "Tutor" : "Student"),
      otherAvatar: other?.avatar_url ?? null,
      lastMessage: c.last_message,
      lastAt: c.last_message_at,
      unread: side === "student" ? c.student_unread : c.tutor_unread,
    };
  });
}

// One conversation the user is part of, its messages, and which side they're on. Opening it clears their unread count.
// The conversation and its messages load together; nothing is returned unless the user is part of it.
export async function openConversation(id: string, userId: string) {
  const db = createAdminClient();
  const [{ data: c }, { data: messages }] = await Promise.all([
    db
      .from("conversations")
      .select("id, course_id, student_id, tutor_id, student_unread, tutor_unread, course:courses(title, slug), student:profiles!conversations_student_id_fkey(full_name), tutor:profiles!conversations_tutor_id_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    // Messages held for a moderation check show only to whoever sent them.
    db.from("conversation_messages").select("id, body, sender_id, created_at, hidden").eq("conversation_id", id).or(`hidden.eq.false,sender_id.eq.${userId}`).order("created_at").limit(500),
  ]);
  if (!c || (c.student_id !== userId && c.tutor_id !== userId)) return null;
  const side: Side = c.student_id === userId ? "student" : "tutor";
  // Clearing the unread count doesn't need to hold up the page.
  if (side === "student" && c.student_unread)
    after(async () => {
      await db.from("conversations").update({ student_unread: 0 }).eq("id", id);
    });
  if (side === "tutor" && c.tutor_unread)
    after(async () => {
      await db.from("conversations").update({ tutor_unread: 0 }).eq("id", id);
    });
  return {
    id: c.id,
    side,
    courseId: c.course_id,
    courseTitle: c.course?.title ?? "Course",
    courseSlug: c.course?.slug ?? "",
    otherName: (side === "student" ? c.tutor?.full_name : c.student?.full_name) || (side === "student" ? "Tutor" : "Student"),
    messages: messages ?? [],
  };
}

// The student's existing conversation for a course, if any.
export async function conversationFor(courseId: string, studentId: string) {
  const { data } = await createAdminClient().from("conversations").select("id").eq("course_id", courseId).eq("student_id", studentId).maybeSingle();
  return data?.id ?? null;
}

// Admin oversight: every student-tutor conversation (read-only; admins aren't a side of the chat).
export async function listAllConversations(courseId?: string): Promise<(ConversationRow & { flagged: number })[]> {
  const db = createAdminClient();
  let q = db
    .from("conversations")
    .select("id, course_id, last_message, last_message_at, course:courses(title), student:profiles!conversations_student_id_fkey(full_name, avatar_url), tutor:profiles!conversations_tutor_id_fkey(full_name)")
    .order("last_message_at", { ascending: false })
    .limit(300);
  if (courseId) q = q.eq("course_id", courseId);
  const [{ data }, { data: hidden }] = await Promise.all([q, db.from("conversation_messages").select("conversation_id").eq("hidden", true).limit(2000)]);
  const flags = new Map<string, number>();
  for (const h of hidden ?? []) flags.set(h.conversation_id, (flags.get(h.conversation_id) ?? 0) + 1);
  return (data ?? []).map((c) => ({
    id: c.id,
    courseId: c.course_id,
    courseTitle: c.course?.title ?? "Course",
    otherName: `${c.student?.full_name || "Student"} and ${c.tutor?.full_name || "Tutor"}`,
    otherAvatar: c.student?.avatar_url ?? null,
    lastMessage: c.last_message,
    lastAt: c.last_message_at,
    unread: 0,
    flagged: flags.get(c.id) ?? 0,
  }));
}

export async function adminConversation(id: string) {
  const db = createAdminClient();
  const [{ data: c }, { data: messages }] = await Promise.all([
    db
      .from("conversations")
      .select("id, course_id, student_id, tutor_id, course:courses(title), student:profiles!conversations_student_id_fkey(full_name), tutor:profiles!conversations_tutor_id_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    db.from("conversation_messages").select("id, body, sender_id, created_at, hidden").eq("conversation_id", id).order("created_at").limit(1000),
  ]);
  if (!c) return null;
  return {
    id: c.id,
    courseId: c.course_id,
    courseTitle: c.course?.title ?? "Course",
    studentId: c.student_id,
    tutorId: c.tutor_id,
    studentName: c.student?.full_name || "Student",
    tutorName: c.tutor?.full_name || "Tutor",
    messages: messages ?? [],
  };
}
