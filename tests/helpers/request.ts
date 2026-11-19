import { NextRequest } from "next/server";

type Init = { method?: string; headers?: Record<string, string>; body?: unknown; raw?: string; cookies?: Record<string, string> };

/** Builds a NextRequest. `body` is JSON-encoded; use `raw` to send an exact string (bad JSON, signed payloads). */
export function req(url: string, { method = "GET", headers = {}, body, raw, cookies }: Init = {}) {
  const h = new Headers(headers);
  if (cookies) h.set("cookie", Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "));
  const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
  if (payload !== undefined && !h.has("content-type")) h.set("content-type", "application/json");
  return new NextRequest(new URL(url, "https://etivio.test"), { method, headers: h, body: payload });
}

export const post = (url: string, init: Init = {}) => req(url, { ...init, method: "POST" });

export const json = async (res: Response) => res.json() as Promise<Record<string, unknown>>;

export const UUID = "123e4567-e89b-42d3-a456-426614174000";
