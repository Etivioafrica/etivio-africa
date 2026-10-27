import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { PageHead, Status } from "@/components/dash/ui";
import { ChatThread } from "@/components/chat/ChatThread";
import { requireAdmin } from "@/lib/admin";
import { usersWithRoles } from "@/lib/data/admin";
import { ROLE_LABELS, primaryRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { ChatList, parseFilter, type ChatFilter } from "../ChatList";
import { setThreadStatus, staffReply } from "../actions";
import { AssignSelect } from "./AssignSelect";

export const metadata = { title: "Chat" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> };

// The list and the open conversation load side by side, each showing a placeholder until its data arrives.
export default async function AdminChat({ params, searchParams }: Props) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const filter = parseFilter(status);
  return (
    <div className="et-page">
      <PageHead title="Chats" sub="Support conversations from students and instructors." />
      <section className="et-card et-chat">
        <Suspense fallback={<ListSkeleton />}>
          <List filter={filter} id={id} />
        </Suspense>
        <div className="et-chat-pane">
          <Suspense key={id} fallback={<PaneSkeleton />}>
            <Pane id={id} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

async function List({ filter, id }: { filter: ChatFilter; id: string }) {
  const { db } = await requireAdmin("chats");
  return <ChatList db={db} filter={filter} activeId={id} />;
}

async function Pane({ id }: { id: string }) {
  const { db } = await requireAdmin("chats");
  // Thread, messages (with sender names) and the team list in one round trip.
  const [{ data: thread }, { data: messages }, staff] = await Promise.all([
    db
      .from("support_threads")
      .select("*, user:profiles!support_threads_user_id_fkey(id, full_name, roles:user_roles!user_roles_user_id_fkey(role))")
      .eq("id", id)
      .maybeSingle(),
    db.from("support_messages").select("id, body, is_staff, created_at, sender_id, author:profiles!support_messages_sender_id_fkey(full_name)").eq("thread_id", id).order("created_at"),
    usersWithRoles(db, ["super_admin"]),
  ]);
  if (!thread) notFound();
  // Marking it read doesn't need to hold up the page.
  if (thread.staff_unread)
    after(async () => {
      await db.from("support_threads").update({ staff_unread: false }).eq("id", id);
    });

  const initial = (messages ?? []).map(({ author, ...m }) => ({ ...m, sender: author?.full_name || undefined }));
  const closed = thread.status === "closed";

  return (
    <>
      <div className="et-chat-head">
        <div>
          <h2>
            {thread.subject} <Status value={thread.status === "pending" ? "pending" : thread.status} />
          </h2>
          <p>
            <Link href={`/admin/users/${thread.user?.id}`}>{thread.user?.full_name || "Unnamed"}</Link> · {ROLE_LABELS[primaryRole((thread.user?.roles ?? []).map((r) => r.role))]} · started {formatDate(thread.created_at)}
          </p>
        </div>
        <div className="et-chat-actions">
          <AssignSelect key={thread.assigned_to ?? ""} id={id} value={thread.assigned_to ?? ""} staff={staff} />
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
    </>
  );
}

function ListSkeleton() {
  return (
    <aside className="et-chat-list" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="et-skel" style={{ height: 58, margin: "12px 16px 0" }} />
      ))}
    </aside>
  );
}

function PaneSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }} aria-busy="true">
      <div className="et-skel" style={{ height: 22, width: "45%" }} />
      <div className="et-skel" style={{ height: 14, width: "30%" }} />
      <div className="et-skel" style={{ height: 52, width: "55%", marginTop: 18 }} />
      <div className="et-skel" style={{ height: 52, width: "40%", alignSelf: "flex-end" }} />
    </div>
  );
}
