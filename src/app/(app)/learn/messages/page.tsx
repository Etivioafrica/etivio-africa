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
      <PageHead title="Messages" sub="Your course conversations, with tutors and students." />
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <List />
      </Suspense>
    </div>
  );
}

// Everyone sees all of their course conversations here: with their tutors, and (for tutors who also learn) with
// their students. The sidebar and header counts cover the same set, so a badge always has something to open.
async function List() {
  const user = await getCurrentUser();
  const [asStudent, asTutor] = await Promise.all([listConversations(user.id, "student"), listConversations(user.id, "tutor")]);
  const empty = (
    <>
      <b>No messages yet</b>
      <p>
        Open one of <Link href="/learn/courses">your courses</Link> and use <b>Message the tutor</b> to ask a question.
      </p>
    </>
  );
  if (!asTutor.length)
    return (
      <section className="et-card">
        <ConversationList rows={asStudent} base="/learn/messages" empty={empty} />
      </section>
    );
  return (
    <>
      {asStudent.length > 0 && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your tutors</h2>
          </div>
          <ConversationList rows={asStudent} base="/learn/messages" empty={empty} />
        </section>
      )}
      <section className="et-card">
        <div className="et-card-head">
          <h2>Your students</h2>
          <Link href="/teach/messages">
            Open in Teach
          </Link>
        </div>
        <ConversationList rows={asTutor} base="/teach/messages" empty={empty} />
      </section>
    </>
  );
}
