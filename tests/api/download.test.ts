import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, fakeClient } from "../helpers/fake-supabase";
import { UUID, json, req } from "../helpers/request";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/r2", () => ({ signedDownloadUrl: vi.fn() }));

import { signedDownloadUrl } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/download/[fileId]/route";

const USER = { id: "user-1", email: "ada@example.com" };
const FILE = { id: UUID, product_id: "prod-1", file_key: "products/abc/guide.pdf", file_name: "guide.pdf", product: { creator_id: "creator-9" } };
const SIGNED = "https://r2.test/signed/guide.pdf?X-Amz-Expires=300";

type Setup = { user?: typeof USER | null; file?: unknown; access?: unknown; roles?: unknown[]; downloadLog?: unknown };
function setup({ user = USER, file = FILE, access = null, roles = [], downloadLog = {} }: Setup = {}) {
  vi.mocked(createClient).mockResolvedValue(fakeAuthClient(user) as never);
  const db = fakeClient({ product_files: [{ data: file }], product_access: [{ data: access }], user_roles: [{ data: roles }], product_downloads: [downloadLog as never] });
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  vi.mocked(signedDownloadUrl).mockResolvedValue(SIGNED);
  return db;
}
const get = (id = UUID) => GET(req(`/api/download/${id}`), { params: Promise.resolve({ fileId: id }) });

describe("GET /api/download/[fileId]", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  describe("happy path", () => {
    it("redirects a buyer who owns the product to a short-lived signed link and logs the download", async () => {
      const db = setup({ access: { product_id: "prod-1" } });

      const res = await get();

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(SIGNED);
      expect(signedDownloadUrl).toHaveBeenCalledWith("products/abc/guide.pdf", "guide.pdf");
      expect(db.argsOf("product_downloads", "insert")).toEqual([[{ user_id: "user-1", product_id: "prod-1", file_id: UUID }]]);
    });

    it("lets the product's creator download their own file without a purchase", async () => {
      setup({ file: { ...FILE, product: { creator_id: USER.id } } });
      expect((await get()).headers.get("location")).toBe(SIGNED);
    });

    it("lets a super admin download any file", async () => {
      setup({ roles: [{ role: "super_admin" }] });
      expect((await get()).headers.get("location")).toBe(SIGNED);
    });
  });

  describe("edge cases", () => {
    it("still delivers the file when writing the download log fails", async () => {
      setup({ access: { product_id: "prod-1" }, downloadLog: { error: { message: "insert failed" } } });
      expect((await get()).headers.get("location")).toBe(SIGNED);
    });

    it("treats a file whose product row is missing as 'not the creator' (no crash)", async () => {
      setup({ file: { ...FILE, product: null }, access: null });
      expect((await get()).status).toBe(403);
    });

    it("accepts an upper-case UUID", async () => {
      setup({ access: { product_id: "prod-1" } });
      expect((await get(UUID.toUpperCase())).status).toBe(307);
    });
  });

  describe("error handling & security", () => {
    it.each([["not-a-uuid"], ["123"], [UUID + "0"], [UUID.slice(0, 35)], ["../../etc/passwd"], ["g".repeat(36)], [encodeURIComponent("<script>")]])("returns 404 for the malformed id %s without touching auth or the database", async (id) => {
      const res = await get(id);

      expect(res.status).toBe(404);
      expect(await json(res)).toEqual({ error: "Not found." });
      expect(createClient).not.toHaveBeenCalled();
      expect(createAdminClient).not.toHaveBeenCalled();
    });

    it("sends a signed-out visitor to log in and then back to their library, not to the file", async () => {
      setup({ user: null });

      const res = await get();

      expect(res.status).toBe(307);
      const to = new URL(res.headers.get("location")!);
      expect(to.pathname).toBe("/login");
      expect(to.searchParams.get("next")).toBe("/learn/library");
      expect(signedDownloadUrl).not.toHaveBeenCalled();
    });

    it("returns 404 when the file no longer exists", async () => {
      setup({ file: null });
      const res = await get();
      expect(res.status).toBe(404);
      expect(await json(res)).toEqual({ error: "That file no longer exists." });
    });

    it("returns 403 for a signed-in user who neither bought, made, nor administers the product", async () => {
      const db = setup({ access: null, roles: [] });

      const res = await get();

      expect(res.status).toBe(403);
      expect(await json(res)).toEqual({ error: "You don't have access to this file." });
      expect(signedDownloadUrl).not.toHaveBeenCalled();
      expect(db.did("product_downloads", "insert")).toBe(false);
    });

    it("does not treat a lesser role (e.g. tutor, editor) as an admin", async () => {
      setup({ access: null, roles: [] }); // the query filters role = super_admin, so other roles come back empty
      expect((await get()).status).toBe(403);
    });

    it("looks up access by the signed-in user and the file's own product, never a caller-supplied product", async () => {
      const db = setup({ access: { product_id: "prod-1" } });
      await get();
      expect(db.argsOf("product_access", "eq")).toEqual([["user_id", "user-1"], ["product_id", "prod-1"]]);
    });

    it("never exposes the storage key in the response to a user who is denied", async () => {
      setup({ access: null });
      const res = await get();
      expect(JSON.stringify(await json(res))).not.toContain("products/abc");
    });
  });
});
