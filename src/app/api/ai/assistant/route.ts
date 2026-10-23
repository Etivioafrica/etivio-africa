import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
import { ASSISTANT_DAILY_LIMIT as DAILY_LIMIT, aiConfigured, aiStream, promptText, type ChatMessage } from "@/lib/ai";

// The Etivio AI widget in the app. Knows the person's courses and the catalogue, helps them find their way around,
// and answers learning questions. GET returns the current chat and recent questions, POST streams a reply.
// A chat runs from `since` (set when the person starts a new chat) and never reaches back more than 12 hours.

const THREAD_HOURS = 12;

function threadStart(since: string | null) {
  const floor = Date.now() - THREAD_HOURS * 3_600_000;
  const t = since ? Date.parse(since) : NaN;
  return new Date(Number.isFinite(t) ? Math.max(t, floor) : floor).toISOString();
}

async function usedToday(db: ReturnType<typeof createAdminClient>, userId: string) {
  const { count } = await db
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "assistant")
    .eq("role", "user")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const user = await sessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = createAdminClient();
  const [{ data: thread }, { data: recent }, used] = await Promise.all([
    db
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("feature", "assistant")
      .gte("created_at", threadStart(request.nextUrl.searchParams.get("since")))
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("ai_messages")
      .select("id, content, created_at, feature, course_id, lesson:lessons(id, title), course:courses(title)")
      .eq("user_id", user.id)
      .in("feature", ["assistant", "lesson_chat"])
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(12),
    usedToday(db, user.id),
  ]);
  return NextResponse.json(
    {
      available: aiConfigured(),
      remaining: Math.max(0, DAILY_LIMIT - used),
      messages: (thread ?? []).reverse(),
      recent: (recent ?? []).map((r) => ({
        id: r.id,
        question: r.content,
        at: r.created_at,
        where: r.feature === "lesson_chat" ? (r.lesson?.title ?? r.course?.title ?? "A lesson") : "Etivio AI",
        href: r.feature === "lesson_chat" && r.course_id ? `/learn/course/${r.course_id}${r.lesson ? `?lesson=${r.lesson.id}` : ""}` : null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!aiConfigured()) return NextResponse.json({ error: "Etivio AI isn't available right now." }, { status: 503 });
  const user = await sessionUser(await createClient());
  if (!user) return NextResponse.json({ error: "Sign in to use Etivio AI." }, { status: 401 });

  let body: { message?: string; since?: string | null; page?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const question = (body.message ?? "").trim().slice(0, 1500);
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });

  const db = createAdminClient();
  const used = await usedToday(db, user.id);
  if (used >= DAILY_LIMIT) return NextResponse.json({ error: `You've used today's ${DAILY_LIMIT} questions. Etivio AI is available again tomorrow.` }, { status: 429 });

  const [{ data: profile }, { data: roles }, { data: enrolled }, { data: teaching }, { data: catalogue }, { data: history }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id),
    db.from("enrollments").select("completed_at, course:courses(id, title)").eq("user_id", user.id).limit(30),
    db.from("courses").select("title, status").eq("instructor_id", user.id).limit(20),
    db.from("courses").select("title, slug, level, summary, price_minor").eq("status", "published").eq("marketplace_listed", true).order("published_at", { ascending: false }).limit(40),
    db
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("feature", "assistant")
      .gte("created_at", threadStart(body.since ?? null))
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const roleList = (roles ?? []).map((r) => r.role);
  const learning = (enrolled ?? []).filter((e) => e.course).map((e) => `- ${e.course!.title}${e.completed_at ? " (completed)" : ""}: /learn/course/${e.course!.id}`);
  const courses = (catalogue ?? []).map((c) => `- ${c.title} (${c.level}, ${c.price_minor === 0 ? "free" : "paid"}): /courses/${c.slug}${c.summary ? `. ${promptText(c.summary, 140)}` : ""}`);

  const system = [
    "You are Etivio AI, the assistant inside Etivio, an online learning platform for African learners (Nigeria first) with courses, templates, e-books and resource packs.",
    `You're talking to ${profile?.full_name || "a member"}. Roles: ${roleList.join(", ") || "student"}.`,
    learning.length ? `Courses they're enrolled in:\n${learning.join("\n")}` : "They aren't enrolled in any course yet.",
    teaching?.length ? `Courses they teach: ${teaching.map((c) => `${c.title} (${c.status})`).join("; ")}` : "",
    courses.length ? `Courses on Etivio you can recommend (only these, never invent courses):\n${courses.join("\n")}` : "",
    [
      "Where things are in the app (link with markdown, e.g. [My courses](/learn/courses)):",
      "Dashboard /learn, My courses /learn/courses, Browse courses /learn/browse, Library (downloads) /learn/library, Saved /profile/saved, Marketplace /explore, Announcements /learn/announcements, Profile /profile, Settings /settings (name, username, photo or character avatar, password), Support /support.",
      roleList.includes("tutor") ? "For tutors: Teach dashboard /teach, Courses /teach/courses, New course /teach/courses/new (AI can draft the outline, copy and cover), Products /teach/products, Students /teach/students, Earnings /teach/earnings. Every course is reviewed by the Etivio team before it goes live." : "",
      "Inside a course, each lesson has an Ask AI tab for questions about that lesson.",
    ]
      .filter(Boolean)
      .join("\n"),
    body.page ? `They're currently on the page ${String(body.page).slice(0, 120)}.` : "",
    "How to answer: friendly, clear, simple English. Keep answers under 150 words unless they ask for more. Use short bullet lists and **bold** only where they help. Link to pages and courses with markdown links using the paths above. You can explain topics and help them study, but for payments, refunds or account problems, point them to [Support](/support). Don't make up prices, features or policies. Never use em dashes. Never claim to be a human.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...(history ?? []).reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: question },
  ];

  await db.from("ai_messages").insert({ user_id: user.id, feature: "assistant", role: "user", content: question });

  try {
    const stream = await aiStream(messages, {
      maxTokens: 800,
      onDone: async (full) => {
        if (full.trim()) await db.from("ai_messages").insert({ user_id: user.id, feature: "assistant", role: "assistant", content: full.slice(0, 12000) });
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Remaining": String(DAILY_LIMIT - used - 1) } });
  } catch {
    return NextResponse.json({ error: "Etivio AI couldn't answer just now. Try again in a moment." }, { status: 502 });
  }
}
