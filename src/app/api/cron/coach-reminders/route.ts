import { NextResponse, type NextRequest } from "next/server";
import { sendSessionReminders } from "@/lib/email/coaching";

// Emails coaching session reminders an hour before. Called every 10 minutes by a scheduled job with
// "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await sendSessionReminders();
  return NextResponse.json({ sent });
}
