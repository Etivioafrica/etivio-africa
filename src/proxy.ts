import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { REF_COOKIE, cleanRefCode, refCookieOptions } from "@/lib/referral";

export async function proxy(request: NextRequest) {
  // One address for Google: www.etivio.co redirects permanently to etivio.co.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  const response = await updateSession(request);
  // Any page shared with ?ref=<code> counts as an invite, like etivio.co/r/<code>.
  const ref = cleanRefCode(request.nextUrl.searchParams.get("ref"));
  if (ref) response.cookies.set(REF_COOKIE, ref, refCookieOptions);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/upload|api/paystack/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
