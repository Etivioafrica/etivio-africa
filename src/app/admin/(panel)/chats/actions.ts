"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailSupportReply } from "@/lib/email/notify";
import { audit, requireAdmin } from "@/lib/admin";
import type { SendResult } from "@/components/chat/ChatThread";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function staffReply(fd: FormData): Promise<SendResult> {
  const { admin, db } = await requireAdmin("chats");
  const threadId = str(fd, "thread_id");
  const body = str(fd, "body").slice(0, 5000);
  if (!body) return { error: "Write a message first." };
  const { data, error } = await db
    .from("support_messages")
    .insert({ thread_id: threadId, sender_id: admin.id, is_staff: true, body })
    .select("id, body, is_staff, created_at")
    .single();
  if (error || !data) return { error: "Could not send the reply." };
  await db.from("support_threads").update({ staff_unread: false, assigned_to: admin.id }).eq("id", threadId).is("assigned_to", null);
  await db.from("support_threads").update({ staff_unread: false }).eq("id", threadId);
  after(() => emailSupportReply(threadId, body));
  refresh();
  return { message: { ...data, sender: admin.name || "You" } };
}

export async function setThreadStatus(fd: FormData) {
  const { admin, db } = await requireAdmin("chats");
  const id = str(fd, "id");
  const status = str(fd, "status") === "closed" ? "closed" : "open";
  await db.from("support_threads").update({ status }).eq("id", id);
  await audit(admin.id, `chat.${status === "closed" ? "close" : "reopen"}`, { type: "thread", id });
  refresh();
}

export async function assignThread(fd: FormData) {
  const { db } = await requireAdmin("chats");
  await db.from("support_threads").update({ assigned_to: str(fd, "assignee") || null }).eq("id", str(fd, "id"));
  refresh();
}
