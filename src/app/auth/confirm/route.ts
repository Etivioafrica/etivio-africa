import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

// Email links (confirm sign-up, reset password, magic link, guest login) land here with a one-time token. Unlike
// /auth/callback this doesn't depend on the browser that asked for the email, so a link requested on a laptop
// still works when it's opened on a phone.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/learn";
  // Only same-site paths, never another domain.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/learn";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
