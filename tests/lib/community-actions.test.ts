import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/fake-supabase";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/data/features", () => ({ featureOn: vi.fn(async () => true) }));
vi.mock("@/lib/moderation", () => ({ moderate: vi.fn() }));
vi.mock("@/lib/access", () => ({ activeAccess: vi.fn(() => "") }));
vi.mock("@/lib/r2", () => ({ keyFromUrl: vi.fn((u: string | null) => (u && u.startsWith("https://cdn.test/") ? u.slice(17) : null)) }));
vi.mock("@/lib/data/communities", async (orig) => ({ ...(await orig<typeof import("@/lib/data/communities")>()), getCommunity: vi.fn(), communityFeed: vi.fn() }));

import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderate } from "@/lib/moderation";
import { communityFeed, getCommunity } from "@/lib/data/communities";
import { createPost, editComment, editPost, loadMorePosts, removeMember, setModerator, updateRules } from "@/app/(app)/communities/actions";

const admin = vi.mocked(createAdminClient);
const me = { id: "u-me", name: "Me", roles: [] as string[] };
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

type Role = "owner" | "moderator" | "member";
const community = (role: Role | null, over: Record<string, unknown> = {}) =>
  ({ id: "c1", slug: "club", name: "Club", join_mode: "open", mine: role ? { role, status: "active" } : null, isMember: Boolean(role), canModerate: role === "owner" || role === "moderator", ...over }) as never;

const passed = () => ({ hold: false, record: vi.fn(async () => {}) });

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(me as never);
  vi.mocked(moderate).mockResolvedValue(passed());
});

describe("createPost", () => {
  it("keeps a picture from our storage and a valid category", async () => {
    const db = fakeClient({ community_posts: [{ data: { id: "p1" } }] });
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    await createPost(null, fd({ slug: "club", body: "Look at this", image_url: "https://cdn.test/posts/a.png", category: "win" }));
    expect(db.argsOf("community_posts", "insert")[0][0]).toMatchObject({ image_url: "https://cdn.test/posts/a.png", category: "win" });
  });

  it("drops a picture from anywhere else and an unknown category", async () => {
    const db = fakeClient({ community_posts: [{ data: { id: "p1" } }] });
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    await createPost(null, fd({ slug: "club", body: "Hello there", image_url: "https://evil.test/x.png", category: "constructor" }));
    expect(db.argsOf("community_posts", "insert")[0][0]).toMatchObject({ image_url: null, category: "discussion" });
  });

  it("refuses a non-member", async () => {
    admin.mockReturnValue(fakeClient() as never);
    vi.mocked(getCommunity).mockResolvedValue(community(null));
    expect(await createPost(null, fd({ slug: "club", body: "Hello there" }))).toEqual({ error: "Join the community to post." });
  });
});

describe("editPost", () => {
  const postRow = (author: string) => ({ community_posts: [{ data: { id: "p1", author_id: author, community: { slug: "club" } } }, { error: null }] });

  it("lets the author edit, marks it edited and checks the new text", async () => {
    const db = fakeClient(postRow(me.id));
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    expect(await editPost("p1", "  better text  ")).toEqual({ ok: "Saved." });
    const patch = db.argsOf("community_posts", "update")[0][0] as Record<string, unknown>;
    expect(patch.body).toBe("better text");
    expect(patch.edited_at).toEqual(expect.any(String));
    expect(patch).not.toHaveProperty("hidden");
    expect(moderate).toHaveBeenCalledWith("community_post", me.id, ["better text"], "/communities/club");
  });

  it("puts a post back on hold when the new text is held", async () => {
    const db = fakeClient(postRow(me.id));
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    vi.mocked(moderate).mockResolvedValue({ hold: true, record: vi.fn(async () => {}) });
    await editPost("p1", "something borderline");
    expect(db.argsOf("community_posts", "update")[0][0]).toMatchObject({ hidden: true });
  });

  it("refuses anyone but the author, even a moderator", async () => {
    const db = fakeClient(postRow("someone-else"));
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("owner"));
    expect(await editPost("p1", "hijacked")).toEqual({ error: "You can only edit your own posts." });
    expect(db.did("community_posts", "update")).toBe(false);
  });

  it("returns the moderation error and saves nothing", async () => {
    const db = fakeClient(postRow(me.id));
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    vi.mocked(moderate).mockResolvedValue({ hold: false, error: "Not allowed.", record: vi.fn(async () => {}) });
    expect(await editPost("p1", "bad words")).toEqual({ error: "Not allowed." });
    expect(db.did("community_posts", "update")).toBe(false);
  });

  it("needs at least two characters", async () => {
    admin.mockReturnValue(fakeClient(postRow(me.id)) as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    expect(await editPost("p1", " a ")).toEqual({ error: "Write something first." });
  });
});

