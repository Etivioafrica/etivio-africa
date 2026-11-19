import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Result } from "../helpers/fake-supabase";
import { UUID, json, post, req } from "../helpers/request";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/blog-server", async (original) => ({ ...(await original<typeof import("@/lib/blog-server")>()), livePostId: vi.fn() }));

import { livePostId } from "@/lib/blog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "@/app/api/blog/likes/route";

const FP = "fingerprint-abc-123";
const likedRow = { post_id: UUID };

// state() reads the like count, then whether this fingerprint liked it: two queries on blog_likes, in that order.
const state = (count: number, liked: boolean): Result[] => [{ count }, { data: liked ? likedRow : null }];

function setup(blog_likes: Result[]) {
  const db = fakeClient({ blog_likes });
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  vi.mocked(livePostId).mockResolvedValue(UUID);
  return db;
}

describe("GET /api/blog/likes", () => {
  beforeEach(() => vi.mocked(livePostId).mockReset());

  it("returns the like count and whether this browser liked the post", async () => {
    setup(state(7, true));
    const res = await GET(req(`/api/blog/likes?postId=${UUID}&fp=${FP}`));
    expect(await json(res)).toEqual({ count: 7, liked: true });
  });

  it("reports liked: false for a browser that hasn't liked it", async () => {
    setup(state(7, false));
    expect(await json(await GET(req(`/api/blog/likes?postId=${UUID}&fp=${FP}`)))).toEqual({ count: 7, liked: false });
  });

  it("reports zero likes for a post with none", async () => {
    setup(state(0, false));
    expect(await json(await GET(req(`/api/blog/likes?postId=${UUID}&fp=${FP}`)))).toEqual({ count: 0, liked: false });
  });

  it.each([["&fp=short"], ["&fp=has spaces here"], ["&fp="], [""]])("answers an empty state (not an error) for a bad fingerprint %j, without querying", async (fp) => {
    const db = setup(state(7, true));
    const res = await GET(req(`/api/blog/likes?postId=${UUID}${fp}`));
    expect(await json(res)).toEqual({ count: 0, liked: false });
    expect(db.calls).toHaveLength(0);
  });

  it("answers an empty state for a post that isn't published", async () => {
    const db = setup(state(7, true));
    vi.mocked(livePostId).mockResolvedValue(null);
    expect(await json(await GET(req(`/api/blog/likes?postId=${UUID}&fp=${FP}`)))).toEqual({ count: 0, liked: false });
    expect(db.calls).toHaveLength(0);
  });
});

describe("POST /api/blog/likes (toggle)", () => {
  beforeEach(() => vi.mocked(livePostId).mockReset());
  const toggle = (body: unknown = { postId: UUID, fp: FP }) => POST(post("/api/blog/likes", { body }));

  describe("happy path", () => {
    it("adds a like when this browser hasn't liked the post, and returns the new state", async () => {
      // before: 4 likes, not liked | write | after: 5 likes, liked
      const db = setup([...state(4, false), {}, ...state(5, true)]);

      const res = await toggle();

      expect(await json(res)).toEqual({ count: 5, liked: true });
      expect(db.argsOf("blog_likes", "insert")).toEqual([[{ post_id: UUID, fingerprint: FP }]]);
      expect(db.did("blog_likes", "delete")).toBe(false);
    });

    it("removes the like when this browser already liked the post", async () => {
      const db = setup([...state(5, true), {}, ...state(4, false)]);

      const res = await toggle();

      expect(await json(res)).toEqual({ count: 4, liked: false });
      expect(db.did("blog_likes", "delete")).toBe(true);
      expect(db.did("blog_likes", "insert")).toBe(false);
    });
  });

  describe("error handling & security", () => {
    it.each([[{ postId: UUID }], [{ postId: UUID, fp: "short" }], [{ postId: UUID, fp: 12345678 }], [{ postId: UUID, fp: "<script>alert(1)</script>" }], [{}]])("returns 404 and writes nothing for the body %j", async (body) => {
      const db = setup(state(1, false));
      const res = await toggle(body);
      expect(res.status).toBe(404);
      expect(db.did("blog_likes", "insert")).toBe(false);
    });

    it("returns 404 for a post that isn't published", async () => {
      const db = setup(state(1, false));
      vi.mocked(livePostId).mockResolvedValue(null);
      expect((await toggle()).status).toBe(404);
      expect(db.calls).toHaveLength(0);
    });

    it("only ever deletes this browser's own like (scoped by post and fingerprint)", async () => {
      const db = setup([...state(5, true), {}, ...state(4, false)]);
      await toggle();
      const del = db.on("blog_likes").find((c) => c.ops.some(([m]) => m === "delete"))!;
      expect(del.ops.filter(([m]) => m === "eq").map(([, args]) => args)).toEqual([["post_id", UUID], ["fingerprint", FP]]);
    });

    it("treats invalid JSON as a bad request, not a server error", async () => {
      setup(state(0, false));
      vi.mocked(livePostId).mockResolvedValue(null);
      expect((await POST(post("/api/blog/likes", { raw: "{oops" }))).status).toBe(404);
    });
  });
});
