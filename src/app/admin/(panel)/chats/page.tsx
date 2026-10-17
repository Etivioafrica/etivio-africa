import { PageHead } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { ChatList, parseFilter } from "./ChatList";

export const metadata = { title: "Chats" };

export default async function AdminChats({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const filter = parseFilter((await searchParams).status);
  return (
    <div className="et-page">
      <PageHead title="Chats" sub="Support conversations from students and instructors." />
      <section className="et-card et-chat">
        <ChatList db={db} filter={filter} />
        <div className="et-chat-pane">
          <div className="et-chat-empty">Pick a conversation to read and reply.</div>
        </div>
      </section>
    </div>
  );
}
