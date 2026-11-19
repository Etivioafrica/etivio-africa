import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, fakeClient, type Result } from "../helpers/fake-supabase";
import { UUID, json, post } from "../helpers/request";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/moderation", () => ({ moderate: vi.fn() }));
vi.mock("@/lib/blog-server", async (original) => ({ ...(await original<typeof import("@/lib/blog-server")>()), livePostId: vi.fn() }));

import { livePostId } from "@/lib/blog-server";
import { moderate } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/blog/comments/route";

const record = vi.fn();
const USER = { id: "user-1", email: "ada@example.com" };

type Setup = { user?: typeof USER | null; profile?: Result; recent?: number; insert?: Result; moderation?: { error?: string }; hasEmail?: boolean };
function setup({ user = null, profile = { data: null }, recent = 0, insert = { data: { id: "comment-1" } }, moderation = {}, hasEmail = true }: Setup = {}) {
  vi.mocked(createClient).mockResolvedValue(fakeAuthClient(user) as never);
  // blog_comments is queried for the recent-comment count only when there's an email, then inserted into.
  const db = fakeClient({ profiles: [profile], blog_comments: hasEmail ? [{ count: recent }, insert] : [insert] });
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  vi.mocked(livePostId).mockResolvedValue(UUID);
  vi.mocked(moderate).mockResolvedValue({ ...moderation, record } as never);
  return db;
}
const send = (body: unknown) => POST(post("/api/blog/comments", { body }));
const valid = { postId: UUID, name: "Ada", email: "ada@example.com", content: "Great article, thank you." };

