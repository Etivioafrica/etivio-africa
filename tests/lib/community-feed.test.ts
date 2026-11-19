import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/fake-supabase";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { communityFeed } from "@/lib/data/communities";

const admin = vi.mocked(createAdminClient);
const row = (i: number, over: Record<string, unknown> = {}) => ({
  id: `p${i}`,
  body: `post ${i}`,
  image_url: null,
  category: "discussion",
  pinned: false,
  hidden: false,
  created_at: `2026-01-${String(30 - i).padStart(2, "0")}T00:00:00Z`,
  edited_at: null,
  comment_count: 0,
  like_count: 0,
  author_id: "a1",
  author: { full_name: "Ada", avatar_url: null },
  ...over,
});

beforeEach(() => admin.mockReset());

describe("communityFeed", () => {
  it("asks for one extra row to know whether there is another page, and returns only a page", async () => {
    const db = fakeClient({ community_posts: [{ data: [row(1), row(2), row(3)] }], community_likes: [{ data: [] }] });
    admin.mockReturnValue(db as never);
    const res = await communityFeed("c1", "u1", false, { limit: 2 });
    expect(db.argsOf("community_posts", "limit")).toEqual([[3]]);
    expect(res.posts.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(res.hasMore).toBe(true);
  });

  it("reports no more when the last page is short", async () => {
    admin.mockReturnValue(fakeClient({ community_posts: [{ data: [row(1)] }], community_likes: [{ data: [] }] }) as never);
    expect((await communityFeed("c1", "u1", false, { limit: 2 })).hasMore).toBe(false);
  });

  it("continues after a cursor with unpinned posts only", async () => {
    const db = fakeClient({ community_posts: [{ data: [] }] });
    admin.mockReturnValue(db as never);
    await communityFeed("c1", "u1", true, { before: "2026-01-10T00:00:00Z" });
    expect(db.argsOf("community_posts", "lt")).toEqual([["created_at", "2026-01-10T00:00:00Z"]]);
    expect(db.argsOf("community_posts", "eq")).toContainEqual(["pinned", false]);
  });

  it("filters by category, and hides held posts from people who can't see them", async () => {
    const db = fakeClient({ community_posts: [{ data: [] }] });
    admin.mockReturnValue(db as never);
    await communityFeed("c1", "u1", false, { category: "win" });
    expect(db.argsOf("community_posts", "eq")).toContainEqual(["category", "win"]);
    expect(db.argsOf("community_posts", "or")).toEqual([["hidden.eq.false,author_id.eq.u1"]]);
  });

  it("does not filter hidden posts for moderators", async () => {
    const db = fakeClient({ community_posts: [{ data: [] }] });
    admin.mockReturnValue(db as never);
    await communityFeed("c1", "u1", true);
    expect(db.did("community_posts", "or")).toBe(false);
  });

  it("falls back to a plain discussion for an unknown category and marks liked posts", async () => {
    admin.mockReturnValue(fakeClient({ community_posts: [{ data: [row(1, { category: "weird" })] }], community_likes: [{ data: [{ post_id: "p1" }] }] }) as never);
    const { posts } = await communityFeed("c1", "u1", false);
    expect(posts[0]).toMatchObject({ category: "discussion", liked: true });
  });
});
