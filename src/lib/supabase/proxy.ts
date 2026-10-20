import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIXES = ["/learn", "/teach", "/settings", "/support", "/profile"];

// Carry refreshed auth cookies over to a redirect response.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
  // Public profiles live at /@username; the route itself is /u/[username].
  const handle = request.nextUrl.pathname.match(/^\/@([^/]+)\/?$/);
  if (handle) {
    const url = request.nextUrl.clone();
    url.pathname = `/u/${handle[1]}`;
    return NextResponse.rewrite(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie when needed and verifies it locally (ES256), so no Auth round trip per request.
  // Do not put logic between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;
  // Accounts created by a guest purchase must swap their emailed temporary password first.
  const mustSetPassword = !!(data?.claims?.app_metadata as { must_set_password?: boolean } | undefined)?.must_set_password;

  // Optimistic routing only. Layouts and Server Actions re-check the session.
  const path = request.nextUrl.pathname;
  const isApp = APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  // The app's start screen counts as an auth page: signed-in people go straight to the dashboard.
  const isAuthPage = path === "/login" || path === "/signup" || path === "/welcome";
  const isAdmin = (path === "/admin" || path.startsWith("/admin/")) && path !== "/admin/login";

  if (!user && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return redirectWithCookies(url, response);
  }
  if (!user && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return redirectWithCookies(url, response);
  }
  // Accounts with two-step verification must finish the code step before using the app or admin.
  if (user && (isApp || isAdmin || path === "/admin/login")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/verify";
      url.search = `?next=${encodeURIComponent(path === "/admin/login" ? "/admin" : path)}`;
      return redirectWithCookies(url, response);
    }
  }
  if (user && mustSetPassword && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/set-password";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectWithCookies(url, response);
  }
  if (!user && path === "/set-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return redirectWithCookies(url, response);
  }
  if (!user && path === "/verify") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return redirectWithCookies(url, response);
  }
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/learn";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}
