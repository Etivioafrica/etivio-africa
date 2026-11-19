import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { json, post } from "../helpers/request";

vi.mock("@/lib/upload-server", () => ({ uploader: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  INCOMING: "incoming",
  UPLOAD_KINDS: { avatar: { folder: "avatars", maxMb: 5 }, product: { folder: "products", maxMb: 200 }, video: { folder: "videos", maxMb: 2048 } },
  signedUploadUrl: vi.fn(),
}));

import { signedUploadUrl } from "@/lib/r2";
import { uploader } from "@/lib/upload-server";
import { POST } from "@/app/api/upload/sign/route";

const who = vi.mocked(uploader);
const sign = vi.mocked(signedUploadUrl);
const MB = 1024 * 1024;

const call = (body: unknown, raw?: string) => POST(post("/api/upload/sign", raw !== undefined ? { raw } : { body }));
const as = (kind: string, userId = "user-1") => who.mockResolvedValue({ userId, kind } as never);

describe("POST /api/upload/sign", () => {
  beforeEach(() => {
    as("avatar");
    sign.mockResolvedValue("https://r2.test/put?sig=abc");
  });

  describe("happy path", () => {
    it("returns a signed upload URL and a key under incoming/<user>/<uuid>", async () => {
      const res = await call({ kind: "avatar", name: "me.png", size: 1 * MB });

      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.url).toBe("https://r2.test/put?sig=abc");
      expect(body.key).toMatch(/^incoming\/user-1\/[0-9a-f-]{36}$/);
      expect(sign).toHaveBeenCalledWith(body.key);
    });

    it("hands out a different key every time (no overwriting someone's pending upload)", async () => {
      const a = await json(await call({ kind: "avatar", name: "a.png", size: 100 }));
      const b = await json(await call({ kind: "avatar", name: "a.png", size: 100 }));
      expect(a.key).not.toBe(b.key);
    });

    it("scopes the key to the authenticated user, not anything in the request body", async () => {
      as("avatar", "real-user");
      const res = await call({ kind: "avatar", name: "a.png", size: 100, userId: "someone-else", key: "incoming/someone-else/x" });
      expect((await json(res)).key).toMatch(/^incoming\/real-user\//);
    });
  });

  describe("edge cases", () => {
    it("accepts a file of exactly the maximum size", async () => {
      expect((await call({ kind: "avatar", name: "a.png", size: 5 * MB })).status).toBe(200);
    });

    it("rejects a file one byte over the maximum with 413 and the limit in the message", async () => {
      const res = await call({ kind: "avatar", name: "a.png", size: 5 * MB + 1 });
      expect(res.status).toBe(413);
      expect((await json(res)).error).toMatch(/up to 5 MB/);
      expect(sign).not.toHaveBeenCalled();
    });

    it.each([[0], [-1], [undefined], [null], [Number.NaN]])("rejects an empty or missing size (%s) with 400", async (size) => {
      const res = await call({ kind: "avatar", name: "a.png", size });
      expect(res.status).toBe(400);
      expect(await json(res)).toEqual({ error: "Empty upload." });
    });

    it("defaults the name to 'file' when none is sent; with no extension to judge, the content check at finish decides", async () => {
      const res = await call({ kind: "avatar", size: 100 });
      expect(res.status).toBe(200);
    });

    it("treats an unreadable JSON body as an unknown upload type", async () => {
      who.mockResolvedValue({ response: NextResponse.json({ error: "Unknown upload type." }, { status: 400 }) } as never);
      const res = await call(undefined, "{not json");
      expect(res.status).toBe(400);
      expect(who).toHaveBeenCalledWith("undefined");
    });
  });

  describe("error handling & security", () => {
    it("passes through the uploader's response when the person isn't allowed (401/403/503)", async () => {
      who.mockResolvedValue({ response: NextResponse.json({ error: "Sign in to upload." }, { status: 401 }) } as never);
      const res = await call({ kind: "avatar", name: "a.png", size: 100 });
      expect(res.status).toBe(401);
      expect(sign).not.toHaveBeenCalled();
    });

    it.each([["setup.exe"], ["page.html"], ["logo.svg"], ["script.js"], ["run.sh"]])("refuses to sign an upload named %s with 415", async (name) => {
      as("product");
      const res = await call({ kind: "product", name, size: 100 });
      expect(res.status).toBe(415);
      expect((await json(res)).error).toMatch(/can't be uploaded/);
      expect(sign).not.toHaveBeenCalled();
    });

    it("refuses a name whose extension is wrong for the kind (a PDF as an avatar)", async () => {
      as("avatar");
      const res = await call({ kind: "avatar", name: "cv.pdf", size: 100 });
      expect(res.status).toBe(415);
      expect((await json(res)).error).toMatch(/isn't accepted here/);
    });

    it("checks the size limit of the kind the uploader approved, not the kind the body claims", async () => {
      as("avatar"); // approved for avatar (5 MB) even though the body asks for video (2 GB)
      const res = await call({ kind: "video", name: "big.png", size: 100 * MB });
      expect(res.status).toBe(413);
    });

    it("truncates absurdly long names to 200 characters instead of failing (the extension is cut off, so the content check decides)", async () => {
      const res = await call({ kind: "avatar", name: "a".repeat(5000) + ".png", size: 100 });
      expect(res.status).toBe(200);
    });

    it("lets a signing failure surface instead of returning a broken URL", async () => {
      sign.mockRejectedValue(new Error("R2 unavailable"));
      await expect(call({ kind: "avatar", name: "a.png", size: 100 })).rejects.toThrow("R2 unavailable");
    });
  });
});