describe("editComment", () => {
  it("refuses a comment someone else wrote", async () => {
    const db = fakeClient({ community_comments: [{ data: { id: "k1", author_id: "other", post: { id: "p1" } } }] });
    admin.mockReturnValue(db as never);
    expect(await editComment("k1", "mine now")).toEqual({ error: "You can only edit your own comments." });
    expect(db.did("community_comments", "update")).toBe(false);
  });

  it("saves the author's edit", async () => {
    const db = fakeClient({
      community_comments: [{ data: { id: "k1", author_id: me.id, post: { id: "p1" } } }, { error: null }],
      community_posts: [{ data: { id: "p1", author_id: "x", community: { slug: "club" } } }],
    });
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    const res = await editComment("k1", " fixed ");
    expect(res).toMatchObject({ ok: "Saved.", body: "fixed" });
    expect(db.argsOf("community_comments", "update")[0][0]).toMatchObject({ body: "fixed" });
  });
});

describe("loadMorePosts", () => {
  it("returns nothing to a non-member", async () => {
    admin.mockReturnValue(fakeClient() as never);
    vi.mocked(getCommunity).mockResolvedValue(community(null));
    expect(await loadMorePosts("club", "2026-01-01T00:00:00Z")).toEqual({ posts: [], hasMore: false });
    expect(communityFeed).not.toHaveBeenCalled();
  });

  it("ignores a cursor that isn't a date", async () => {
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    expect(await loadMorePosts("club", "not-a-date")).toEqual({ posts: [], hasMore: false });
    expect(communityFeed).not.toHaveBeenCalled();
  });

  it("passes a valid category and drops an unknown one", async () => {
    vi.mocked(getCommunity).mockResolvedValue(community("member"));
    vi.mocked(communityFeed).mockResolvedValue({ posts: [], hasMore: false });
    await loadMorePosts("club", "2026-01-01T00:00:00Z", "win");
    await loadMorePosts("club", "2026-01-01T00:00:00Z", "__proto__");
    expect(vi.mocked(communityFeed).mock.calls.map((c) => c[3]?.category)).toEqual(["win", undefined]);
  });
});

describe("updateRules", () => {
  it("is for the owner only", async () => {
    const db = fakeClient();
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("moderator"));
    expect(await updateRules(null, fd({ slug: "club", rules: "Be kind" }))).toEqual({ error: "Only the owner can change the rules." });
    expect(db.did("communities", "update")).toBe(false);
  });

  it("saves the rules, and clears them when empty", async () => {
    const db = fakeClient({ communities: [{ error: null }] });
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community("owner"));
    expect(await updateRules(null, fd({ slug: "club", rules: "Be kind" }))).toEqual({ ok: "Rules saved." });
    await updateRules(null, fd({ slug: "club", rules: "   " }));
    expect(db.argsOf("communities", "update").map((a) => a[0])).toEqual([{ rules: "Be kind" }, { rules: null }]);
  });
});

describe("removeMember", () => {
  const run = async (role: Role | null, target: { role: Role } | null, targetId = "u-x") => {
    const db = fakeClient({ community_members: [{ data: target }, { error: null }] });
    admin.mockReturnValue(db as never);
    vi.mocked(getCommunity).mockResolvedValue(community(role));
    await removeMember(fd({ slug: "club", user_id: targetId }));
    return db;
  };

  it("lets a moderator ban an ordinary member", async () => {
    const db = await run("moderator", { role: "member" });
    expect(db.argsOf("community_members", "update")[0][0]).toEqual({ status: "banned", role: "member" });
  });

  it("stops a moderator banning another moderator, but not the owner", async () => {
    expect((await run("moderator", { role: "moderator" })).did("community_members", "update")).toBe(false);
    expect((await run("owner", { role: "moderator" })).did("community_members", "update")).toBe(true);
  });

  it("never touches the owner, yourself, or acts for an ordinary member", async () => {
    expect((await run("owner", { role: "owner" })).did("community_members", "update")).toBe(false);
    expect((await run("moderator", { role: "member" }, me.id)).did("community_members", "update")).toBe(false);
    expect((await run("member", { role: "member" })).did("community_members", "update")).toBe(false);
  });
});

describe("setModerator", () => {
  it("lets only the owner change roles, and never the owner's own", async () => {
    const asModerator = fakeClient({ community_members: [{ error: null }] });
    admin.mockReturnValue(asModerator as never);
    vi.mocked(getCommunity).mockResolvedValue(community("moderator"));
    await setModerator(fd({ slug: "club", user_id: "u-x", make: "1" }));
    expect(asModerator.did("community_members", "update")).toBe(false);

    const asOwner = fakeClient({ community_members: [{ error: null }] });
    admin.mockReturnValue(asOwner as never);
    vi.mocked(getCommunity).mockResolvedValue(community("owner"));
    await setModerator(fd({ slug: "club", user_id: "u-x", make: "1" }));
    expect(asOwner.argsOf("community_members", "update")[0][0]).toEqual({ role: "moderator" });
    expect(asOwner.argsOf("community_members", "neq")).toEqual([["role", "owner"]]);
  });
});
