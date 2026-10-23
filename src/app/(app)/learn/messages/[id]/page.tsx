import { Suspense } from "react";
import { ConversationView } from "@/components/chat/Inbox";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Messages" };

type Props = { params: Promise<{ id: string }> };

export default function LearnConversation({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <View params={params} />
      </Suspense>
    </div>
  );
}

async function View({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  return <ConversationView id={id} userId={user.id} base="/learn/messages" />;
}
