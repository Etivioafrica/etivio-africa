"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { SendResult } from "@/components/chat/ChatThread";
import type { FormState } from "@/app/(app)/teach/actions";
import { moderate } from "@/lib/moderation";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function startThread(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const subject = str(fd, "subject").slice(0, 140);
  const body = str(fd, "body").slice(0, 5000);
  if (subject.length < 3) return { error: "Add a short subject." };
  if (!body) return { error: "Tell us how we can help." };
  const mod = await moderate("support_message", user.id, [subject, body]);
  if (mod.error) return { error: mod.error };

  const { data: thread, error } = await supabase.from("support_threads").insert({ user_id: user.id, subject }).select("id").single();
  if (error || !thread) return { error: "Could not start the conversation." };
  await supabase.from("support_messages").insert({ thread_id: thread.id, sender_id: user.id, body });
  await mod.record(thread.id);
  redirect(`/support/${thread.id}`);
}

export async function userReply(fd: FormData): Promise<SendResult> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const body = str(fd, "body").slice(0, 5000);
  if (!body) return { error: "Write a message first." };
  const mod = await moderate("support_message", user.id, [body]);
  if (mod.error) return { error: mod.error };
  const { data, error } = await supabase
    .from("support_messages")
    .insert({ thread_id: str(fd, "thread_id"), sender_id: user.id, body })
    .select("id, body, is_staff, created_at")
    .single();
  if (error || !data) return { error: "Could not send. This conversation may be closed." };
  await mod.record(data.id);
  refresh();
  return { message: data };
}

// Asked from the course player's Support tab: same as a new conversation, but stays on the lesson.
export async function askFromLesson(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const subject = str(fd, "subject").slice(0, 140);
  const body = str(fd, "body").slice(0, 5000);
  if (body.length < 5) return { error: "Tell us a little more so we can help." };
  const mod = await moderate("support_message", user.id, [subject, body]);
  if (mod.error) return { error: mod.error };
  const { data: thread, error } = await supabase.from("support_threads").insert({ user_id: user.id, subject: subject || "Question about a lesson" }).select("id").single();
  if (error || !thread) return { error: "Could not send your message. Please try again." };
  await supabase.from("support_messages").insert({ thread_id: thread.id, sender_id: user.id, body });
  await mod.record(thread.id);
  refresh();
  return { ok: "Sent. The Etivio team will reply here and by email." };
}
