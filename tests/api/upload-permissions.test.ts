import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient } from "../helpers/fake-supabase";
import { json } from "../helpers/request";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/moderation", () => ({ checkImage: vi.fn(), giveStrike: vi.fn() }));
vi.mock("sharp", () => ({ default: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  UPLOAD_KINDS: {
    cover: { folder: "covers", maxMb: 10 },
    avatar: { folder: "avatars", maxMb: 5 },
    post: { folder: "posts", maxMb: 10 },
    banner: { folder: "banners", maxMb: 5 },
    blog: { folder: "blog", maxMb: 10 },
    video: { folder: "videos", maxMb: 2048 },
    document: { folder: "documents", maxMb: 200 },
    product: { folder: "products", maxMb: 200 },
  },
}));

import { createClient } from "@/lib/supabase/server";
import { uploader } from "@/lib/upload-server";

const ACTIVE = { status: "active", deleted_at: null };
type Roles = string[];
function signedInAs(roles: Roles, profile: unknown = ACTIVE) {
  vi.mocked(createClient).mockResolvedValue(fakeAuthClient({ id: "user-1" }, { user_roles: [{ data: roles.map((role) => ({ role })) }] }, { my_profile: { data: profile } }) as never);
}

// Who may upload what. This is the permission matrix behind /api/upload/sign and /api/upload/finish.
describe("uploader(kind): permission matrix", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  describe("happy path", () => {
    it.each(["avatar", "post", "banner"])("lets any active signed-in member upload a %s", async (kind) => {
      signedInAs([]);
      expect(await uploader(kind)).toEqual({ userId: "user-1", kind });
    });

    it.each(["cover", "video", "product", "document"])("lets a tutor upload a %s", async (kind) => {
      signedInAs(["tutor"]);
      expect(await uploader(kind)).toEqual({ userId: "user-1", kind });
    });

    it("lets an editor upload blog images", async () => {
      signedInAs(["editor"]);
      expect(await uploader("blog")).toEqual({ userId: "user-1", kind: "blog" });
    });

    it.each(["cover", "avatar", "post", "banner", "blog", "video", "document", "product"])("lets a super admin upload a %s", async (kind) => {
      signedInAs(["super_admin"]);
      expect(await uploader(kind)).toMatchObject({ userId: "user-1", kind });
    });
  });

  describe("edge cases", () => {
    it("combines roles: a member who is both tutor and editor can upload both kinds", async () => {
      signedInAs(["tutor", "editor"]);
      expect(await uploader("video")).toMatchObject({ kind: "video" });
      expect(await uploader("blog")).toMatchObject({ kind: "blog" });
    });

    it("treats a missing role list as no roles", async () => {
      vi.mocked(createClient).mockResolvedValue(fakeAuthClient({ id: "user-1" }, { user_roles: [{ data: null }] }, { my_profile: { data: ACTIVE } }) as never);
      expect(await uploader("avatar")).toMatchObject({ kind: "avatar" });
      expect(await uploader("video")).toHaveProperty("response");
    });
  });

  describe("error handling & security", () => {
    it.each([[""], ["unknown"], ["AVATAR"], ["__proto__"], ["constructor"], ["toString"]])("rejects the unknown upload type %j with 400 before any auth call", async (kind) => {
      const out = await uploader(kind);
      expect(out).toHaveProperty("response");
      const res = (out as { response: Response }).response;
      expect(res.status).toBe(400);
      expect(await json(res)).toEqual({ error: "Unknown upload type." });
      expect(createClient).not.toHaveBeenCalled();
    });

    it("returns 401 when nobody is signed in", async () => {
      vi.mocked(createClient).mockResolvedValue(fakeAuthClient(null) as never);
      const res = ((await uploader("avatar")) as { response: Response }).response;
      expect(res.status).toBe(401);
      expect(await json(res)).toEqual({ error: "Sign in to upload." });
    });

    it("returns 503 (not 401) when the auth server could not be reached, so people aren't told they're signed out", async () => {
      vi.mocked(createClient).mockResolvedValue(fakeAuthClient(null, {}, {}, { status: 0 }) as never);
      const res = ((await uploader("avatar")) as { response: Response }).response;
      expect(res.status).toBe(503);
    });

    it.each(["cover", "video", "product", "document", "blog"])("returns 403 when a plain member tries to upload a %s", async (kind) => {
      signedInAs([]);
      const res = ((await uploader(kind)) as { response: Response }).response;
      expect(res.status).toBe(403);
      expect(await json(res)).toEqual({ error: "You can't upload this type of file." });
    });

    it("does not let an editor upload tutor-only kinds, or a tutor upload blog images", async () => {
      signedInAs(["editor"]);
      expect(await uploader("video")).toHaveProperty("response");
      signedInAs(["tutor"]);
      expect(await uploader("blog")).toHaveProperty("response");
    });

    it.each([["suspended"], ["banned"], ["pending"], [undefined]])("blocks everything, even avatars, for an account with status %s", async (status) => {
      signedInAs(["super_admin"], { status, deleted_at: null });
      expect(((await uploader("avatar")) as { response: Response }).response.status).toBe(403);
    });

    it("blocks a deleted account even when its status is still 'active'", async () => {
      signedInAs(["super_admin"], { status: "active", deleted_at: "2026-01-01T00:00:00Z" });
      expect(((await uploader("avatar")) as { response: Response }).response.status).toBe(403);
    });

    it("blocks a user with no profile row", async () => {
      signedInAs(["super_admin"], null);
      expect(((await uploader("avatar")) as { response: Response }).response.status).toBe(403);
    });
  });
});
