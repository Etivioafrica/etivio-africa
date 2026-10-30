import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, cleanRefCode, refCookieOptions } from "@/lib/referral";

// Invite links: etivio.co/r/<code> keeps the code for 30 days and opens sign-up, which says who sent the invite.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanRefCode((await params).code);
  const response = NextResponse.redirect(new URL("/signup", request.url));
  if (code) response.cookies.set(REF_COOKIE, code, refCookieOptions);
  return response;
}
