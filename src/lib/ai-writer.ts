import "server-only";
import sharp from "sharp";
import { AI_MODELS, aiImage, aiJson, aiText, promptText, type ChatMessage } from "@/lib/ai";
import { objectKey, putObject } from "@/lib/r2";
import { sanitizeRichText } from "@/lib/sanitize";

// AI writing tools for tutors and admins: course outline, course copy, lesson notes and cover images.

const STYLE =
  "Write in clear, simple, friendly English for African learners (Nigeria first). Be practical and specific. Never use em dashes. Don't invent statistics, prices or quotes.";

export type Outline = { modules: { title: string; lessons: { title: string; summary: string }[] }[] };

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

// Top web results for the topic (titles and snippets), so outlines follow how the subject is really taught.
async function research(topic: string) {
  if (!process.env.FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `${topic} course syllabus`, limit: 6 }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { data?: { web?: { title?: string; description?: string }[] } };
    return (json.data?.web ?? []).map((w) => `- ${clip(w.title, 120)}: ${clip(w.description, 300)}`).join("\n");
  } catch {
    return "";
  }
}

export async function writeOutline(input: { title: string; summary?: string; level: string; audience?: string; modules?: number; useWeb?: boolean }): Promise<Outline> {
  const notes = input.useWeb ? await research(input.title) : "";
  const count = Math.min(10, Math.max(2, input.modules ?? 5));
  const messages: ChatMessage[] = [
    { role: "system", content: `You design online courses. ${STYLE} Reply with JSON only.` },
    {
      role: "user",
      content: [
        `Design the curriculum for a ${input.level} course titled "${clip(input.title, 140)}".`,
        input.summary ? `What it promises: ${clip(input.summary, 400)}` : "",
        input.audience ? `Who it's for: ${clip(input.audience, 200)}` : "",
        notes ? `How other courses on this topic are structured (for reference only, don't copy):\n${notes}` : "",
        `Make ${count} modules in a logical order, each with 3 to 6 short lessons. Lesson titles should say what the learner will do or learn. Give each lesson a one-sentence summary.`,
        `JSON shape: {"modules":[{"title":"","lessons":[{"title":"","summary":""}]}]}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  const raw = await aiJson<Outline>(messages, { maxTokens: 2500 });
  const modules = (raw.modules ?? [])
    .slice(0, 10)
    .map((m) => ({
      title: clip(m.title, 120),
      lessons: (m.lessons ?? []).slice(0, 8).map((l) => ({ title: clip(typeof l === "string" ? l : l.title, 120), summary: clip(typeof l === "string" ? "" : l.summary, 240) })).filter((l) => l.title),
    }))
    .filter((m) => m.title && m.lessons.length);
  if (!modules.length) throw new Error("The AI didn't return an outline. Try again, or add more detail to the title.");
  return { modules };
}

export async function writeCourseCopy(input: { title: string; level: string; outline: string[] }) {
  const raw = await aiJson<{ summary?: string; description?: string; skills?: string[] }>(
    [
      { role: "system", content: `You write course pages that make learners want to enrol, without hype. ${STYLE} Reply with JSON only.` },
      {
        role: "user",
        content: [
          `Course: "${clip(input.title, 140)}" (${input.level}).`,
          input.outline.length ? `Lessons:\n${input.outline.slice(0, 60).map((t) => `- ${clip(t, 120)}`).join("\n")}` : "",
          `Write: "summary", one or two sentences (max 280 characters) on what learners will be able to do after the course; "description", 3 short paragraphs separated by blank lines (who it's for, what they'll learn, how the course works), max 1200 characters, plain text; "skills", 3 to 6 short skill names.`,
          `JSON shape: {"summary":"","description":"","skills":[""]}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    { maxTokens: 1200 },
  );
  return {
    summary: clip(raw.summary, 300),
    description: (typeof raw.description === "string" ? raw.description : "").trim().slice(0, 1500),
    skills: (raw.skills ?? []).map((s) => clip(s, 40)).filter(Boolean).slice(0, 6),
  };
}

// A first draft of a lesson's written notes, as safe HTML for the rich text editor.
export async function writeLessonNotes(input: { courseTitle: string; moduleTitle?: string; lessonTitle: string; level: string; existing?: string }) {
  const text = await aiText(
    [
      { role: "system", content: `You write lesson notes for online courses. ${STYLE} Use simple HTML only: <h3>, <p>, <ul>, <ol>, <li>, <strong>. No other tags, no markdown.` },
      {
        role: "user",
        content: [
          `Course: "${clip(input.courseTitle, 140)}" (${input.level}).`,
          input.moduleTitle ? `Module: "${clip(input.moduleTitle, 120)}".` : "",
          `Lesson: "${clip(input.lessonTitle, 120)}".`,
          input.existing ? `The tutor's notes so far (keep their points, improve and extend them):\n"""${promptText(input.existing, 3000)}"""` : "",
          "Write the lesson notes: a short intro, 2 to 4 sections with headings, one practical example, and a 3-point recap at the end. 300 to 600 words.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    { maxTokens: 1800 },
  );
  const html = sanitizeRichText(text.replace(/^```(?:html)?\s*|\s*```$/g, ""));
  if (!promptText(html)) throw new Error("The AI didn't return any notes. Try again.");
  return html;
}

// Generates a 16:9 course cover, cleans it like any upload, and stores it in R2. Returns the public URL.
// The image model writes any words it's given onto the picture (badly spelled), so the chat model first turns the
// course into a text-free scene, and only that scene goes to the image model.
export async function makeCover(input: { title: string; summary?: string; style?: string }) {
  const scene = await aiText(
    [
      {
        role: "system",
        content: "You write prompts for an image generator. Describe ONE visual scene in under 45 words: objects, people, setting, colours. Never include any words, letters, numbers, signs, screens with text, book titles or logos. Reply with the scene only.",
      },
      { role: "user", content: `A cover image for an online course about: ${clip(input.title, 140)}.${input.summary ? ` ${clip(input.summary, 200)}` : ""} Learners are mostly in Nigeria and across Africa.` },
    ],
    { model: AI_MODELS.chat, maxTokens: 150 },
  );
  const prompt = [
    clip(scene.replace(/["“”]/g, ""), 400),
    input.style ? `Style: ${clip(input.style, 120)}.` : "Modern flat illustration, clean shapes, soft lighting, blue accents, friendly and professional, wide composition.",
    "Absolutely no text, letters or numbers anywhere.",
  ].join(" ");
  const square = await aiImage(prompt);
  const cover = await sharp(square).resize(1600, 900, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toBuffer();
  const key = objectKey("cover", `${input.title.slice(0, 60) || "course"}-ai.webp`);
  return putObject(key, new Uint8Array(cover), "image/webp");
}
