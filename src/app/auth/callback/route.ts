import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimReferralFromCookie } from "@/lib/data/referrals";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects.
  const safeNextPath = safeNext(next, "/");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // New Google accounts that came through an invite link.
      if (data.user) await claimReferralFromCookie(data.user.id);
      return NextResponse.redirect(`${origin}${safeNextPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
