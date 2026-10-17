import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIXES = ["/learn", "/teach", "/settings", "/support"];

// Carry refreshed auth cookies over to a redirect response.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
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

  // Refreshes the session cookie. Do not put logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optimistic routing only. Layouts and Server Actions re-check the session.
  const path = request.nextUrl.pathname;
  const isApp = APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = path === "/login" || path === "/signup";
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
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/learn";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}
