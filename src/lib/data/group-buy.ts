import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnrolled } from "@/lib/email/notify";

// Group buy: a course sold at a discount to a group that fills within a few days. Members pay when they join; when
// the last place is taken everyone is enrolled. Groups that run out of time credit each member's wallet (in the
// database, see expire_group_buys in migration 0041).

export const groupPrice = (priceMinor: number, discountPercent: number) => Math.round((priceMinor * (100 - discountPercent)) / 100);

export type GroupView = {
  id: string;
  code: string;
  status: "open" | "filled" | "expired";
  size: number;
  discountPercent: number;
  unitPriceMinor: number;
  currency: string;
  expiresAt: string;
  members: { id: string; name: string; avatar: string | null }[];
  course: { id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; priceMinor: number; instructor: string };
};

export async function getGroup(code: string): Promise<GroupView | null> {
  if (!/^[a-z0-9]{6,16}$/.test(code)) return null;
  const db = createAdminClient();
  const { data: g } = await db
    .from("group_buys")
    .select("id, code, status, size, discount_percent, unit_price_minor, currency, expires_at, course:courses(id, slug, title, summary, cover_url, price_minor, instructor:profiles!courses_instructor_id_fkey(full_name))")
    .eq("code", code)
    .maybeSingle();
  if (!g || !g.course) return null;
  const { data: members } = await db.from("group_buy_members").select("joined_at, profile:profiles(id, full_name, avatar_url)").eq("group_id", g.id).order("joined_at");
  return {
    id: g.id,
    code: g.code,
    status: g.status,
    size: g.size,
    discountPercent: g.discount_percent,
    unitPriceMinor: g.unit_price_minor,
    currency: g.currency,
    expiresAt: g.expires_at,
    members: (members ?? []).filter((m) => m.profile).map((m) => ({ id: m.profile!.id, name: m.profile!.full_name || "Member", avatar: m.profile!.avatar_url })),
    course: {
      id: g.course.id,
      slug: g.course.slug,
      title: g.course.title,
      summary: g.course.summary,
      coverUrl: g.course.cover_url,
      priceMinor: g.course.price_minor,
      instructor: g.course.instructor?.full_name || "Etivio",
    },
  };
}

// Open groups for a course that already have at least one paid member, soonest to close first.
export async function openGroups(courseId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("group_buys")
    .select("code, size, expires_at, group_buy_members(count)")
    .eq("course_id", courseId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at")
    .limit(10);
  return (data ?? [])
    .map((g) => ({ code: g.code, size: g.size, expiresAt: g.expires_at, joined: (g.group_buy_members as unknown as { count: number }[])[0]?.count ?? 0 }))
    .filter((g) => g.joined > 0 && g.joined < g.size)
    .slice(0, 5);
}

// A new open group with the course's current settings. The starter becomes a member once their payment clears.
export async function createGroup(course: { id: string; price_minor: number; currency: string; group_size: number; group_discount_percent: number; group_days: number }, userId: string) {
  const db = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(8, "x").slice(0, 8);
    const { data, error } = await db
      .from("group_buys")
      .insert({
        code,
        course_id: course.id,
        created_by: userId,
        size: course.group_size,
        discount_percent: course.group_discount_percent,
        unit_price_minor: groupPrice(course.price_minor, course.group_discount_percent),
        currency: course.currency,
        expires_at: new Date(Date.now() + course.group_days * 86_400_000).toISOString(),
      })
      .select("id, code, unit_price_minor, currency")
      .single();
    if (data) return data;
    if (error && !error.message.includes("duplicate")) return null;
  }
  return null;
}

async function enroll(userId: string, courseId: string) {
  const db = createAdminClient();
  const { data } = await db.from("enrollments").upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true }).select("user_id");
  if (data?.length) after(() => emailEnrolled(userId, courseId));
}

// Called once a member's payment clears. Adds them, fills the group when the last place is taken (enrolling everyone),
// or credits their wallet straight away if the group already ran out of time.
export async function groupPaymentCleared(groupId: string, userId: string, orderId: string) {
  const db = createAdminClient();
  await db.from("group_buy_members").upsert({ group_id: groupId, user_id: userId, order_id: orderId }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  const { data: g } = await db.from("group_buys").select("id, status, size, course_id, expires_at").eq("id", groupId).maybeSingle();
  if (!g) return;
  if (g.status === "expired" || (g.status === "open" && Date.parse(g.expires_at) < Date.now())) {
    if (g.status === "open") await db.from("group_buys").update({ status: "expired" }).eq("id", g.id).eq("status", "open");
    await db.rpc("credit_group_member", { p_group: g.id, p_user: userId });
    return;
  }
  if (g.status === "open") {
    const { count } = await db.from("group_buy_members").select("user_id", { count: "exact", head: true }).eq("group_id", g.id);
    if ((count ?? 0) >= g.size) {
      const { data: flipped } = await db.from("group_buys").update({ status: "filled", filled_at: new Date().toISOString() }).eq("id", g.id).eq("status", "open").select("id").maybeSingle();
      if (flipped) {
        const { data: members } = await db.from("group_buy_members").select("user_id").eq("group_id", g.id);
        for (const m of members ?? []) await enroll(m.user_id, g.course_id);
        return;
      }
    }
  }
  // Joined a group that is already full (two last places paid at once): they're in too.
  const { data: now } = await db.from("group_buys").select("status").eq("id", g.id).maybeSingle();
  if (now?.status === "filled") await enroll(userId, g.course_id);
}
