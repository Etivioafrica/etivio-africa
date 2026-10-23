import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/dash/ui";
import { ConversationList } from "@/components/chat/Inbox";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { listConversations } from "@/lib/data/messages";

export const metadata = { title: "Messages" };

type Props = { searchParams: Promise<{ course?: string }> };

export default function TeachMessages({ searchParams }: Props) {
  return (
    <div className="et-page">
      <PageHead title="Messages" sub="Questions and messages from students in your courses." />
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Props) {
  const [{ course }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!canTeach(user.roles)) redirect("/teach");
  const [rows, all, { data: courses }] = await Promise.all([
    listConversations(user.id, "tutor", course),
    course ? listConversations(user.id, "tutor") : Promise.resolve(null),
    createAdminClient().from("courses").select("id, title").eq("instructor_id", user.id).order("title"),
  ]);
  const everything = all ?? rows;
  const unread = (id?: string) => everything.filter((r) => !id || r.courseId === id).reduce((n, r) => n + r.unread, 0);
  const withChats = (courses ?? []).filter((c) => everything.some((r) => r.courseId === c.id));
  return (
    <section className="et-card">
      {withChats.length > 1 && (
        <div className="et-filters">
          <div className="et-tabs">
            <Link href="/teach/messages" className={!course ? "is-on" : ""}>
              All courses {unread() ? <span className="et-count">{unread()}</span> : null}
            </Link>
            {withChats.map((c) => (
              <Link key={c.id} href={`/teach/messages?course=${c.id}`} className={course === c.id ? "is-on" : ""}>
                {c.title} {unread(c.id) ? <span className="et-count">{unread(c.id)}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      )}
      <ConversationList
        rows={rows}
        base="/teach/messages"
        empty={
          <>
            <b>No messages yet</b>
            <p>When students in your courses message you, their conversations show up here.</p>
          </>
        }
      />
    </section>
  );
}
