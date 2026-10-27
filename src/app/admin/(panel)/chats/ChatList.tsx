import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { ChatListLive } from "./ChatListLive";
import { ChatItems, type ChatRow } from "./ChatItems";

const FILTERS = ["open", "pending", "closed", "all"] as const;
export type ChatFilter = (typeof FILTERS)[number];
export const parseFilter = (v?: string): ChatFilter => (FILTERS as readonly string[]).includes(v ?? "") ? (v as ChatFilter) : "open";

// Left column of the inbox. "Open" also includes threads waiting on the user (pending). Every thread is loaded so the
// search box can find any conversation instantly, whichever tab is showing.
export async function ChatList({ db, filter, activeId }: { db: SupabaseClient<Database>; filter: ChatFilter; activeId?: string }) {
  const { data: threads } = await db
    .from("support_threads")
    .select("id, subject, status, staff_unread, last_message_at, user:profiles!support_threads_user_id_fkey(full_name)")
    .order("last_message_at", { ascending: false })
    .limit(500);
  const rows: ChatRow[] = (threads ?? []).map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    unread: t.staff_unread && t.status !== "closed",
    at: formatDateTime(t.last_message_at),
    name: t.user?.full_name || "Unnamed",
  }));

  return (
    <aside className="et-chat-list">
      <ChatListLive />
      <div className="et-filters" style={{ padding: "10px 12px" }}>
        <div className="et-tabs">
          {FILTERS.map((f) => (
            <Link key={f} href={`/admin/chats${f === "open" ? "" : `?status=${f}`}`} className={f === filter ? "is-on" : ""} style={{ textTransform: "capitalize" }}>
              {f === "pending" ? "Awaiting user" : f}
            </Link>
          ))}
        </div>
      </div>
      <ChatItems rows={rows} filter={filter} activeId={activeId} />
    </aside>
  );
}
