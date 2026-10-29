import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { listCommunities } from "@/lib/data/communities";

export type QuizStats = { taken: number; average: number; highest: number; lowest: number; passed: number };
export type QuizToDo = { id: string; title: string; courseId: string; courseTitle: string; questions: number; passMark: number };
export type ActiveCommunity = { id: string; slug: string; name: string; members: number; posts: number; joined: boolean };
export type CampusPulse = { postsToday: number; communities: ActiveCommunity[] };

// Scores across every quiz this learner has attempted, using their best attempt at each.
export async function getQuizStats(): Promise<QuizStats> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("quiz_attempts").select("quiz_id, score, passed").eq("user_id", user.id);
  const best = new Map<string, { score: number; passed: boolean }>();
  for (const a of data ?? []) {
    const b = best.get(a.quiz_id);
    if (!b || a.score > b.score) best.set(a.quiz_id, { score: a.score, passed: b?.passed || a.passed });
  }
  const scores = [...best.values()].map((b) => b.score);
  if (!scores.length) return { taken: 0, average: 0, highest: 0, lowest: 0, passed: 0 };
  return {
    taken: scores.length,
    average: Math.round((scores.reduce((n, s) => n + s, 0) / scores.length) * 10) / 10,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    passed: [...best.values()].filter((b) => b.passed).length,
  };
}

// Quizzes in these courses the learner hasn't passed yet, first course first.
export async function getQuizzesToDo(courses: { id: string; title: string }[]): Promise<QuizToDo[]> {
  if (!courses.length) return [];
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: quizzes }, { data: passed }] = await Promise.all([
    createAdminClient()
      .from("course_quizzes")
      .select("id, title, course_id, pass_mark, created_at, questions:quiz_questions(count)")
      .in(
        "course_id",
        courses.map((c) => c.id),
      )
      .order("created_at"),
    supabase.from("quiz_attempts").select("quiz_id").eq("user_id", user.id).eq("passed", true),
  ]);
  const done = new Set((passed ?? []).map((p) => p.quiz_id));
  const order = new Map(courses.map((c, i) => [c.id, i]));
  const title = new Map(courses.map((c) => [c.id, c.title]));
  return (quizzes ?? [])
    .filter((q) => !done.has(q.id))
    .sort((a, b) => (order.get(a.course_id) ?? 0) - (order.get(b.course_id) ?? 0))
    .map((q) => ({
      id: q.id,
      title: q.title,
      courseId: q.course_id,
      courseTitle: title.get(q.course_id) ?? "",
      questions: q.questions?.[0]?.count ?? 0,
      passMark: q.pass_mark,
    }));
}

// For the dashboard's Campus card: Campus posts in the last day, and the communities this learner can see, busiest
// first (posts in the last 7 days, then members).
export async function getCampusPulse(userId: string): Promise<CampusPulse> {
  const db = createAdminClient();
  const now = Date.now();
  const [{ joined, discover }, { data: recent }, { count }] = await Promise.all([
    listCommunities(userId),
    db
      .from("community_posts")
      .select("community_id")
      .eq("hidden", false)
      .gte("created_at", new Date(now - 7 * 86400e3).toISOString()),
    db
      .from("campus_posts")
      .select("id", { count: "exact", head: true })
      .eq("hidden", false)
      .gte("created_at", new Date(now - 86400e3).toISOString()),
  ]);
  const posts = new Map<string, number>();
  for (const r of recent ?? []) posts.set(r.community_id, (posts.get(r.community_id) ?? 0) + 1);
  const communities = [...joined.map((c) => ({ c, joined: true })), ...discover.map((c) => ({ c, joined: false }))]
    .map(({ c, joined }) => ({ id: c.id, slug: c.slug, name: c.name, members: c.members, posts: posts.get(c.id) ?? 0, joined }))
    .sort((a, b) => b.posts - a.posts || b.members - a.members)
    .slice(0, 3);
  return { postsToday: count ?? 0, communities };
}
