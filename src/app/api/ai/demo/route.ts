import { NextResponse, type NextRequest } from "next/server";
import { aiConfigured, aiStream, type ChatMessage } from "@/lib/ai";
import { getCatalog } from "@/lib/data/learn";

// Public "try Etivio AI" demo on the landing page. No account needed, so it is tightly limited:
// a few questions per visitor (cookie) and per IP (in memory, best effort per server instance).
const DEMO_LIMIT = 3;
const COOKIE = "et_ai_demo";
const ipHits = new Map<string, { n: number; day: string }>();

export async function POST(req: NextRequest) {
  if (!aiConfigured()) return NextResponse.json({ error: "Etivio AI isn't available right now." }, { status: 503 });

  let question = "";
  try {
    question = String((await req.json())?.question ?? "").trim().slice(0, 500);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });

  const day = new Date().toISOString().slice(0, 10);
  const used = Number(req.cookies.get(COOKIE)?.value ?? 0) || 0;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const hit = ipHits.get(ip);
  const ipUsed = hit && hit.day === day ? hit.n : 0;
  if (used >= DEMO_LIMIT || ipUsed >= DEMO_LIMIT * 3) {
    return NextResponse.json({ error: "limit" }, { status: 429 });
  }
  ipHits.set(ip, { n: ipUsed + 1, day });

  const courses = (await getCatalog(40).catch(() => []))
    .map((c) => `- ${c.title} (/courses/${c.slug})${c.summary ? `: ${c.summary.slice(0, 120)}` : ""}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are Etivio AI, the study partner on Etivio, an online learning platform for learners across Africa. " +
        "Answer any learning or general knowledge question clearly, in plain simple English, in under 180 words. " +
        "Use short paragraphs or a short list. Never use em-dashes. " +
        "If one of these Etivio courses genuinely fits the question, recommend it by exact title at the end in one sentence; otherwise do not mention courses.\n\n" +
        `Etivio courses:\n${courses || "(none listed)"}`,
    },
    { role: "user", content: question },
  ];

  try {
    const stream = await aiStream(messages, { maxTokens: 450 });
    const res = new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Remaining": String(DEMO_LIMIT - used - 1) },
    });
    res.headers.append("Set-Cookie", `${COOKIE}=${used + 1}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly`);
    return res;
  } catch {
    return NextResponse.json({ error: "Etivio AI couldn't answer just now. Try again in a moment." }, { status: 502 });
  }
}
