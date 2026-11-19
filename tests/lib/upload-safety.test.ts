import { describe, expect, it } from "vitest";
import { acceptFor, checkName, checkUpload, extOf } from "@/lib/upload-safety";

// Files are identified by their first bytes, never by name or the type the browser claims.
const bytes = (...n: number[]) => Uint8Array.from(n);
const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PDF = ascii("%PDF-1.7\n");
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

describe("extOf", () => {
  it("lower-cases the extension", () => expect(extOf("Photo.JPG")).toBe("jpg"));
  it("uses only the last extension", () => expect(extOf("archive.tar.gz")).toBe("gz"));
  it("returns empty for no extension, a trailing dot, or a dotfile", () => {
    expect(extOf("README")).toBe("");
    expect(extOf("name.")).toBe("");
    expect(extOf(".env")).toBe("");
  });
});

describe("checkName (quick check before any bytes are sent)", () => {
  describe("happy path", () => {
    it("allows an image name for an avatar", () => expect(checkName("avatar", "me.png")).toBeNull());
    it("allows a PDF name for a product", () => expect(checkName("product", "guide.pdf")).toBeNull());
    it("allows a video name for the video kind", () => expect(checkName("video", "lesson.mp4")).toBeNull());
  });

  describe("edge cases", () => {
    it("allows a name with no extension (content is checked later)", () => expect(checkName("avatar", "photo")).toBeNull());
    it("is case-insensitive about the extension", () => expect(checkName("avatar", "ME.PNG")).toBeNull());
    it("judges by the last extension only, so 'evil.php.jpg' passes the name check", () => expect(checkName("avatar", "evil.php.jpg")).toBeNull());
  });

  describe("error handling & security", () => {
    it.each(["exe", "bat", "js", "html", "svg", "ps1", "sh", "apk", "iso", "xml"])("always blocks .%s, whatever the kind", (ext) => {
      expect(checkName("product", `file.${ext}`)).toMatch(new RegExp(`\\.${ext} files can't be uploaded`));
    });

    it("blocks SVG for an avatar (SVG can carry scripts)", () => expect(checkName("avatar", "logo.svg")).toMatch(/can't be uploaded/));
    it("rejects a PDF for an avatar", () => expect(checkName("avatar", "cv.pdf")).toMatch(/isn't accepted here/));
    it("rejects an audio file for the video kind", () => expect(checkName("video", "song.mp3")).toMatch(/isn't accepted here/));
    it("lists the allowed extensions in the message", () => expect(checkName("avatar", "cv.pdf")).toMatch(/Allowed: jpg, jpeg, png, gif, webp, avif/));
  });
});

describe("checkUpload (name + real content + kind)", () => {
  describe("happy path", () => {
    it("accepts a real PNG named .png as an avatar", () => {
      expect(checkUpload("avatar", "me.png", PNG)).toEqual({ ok: true, family: "image", type: "image/png", ext: "png" });
    });

    it("accepts a real JPEG named .jpeg", () => {
      expect(checkUpload("cover", "cover.jpeg", JPEG)).toMatchObject({ ok: true, type: "image/jpeg", ext: "jpeg" });
    });

    it("accepts a real PDF as a product file", () => {
      expect(checkUpload("product", "guide.pdf", PDF)).toMatchObject({ ok: true, family: "pdf", type: "application/pdf" });
    });

    it("tells a .docx from a plain zip by its extension", () => {
      expect(checkUpload("document", "essay.docx", ZIP)).toMatchObject({ ok: true, family: "office" });
      expect(checkUpload("document", "bundle.zip", ZIP)).toMatchObject({ ok: true, family: "zip" });
    });

    it("accepts an .epub as a product but not as a generic document", () => {
      expect(checkUpload("product", "book.epub", ZIP)).toMatchObject({ ok: true, family: "epub" });
      expect(checkUpload("document", "book.epub", ZIP)).toMatchObject({ ok: false });
    });

    it("accepts plain UTF-8 text as a csv", () => {
      expect(checkUpload("document", "scores.csv", ascii("name,score\nada,10\n"))).toMatchObject({ ok: true, family: "text", type: "text/csv" });
    });
  });

  describe("edge cases", () => {
    it("fills in the real extension when the name has none", () => {
      expect(checkUpload("avatar", "photo", PNG)).toMatchObject({ ok: true, ext: "png" });
    });

    it("rejects an empty file as unrecognisable", () => {
      expect(checkUpload("avatar", "empty.png", new Uint8Array())).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't recognise/) });
    });

    it("rejects random bytes as unrecognisable", () => {
      expect(checkUpload("avatar", "x.png", bytes(1, 2, 3, 4, 5, 6))).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't recognise/) });
    });

    it("does not treat text containing NUL bytes as a text file", () => {
      expect(checkUpload("document", "notes.txt", bytes(0x68, 0x69, 0x00, 0x21))).toMatchObject({ ok: false });
    });

    it("rejects invalid UTF-8 posing as a text file", () => {
      expect(checkUpload("document", "notes.txt", bytes(0xc3, 0x28))).toMatchObject({ ok: false });
    });
  });

  describe("error handling & security", () => {
    it("rejects a PDF renamed .jpg and says what it really is", () => {
      expect(checkUpload("product", "photo.jpg", PDF)).toMatchObject({ ok: false, error: expect.stringMatching(/really a PDF/) });
    });

    it("rejects a PNG renamed .pdf", () => {
      expect(checkUpload("product", "doc.pdf", PNG)).toMatchObject({ ok: false, error: expect.stringMatching(/really an image/) });
    });

    it("rejects a real PDF for an avatar (wrong kind)", () => {
      expect(checkUpload("avatar", "cv.pdf", PDF)).toMatchObject({ ok: false, error: expect.stringMatching(/isn't accepted here/) });
    });

    it("catches a Windows program (MZ) disguised as a .jpg", () => {
      expect(checkUpload("avatar", "cute.jpg", bytes(0x4d, 0x5a, 0x90, 0x00))).toMatchObject({ ok: false, error: expect.stringMatching(/Windows program/) });
    });

    it("catches a Linux ELF binary", () => {
      expect(checkUpload("product", "tool.pdf", bytes(0x7f, 0x45, 0x4c, 0x46))).toMatchObject({ ok: false, error: expect.stringMatching(/Linux program/) });
    });

    it("catches a Mac Mach-O binary", () => {
      expect(checkUpload("product", "tool.pdf", bytes(0xcf, 0xfa, 0xed, 0xfe))).toMatchObject({ ok: false, error: expect.stringMatching(/Mac program/) });
    });

    it("catches a shell script (#!) disguised as text", () => {
      expect(checkUpload("document", "notes.txt", ascii("#!/bin/sh\nrm -rf /\n"))).toMatchObject({ ok: false, error: expect.stringMatching(/a script/) });
    });

    it.each([
      ["<html><script>alert(1)</script></html>"],
      ["<!DOCTYPE html><body>hi</body>"],
      ['<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
      ["  \n<?xml version='1.0'?><x/>"],
      ["<IFRAME src=//evil></IFRAME>"],
    ])("catches HTML/SVG/XML posing as text: %s", (html) => {
      expect(checkUpload("document", "notes.txt", ascii(html))).toMatchObject({ ok: false, error: expect.stringMatching(/web page or SVG/) });
    });

    it("catches an old-format Office file (can't be scanned for macros)", () => {
      expect(checkUpload("document", "old.pdf", bytes(0xd0, 0xcf, 0x11, 0xe0))).toMatchObject({ ok: false, error: expect.stringMatching(/old-format Office/) });
    });

    it("catches RAR and 7z archives", () => {
      expect(checkUpload("product", "a.zip", ascii("Rar!\x1a\x07"))).toMatchObject({ ok: false, error: expect.stringMatching(/RAR or 7z/) });
      expect(checkUpload("product", "a.zip", bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c))).toMatchObject({ ok: false });
    });

    it("blocks a blocked extension even when the bytes look harmless", () => {
      expect(checkUpload("avatar", "avatar.svg", PNG)).toMatchObject({ ok: false, error: expect.stringMatching(/\.svg files can't be uploaded/) });
      expect(checkUpload("product", "setup.exe", PDF)).toMatchObject({ ok: false });
    });
  });
});

describe("acceptFor", () => {
  it("builds the file-picker accept list from the kind's allowed extensions", () => {
    expect(acceptFor("avatar")).toBe(".jpg,.jpeg,.png,.gif,.webp,.avif");
  });
});
