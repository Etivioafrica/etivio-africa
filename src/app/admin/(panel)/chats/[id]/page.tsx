import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Status } from "@/components/dash/ui";
import { ChatThread } from "@/components/chat/ChatThread";
import { requireAdmin } from "@/lib/admin";
import { profileNames } from "@/lib/data/admin";
import { formatDate } from "@/lib/format";
import { ChatList, parseFilter } from "../ChatList";
import { assignThread, setThreadStatus, staffReply } from "../actions";

export const metadata = { title: "Chat" };

export default async function AdminChat({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const filter = parseFilter((await searchParams).status);
  const { db } = await requireAdmin();

  const { data: thread } = await db
    .from("support_threads")
    .select("*, user:profiles!support_threads_user_id_fkey(id, full_name, role)")
    .eq("id", id)
    .maybeSingle();
  if (!thread) notFound();
  if (thread.staff_unread) await db.from("support_threads").update({ staff_unread: false }).eq("id", id);

  const [{ data: messages }, { data: staff }] = await Promise.all([
    db.from("support_messages").select("id, body, is_staff, created_at, sender_id").eq("thread_id", id).order("created_at"),
    db.from("profiles").select("id, full_name").in("role", ["admin", "super_admin"]).order("full_name"),
  ]);
  const names = await profileNames(db, (messages ?? []).map((m) => m.sender_id));
  const initial = (messages ?? []).map((m) => ({ ...m, sender: m.sender_id ? names.get(m.sender_id) : undefined }));
  const closed = thread.status === "closed";

  return (
    <div className="et-page">
      <PageHead title="Chats" sub="Support conversations from students and instructors." />
      <section className="et-card et-chat">
        <ChatList db={db} filter={filter} activeId={id} />
        <div className="et-chat-pane">
          <div className="et-chat-head">
            <div>
              <h2>
                {thread.subject} <Status value={thread.status === "pending" ? "pending" : thread.status} />
              </h2>
              <p>
                <Link href={`/admin/users/${thread.user?.id}`}>{thread.user?.full_name || "Unnamed"}</Link> · {thread.user?.role.replace("_", " ")} · started {formatDate(thread.created_at)}
              </p>
            </div>
            <div className="et-inline">
              <form action={assignThread} className="et-inline">
                <input type="hidden" name="id" value={id} />
                <select name="assignee" defaultValue={thread.assigned_to ?? ""} className="et-input" aria-label="Assign to" style={{ height: 32 }}>
                  <option value="">Unassigned</option>
                  {(staff ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || "Unnamed"}
                    </option>
                  ))}
                </select>
                <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                  Assign
                </button>
              </form>
              <form action={setThreadStatus}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={closed ? "open" : "closed"} />
                <button type="submit" className={`et-btn et-btn-sm ${closed ? "et-btn-ghost" : "et-btn-success"}`}>
                  {closed ? "Reopen" : "Mark resolved"}
                </button>
              </form>
            </div>
          </div>
          <ChatThread key={id} threadId={id} initial={initial} viewer="staff" send={staffReply} closed={closed} />
        </div>
      </section>
    </div>
  );
}
