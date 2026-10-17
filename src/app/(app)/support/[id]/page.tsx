import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { ChatThread } from "@/components/chat/ChatThread";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { userReply } from "../actions";

export const metadata = { title: "Support" };

export default async function SupportThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: thread } = await supabase.from("support_threads").select("id, subject, status, user_unread").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!thread) notFound();
  if (thread.user_unread) await supabase.rpc("mark_thread_read", { p_thread_id: id });
  const { data: messages } = await supabase.from("support_messages").select("id, body, is_staff, created_at").eq("thread_id", id).order("created_at");

  return (
    <div className="et-page">
      <Link href="/support" className="et-back">
        <ArrowLeft size={14} />
        Support
      </Link>
      <section className="et-card" style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 60px - 56px - 60px)", minHeight: 460 }}>
        <div className="et-chat-head">
          <h2>
            {thread.subject} <Status value={thread.status === "pending" ? "replied" : thread.status} />
          </h2>
        </div>
        <ChatThread threadId={id} initial={messages ?? []} viewer="user" send={userReply} closed={thread.status === "closed"} />
      </section>
    </div>
  );
}
