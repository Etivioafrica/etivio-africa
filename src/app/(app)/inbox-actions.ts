"use server";
import { createClient } from "@/lib/supabase/server";
import { listConversations } from "@/lib/data/messages";

export type InboxNote = { id: string; kind: string; title: string; body: string | null; href: string | null; read: boolean; at: string };
export type InboxThread = { id: string; kind: "tutor" | "support"; title: string; sub: string; preview: string | null; avatar: string | null; at: string; unread: number; href: string };
export type Inbox = { notes: InboxNote[]; unreadNotes: number; threads: InboxThread[]; unreadMessages: number };

const EMPTY: Inbox = { notes: [], unreadNotes: 0, threads: [], unreadMessages: 0 };

// Everything the header's bell and messages menus show: the latest notifications, and the latest conversations
// (course chats on both sides, plus support chats) with unread counts.
export async function getInbox(): Promise<Inbox> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;
  const [notes, unread, asStudent, asTutor, { data: support }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    listConversations(user.id, "student"),
    listConversations(user.id, "tutor"),
    supabase.from("support_threads").select("id, subject, last_message_at, user_unread").eq("user_id", user.id).order("last_message_at", { ascending: false }).limit(20),
  ]);
  const threads: InboxThread[] = [
    ...asStudent.map((c) => ({ id: c.id, kind: "tutor" as const, title: c.otherName, sub: c.courseTitle, preview: c.lastMessage, avatar: c.otherAvatar, at: c.lastAt, unread: c.unread, href: `/learn/messages/${c.id}` })),
    ...asTutor.map((c) => ({ id: c.id, kind: "tutor" as const, title: c.otherName, sub: c.courseTitle, preview: c.lastMessage, avatar: c.otherAvatar, at: c.lastAt, unread: c.unread, href: `/teach/messages/${c.id}` })),
    ...(support ?? []).map((t) => ({ id: t.id, kind: "support" as const, title: "Etivio support", sub: t.subject, preview: null, avatar: null, at: t.last_message_at, unread: t.user_unread ? 1 : 0, href: `/support/${t.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    // Until the notifications table exists these come back empty rather than failing.
    notes: (notes.data ?? []).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: !!n.read_at, at: n.created_at })),
    unreadNotes: unread.count ?? 0,
    threads: threads.slice(0, 12),
    unreadMessages: threads.reduce((n, t) => n + (t.unread ? 1 : 0), 0),
  };
}

// Marks the given notifications read, or all of them.
export async function markNotesRead(ids?: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
}
