import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { conversationFor } from "@/lib/data/messages";
import { MessageTutor } from "./MessageTutor";

// "Message the tutor" on the course page, for the signed-in student (render only when they're enrolled).
export async function MessageTutorSlot({ courseId, tutorId, tutorName }: { courseId: string; tutorId: string; tutorName: string }) {
  const viewer = await sessionUser(await createClient());
  if (!viewer || viewer.id === tutorId) return null;
  return <MessageTutor courseId={courseId} tutorName={tutorName} conversationId={await conversationFor(courseId, viewer.id)} compact />;
}
