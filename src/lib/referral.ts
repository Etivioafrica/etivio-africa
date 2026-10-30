// Invite links: etivio.co/r/<code>, or ?ref=<code> on any page. The code waits in a cookie until the visitor makes an
// account (migration 0060 links them). No server-only imports, so the proxy and the sign-up form can use it.

export const REF_COOKIE = "et_ref";
export const REF_COOKIE_DAYS = 30;
export const REF_CODE = /^[a-z0-9]{4,12}$/;

export const cleanRefCode = (code: string | null | undefined) => {
  const c = (code ?? "").trim().toLowerCase();
  return REF_CODE.test(c) ? c : null;
};

export const refCookieOptions = { path: "/", maxAge: REF_COOKIE_DAYS * 86400, sameSite: "lax" as const };
