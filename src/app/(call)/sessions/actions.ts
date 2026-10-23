"use server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureOn } from "@/lib/data/features";
import { getSessionRoom, roomWindow } from "@/lib/data/coaching";
import { iceServers } from "@/lib/ice";

// Entering a session's call room: checks it's open, records the first join, and hands back the network servers.
export async function joinSessionCall(bookingId: string): Promise<{ ice?: RTCIceServer[]; error?: string }> {
  const user = await getCurrentUser();
  if (!(await featureOn("coaching"))) return { error: "Coaching calls aren't available right now." };
  const room = await getSessionRoom(bookingId, user.id);
  if (!room) return { error: "This session isn't yours." };
  if (room.status !== "confirmed") return { error: "This session isn't booked any more." };
  const { opens, closes } = roomWindow(room);
  const now = Date.now();
  if (now < opens) return { error: "The room opens 15 minutes before the session." };
  if (now > closes) return { error: "This session has finished." };
  const at = new Date().toISOString();
  const db = createAdminClient();
  if (room.role === "coach") await db.from("coach_bookings").update({ coach_joined_at: at }).eq("id", room.id).is("coach_joined_at", null);
  else await db.from("coach_bookings").update({ learner_joined_at: at }).eq("id", room.id).is("learner_joined_at", null);
  return { ice: await iceServers() };
}
