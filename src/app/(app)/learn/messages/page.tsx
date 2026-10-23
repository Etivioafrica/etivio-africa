import { Suspense } from "react";
import Link from "next/link";
import { PageHead } from "@/components/dash/ui";
import { ConversationList } from "@/components/chat/Inbox";
import { getCurrentUser } from "@/lib/auth";
import { listConversations } from "@/lib/data/messages";

export const metadata = { title: "Messages" };

export default function LearnMessages() {
  return (
    <div className="et-page">
      <PageHead title="Messages" sub="Your conversations with the tutors of your courses." />
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await getCurrentUser();
  const rows = await listConversations(user.id, "student");
  return (
    <section className="et-card">
      <ConversationList
        rows={rows}
        base="/learn/messages"
        empty={
          <>
            <b>No messages yet</b>
            <p>
              Open one of <Link href="/learn/courses">your courses</Link> and use <b>Message the tutor</b> to ask a question.
            </p>
          </>
        }
      />
    </section>
  );
}
