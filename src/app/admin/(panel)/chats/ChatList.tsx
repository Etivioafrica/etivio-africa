import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { ChatListLive } from "./ChatListLive";

const FILTERS = ["open", "pending", "closed", "all"] as const;
export type ChatFilter = (typeof FILTERS)[number];
export const parseFilter = (v?: string): ChatFilter => (FILTERS as readonly string[]).includes(v ?? "") ? (v as ChatFilter) : "open";

// Left column of the inbox. "Open" also includes threads waiting on the user (pending).
export async function ChatList({ db, filter, activeId }: { db: SupabaseClient<Database>; filter: ChatFilter; activeId?: string }) {
  let q = db
    .from("support_threads")
    .select("id, subject, status, staff_unread, last_message_at, user:profiles!support_threads_user_id_fkey(full_name)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (filter === "open") q = q.in("status", ["open", "pending"]);
  else if (filter !== "all") q = q.eq("status", filter);
  const { data: threads } = await q;
  const qs = filter === "open" ? "" : `?status=${filter}`;

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
      {threads?.length ? (
        threads.map((t) => (
          <Link
            key={t.id}
            href={`/admin/chats/${t.id}${qs}`}
            className={`et-chat-item${t.id === activeId ? " is-active" : ""}${t.staff_unread && t.status !== "closed" ? " is-unread" : ""}`}
          >
            <span className="et-chat-item-top">
              <span>{t.user?.full_name || "Unnamed"}</span>
              <span>{formatDateTime(t.last_message_at)}</span>
            </span>
            <b>{t.subject}</b>
            {t.status === "pending" && filter !== "pending" && <small className="et-chat-item-tag">Awaiting user</small>}
          </Link>
        ))
      ) : (
        <p className="et-empty">No conversations here.</p>
      )}
    </aside>
  );
}
