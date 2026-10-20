import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Public marketing-page reads (About, Tutors). Service role, but only counts and public-safe profile fields.

export async function getSiteStats() {
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [courses, products, tutors, learners, certificates] = await Promise.all([
    db.from("courses").select("id", head).eq("status", "published"),
    db.from("products").select("id", head).eq("status", "published"),
    db.from("user_roles").select("user_id", head).eq("role", "tutor"),
    db.from("profiles").select("id", head).is("deleted_at", null),
    db.from("certificates").select("id", head),
  ]);
  return {
    courses: courses.count ?? 0,
    products: products.count ?? 0,
    tutors: tutors.count ?? 0,
    learners: learners.count ?? 0,
    certificates: certificates.count ?? 0,
  };
}

export type PublicTutor = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  headline: string | null;
  location: string | null;
  courses: number;
  products: number;
  students: number;
};

// Tutors with a public profile and at least one live course or product, busiest first.
export async function getPublicTutors(): Promise<PublicTutor[]> {
  const db = createAdminClient();
  const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "tutor");
  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (!ids.length) return [];
  const [{ data: people }, { data: courses }, { data: products }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, username, avatar_url, headline, location, profile_public, status")
      .in("id", ids)
      .is("deleted_at", null),
    db.from("courses").select("id, instructor_id").eq("status", "published").in("instructor_id", ids),
    db.from("products").select("creator_id").eq("status", "published").in("creator_id", ids),
  ]);
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: enrolled } = courseIds.length ? await db.from("enrollments").select("course_id").in("course_id", courseIds) : { data: [] };

  const ownerOf = new Map((courses ?? []).map((c) => [c.id, c.instructor_id]));
  const tally = (rows: (string | null)[]) => rows.reduce((m, id) => (id ? m.set(id, (m.get(id) ?? 0) + 1) : m), new Map<string, number>());
  const courseCount = tally((courses ?? []).map((c) => c.instructor_id));
  const productCount = tally((products ?? []).map((p) => p.creator_id));
  const students = tally((enrolled ?? []).map((e) => ownerOf.get(e.course_id) ?? null));

  return (people ?? [])
    .filter((p) => p.profile_public && p.status === "active" && p.username && (courseCount.get(p.id) || productCount.get(p.id)))
    .map((p) => ({
      id: p.id,
      name: p.full_name || p.username!,
      username: p.username!,
      avatar: p.avatar_url,
      headline: p.headline,
      location: p.location,
      courses: courseCount.get(p.id) ?? 0,
      products: productCount.get(p.id) ?? 0,
      students: students.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.students - a.students || b.courses + b.products - (a.courses + a.products));
}
