import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/fake-supabase";
import { UUID } from "../helpers/request";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { livePostId, readJson, validFingerprint } from "@/lib/blog-server";

const admin = vi.mocked(createAdminClient);

describe("livePostId", () => {
  beforeEach(() => admin.mockReset());

  it("returns the id when it belongs to a published post", async () => {
    const db = fakeClient({ blog_posts: [{ data: { id: UUID } }] });
    admin.mockReturnValue(db as never);

    expect(await livePostId(UUID)).toBe(UUID);
    expect(db.argsOf("blog_posts", "neq")).toEqual([["status", "draft"]]);
  });

  it("returns null for a draft, scheduled or unknown post (no row back)", async () => {
    admin.mockReturnValue(fakeClient({ blog_posts: [{ data: null }] }) as never);
    expect(await livePostId(UUID)).toBeNull();
  });

  it.each([[undefined], [null], [42], [{}], [["x"]], [""], ["not-a-uuid"], [UUID + "x"], ["123e4567-e89b-42d3-a456-42661417400g"]])("returns null without touching the database for %j", async (bad) => {
    expect(await livePostId(bad)).toBeNull();
    expect(admin).not.toHaveBeenCalled();
  });

  it("accepts an upper-case UUID", async () => {
    admin.mockReturnValue(fakeClient({ blog_posts: [{ data: { id: UUID.toUpperCase() } }] }) as never);
    expect(await livePostId(UUID.toUpperCase())).toBe(UUID.toUpperCase());
  });
});

describe("readJson", () => {
  const body = (text: string) => new Request("https://etivio.test/x", { method: "POST", body: text });

  it("parses a JSON object", async () => {
    expect(await readJson(body('{"a":1,"b":"two"}'))).toEqual({ a: 1, b: "two" });
  });

  it.each([[""], ["not json"], ["{broken"], ["null"], ["42"], ['"string"'], ["true"]])("returns {} for %j", async (text) => {
    expect(await readJson(body(text))).toEqual({});
  });

  it("returns {} for a body over 10,000 characters instead of parsing it", async () => {
    const big = JSON.stringify({ x: "a".repeat(10_001) });
    expect(await readJson(body(big))).toEqual({});
  });

  it("still parses a body just under the limit", async () => {
    const ok = JSON.stringify({ x: "a".repeat(9_900) });
    expect(Object.keys(await readJson(body(ok)))).toEqual(["x"]);
  });
});

describe("validFingerprint", () => {
  it.each([["abcdefgh"], ["ABCD-1234-efgh"], ["a".repeat(64)], [UUID]])("accepts %s", (fp) => expect(validFingerprint(fp)).toBe(true));

  it.each([[undefined], [null], [123], [""], ["short"], ["a".repeat(65)], ["has space!"], ["semi;colon1"], ["<script>1</script>"], ["under_score"]])("rejects %j", (fp) => expect(validFingerprint(fp)).toBe(false));
});
