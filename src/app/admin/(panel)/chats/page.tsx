import { Suspense } from "react";
import { PageHead } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { ChatList, parseFilter, type ChatFilter } from "./ChatList";

export const metadata = { title: "Chats" };

export default async function AdminChats({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const filter = parseFilter((await searchParams).status);
  return (
    <div className="et-page">
      <PageHead title="Chats" sub="Support conversations from students and instructors." />
      <section className="et-card et-chat">
        <Suspense fallback={<div className="et-chat-list" aria-busy="true" />}>
          <List filter={filter} />
        </Suspense>
        <div className="et-chat-pane">
          <div className="et-chat-empty">Pick a conversation to read and reply.</div>
        </div>
      </section>
    </div>
  );
}

async function List({ filter }: { filter: ChatFilter }) {
  const { db } = await requireAdmin("chats");
  return <ChatList db={db} filter={filter} />;
}