describe("POST /api/blog/comments", () => {
  beforeEach(() => record.mockReset());

  describe("happy path", () => {
    it("stores an anonymous comment (held for approval) and responds 201", async () => {
      const db = setup();

      const res = await send(valid);

      expect(res.status).toBe(201);
      expect(await json(res)).toEqual({ ok: true });
      expect(db.argsOf("blog_comments", "insert")).toEqual([[{ post_id: UUID, user_id: null, author_name: "Ada", author_email: "ada@example.com", content: "Great article, thank you." }]]);
    });

    it("runs moderation on the name and content, then records the new comment id with it", async () => {
      setup();
      await send(valid);
      expect(moderate).toHaveBeenCalledWith("blog_comment", null, ["Ada", "Great article, thank you."], "/admin/blog/comments");
      expect(record).toHaveBeenCalledWith("comment-1");
    });

    it("fills in name and email from the signed-in account when the form leaves them out", async () => {
      const db = setup({ user: USER, profile: { data: { full_name: "Ada Lovelace" } } });

      const res = await send({ postId: UUID, content: "Nice one" });

      expect(res.status).toBe(201);
      expect(db.argsOf("blog_comments", "insert")[0][0]).toMatchObject({ user_id: "user-1", author_name: "Ada Lovelace", author_email: "ada@example.com" });
    });
  });

  describe("edge cases", () => {
    it("accepts a comment without an email and stores null (and skips the per-email rate-limit query)", async () => {
      const db = setup({ hasEmail: false });

      const res = await send({ postId: UUID, name: "Ada", content: "No email here" });

      expect(res.status).toBe(201);
      expect(db.argsOf("blog_comments", "insert")[0][0]).toMatchObject({ author_email: null });
      expect(db.on("blog_comments")).toHaveLength(1);
    });

    it("trims whitespace from name, email and content", async () => {
      const db = setup();
      await send({ postId: UUID, name: "  Ada  ", email: "  ada@example.com ", content: "  hello  " });
      expect(db.argsOf("blog_comments", "insert")[0][0]).toMatchObject({ author_name: "Ada", author_email: "ada@example.com", content: "hello" });
    });

    it("cuts a very long name down to 80 characters", async () => {
      const db = setup();
      await send({ ...valid, name: "x".repeat(200) });
      expect((db.argsOf("blog_comments", "insert")[0][0] as { author_name: string }).author_name).toHaveLength(80);
    });

    it.each([[2], [2000]])("accepts a comment of exactly %i characters", async (n) => {
      setup();
      expect((await send({ ...valid, content: "a".repeat(n) })).status).toBe(201);
    });

    it("allows 4 recent comments from the same email but blocks the 5th within ten minutes", async () => {
      setup({ recent: 4 });
      expect((await send(valid)).status).toBe(201);
      setup({ recent: 5 });
      expect((await send(valid)).status).toBe(429);
    });

    it("treats a body that isn't valid JSON as a request for a post that doesn't exist", async () => {
      vi.mocked(livePostId).mockResolvedValue(null);
      const res = await POST(post("/api/blog/comments", { raw: "{nope" }));
      expect(res.status).toBe(404);
    });
  });

  describe("error handling & security", () => {
    it("silently accepts a filled honeypot field without storing, moderating or even looking up the post", async () => {
      const db = setup();

      const res = await send({ ...valid, website: "http://spam.example" });

      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ ok: true });
      expect(livePostId).not.toHaveBeenCalled();
      expect(db.did("blog_comments", "insert")).toBe(false);
      expect(moderate).not.toHaveBeenCalled();
    });

    it("returns 404 for a post that is a draft, scheduled or missing", async () => {
      setup();
      vi.mocked(livePostId).mockResolvedValue(null);
      const res = await send(valid);
      expect(res.status).toBe(404);
      expect(await json(res)).toEqual({ error: "That post isn't available." });
    });

    it("asks anonymous commenters for a name", async () => {
      setup();
      const res = await send({ ...valid, name: "   " });
      expect(res.status).toBe(400);
      expect(await json(res)).toEqual({ error: "Add your name." });
    });

    it("rejects an empty, one-character or whitespace-only comment", async () => {
      setup();
      for (const content of ["", "a", "   ", " a "]) expect((await send({ ...valid, content })).status).toBe(400);
    });

    it("rejects a comment over 2,000 characters", async () => {
      setup();
      const res = await send({ ...valid, content: "a".repeat(2001) });
      expect(res.status).toBe(400);
      expect((await json(res)).error).toMatch(/under 2,000/);
    });

    it.each([["not-an-email"], ["a@b"], ["@example.com"], ["a b@example.com"], ["ada@example."]])("rejects the malformed email %j", async (email) => {
      setup();
      const res = await send({ ...valid, email });
      expect(res.status).toBe(400);
      expect(await json(res)).toEqual({ error: "That email doesn't look right." });
    });

    it("rate-limits per post and email with 429 and does not store the comment", async () => {
      const db = setup({ recent: 5 });
      const res = await send(valid);
      expect(res.status).toBe(429);
      expect(db.did("blog_comments", "insert")).toBe(false);
      expect(db.argsOf("blog_comments", "eq")).toEqual([["post_id", UUID], ["author_email", "ada@example.com"]]);
    });

    it("rejects a comment moderation blocks with 422 and its message, without storing it", async () => {
      const db = setup({ moderation: { error: "Please keep comments respectful." } });
      const res = await send(valid);
      expect(res.status).toBe(422);
      expect(await json(res)).toEqual({ error: "Please keep comments respectful." });
      expect(db.did("blog_comments", "insert")).toBe(false);
    });

    it("returns a generic 500 when the insert fails, and does not record a moderation entry", async () => {
      setup({ insert: { data: null, error: { message: "duplicate key value violates unique constraint" } } });
      const res = await send(valid);
      expect(res.status).toBe(500);
      expect(JSON.stringify(await json(res))).not.toContain("duplicate key");
      expect(record).not.toHaveBeenCalled();
    });

    it("stores markup as plain text and does not run it (escaping happens at render)", async () => {
      const db = setup();
      await send({ ...valid, content: "<img src=x onerror=alert(1)>" });
      expect(db.argsOf("blog_comments", "insert")[0][0]).toMatchObject({ content: "<img src=x onerror=alert(1)>" });
    });

    it("never takes the author id from the request body", async () => {
      const db = setup({ user: USER });
      await send({ ...valid, user_id: "someone-else", userId: "someone-else" });
      expect(db.argsOf("blog_comments", "insert")[0][0]).toMatchObject({ user_id: "user-1" });
    });
  });
});
