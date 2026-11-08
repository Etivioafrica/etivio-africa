import { Suspense } from "react";
import { PageHead } from "@/components/dash/ui";
import { ConversationList } from "@/components/chat/Inbox";
import { requireAdmin } from "@/lib/admin";
import { listAllConversations } from "@/lib/data/messages";

export const metadata = { title: "Course messages" };

export default function AdminCourseMessages() {
  return (
    <div className="et-page">
      <PageHead title="Course messages" sub="Every conversation between students and tutors, newest first. Read-only, for support and moderation." />
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await requireAdmin("chats");
  const rows = await listAllConversations();
  return (
    <section className="et-card">
      <ConversationList
        rows={rows}
        base="/admin/course-messages"
        empty={
          <>
            <b>No course messages yet</b>
            <p>When students message their tutors, the conversations show up here.</p>
          </>
        }
      />
    </section>
  );
}
