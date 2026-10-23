"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureOn } from "@/lib/data/features";
import { canCreateCommunity, getCommunity, type JoinMode } from "@/lib/data/communities";
import { slugify } from "@/lib/format";

type Result = { ok?: string; error?: string };
const str = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);
const MODES: JoinMode[] = ["open", "request", "course", "invite"];

async function viewer() {
  const user = await getCurrentUser();
  if (!(await featureOn("communities"))) redirect("/learn");
  return user;
}

// Join under the community's rule: open joins straight away, request waits for approval, course needs enrolment,
// invite needs the code from the invite link.
export async function joinCommunity(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await viewer();
  const db = createAdminClient();
  const c = await getCommunity(str(fd, "slug", 80), user.id, user.roles);
  if (!c) return { error: "That community wasn't found." };
  if (c.mine?.status === "active") return { ok: "You're already a member." };
  if (c.mine?.status === "banned") return { error: "You can't join this community." };
  let status: "active" | "pending" = "active";
  let answer: string | null = null;
  if (c.joinMode === "request") {
    answer = str(fd, "answer", 500);
    if (c.join_question && answer.length < 2) return { error: "Answer the question to send your request." };
    status = "pending";
  } else if (c.joinMode === "course") {
    const { data: enrolled } = c.course_id ? await db.from("enrollments").select("user_id").eq("course_id", c.course_id).eq("user_id", user.id).maybeSingle() : { data: null };
    if (!enrolled) return { error: "This community is for students of its course. Enrol in the course to join." };
  } else if (c.joinMode === "invite") {
    if (str(fd, "invite", 40) !== c.invite_code) return { error: "This community is invite only. Ask a member for the invite link." };
  }
  const { error } = await db.from("community_members").upsert({ community_id: c.id, user_id: user.id, role: "member", status, answer }, { onConflict: "community_id,user_id" });
  if (error) return { error: "Couldn't join just now. Try again." };
  refresh();
  return { ok: status === "pending" ? "Request sent. You'll get in once a moderator approves it." : `Welcome to ${c.name}.` };
}

export async function leaveCommunity(fd: FormData) {
  const user = await viewer();
  const db = createAdminClient();
  const { data: c } = await db.from("communities").select("id, slug").eq("slug", str(fd, "slug", 80)).maybeSingle();
  if (!c) return;
  // Owners stay; they'd hand the community over first.
  await db.from("community_members").delete().eq("community_id", c.id).eq("user_id", user.id).neq("role", "owner");
  refresh();
}

export async function createPost(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await viewer();
  const c = await getCommunity(str(fd, "slug", 80), user.id, user.roles);
  if (!c || !c.isMember) return { error: "Join the community to post." };
  const body = str(fd, "body", 5000);
  if (body.length < 2) return { error: "Write something first." };
  const { error } = await createAdminClient().from("community_posts").insert({ community_id: c.id, author_id: user.id, body });
  if (error) return { error: "Couldn't post. Try again." };
  refresh();
  return { ok: "Posted." };
}

// The post's community, and what this person may do there.
async function postAccess(postId: string) {
  const user = await viewer();
  const db = createAdminClient();
  const { data: post } = await db.from("community_posts").select("id, author_id, community:communities(slug)").eq("id", postId).maybeSingle();
  if (!post?.community) return null;
  const c = await getCommunity(post.community.slug, user.id, user.roles);
  if (!c) return null;
  return { user, db, post, c };
}

export async function addComment(postId: string, body: string): Promise<Result & { comment?: { id: string; body: string; createdAt: string; author: string } }> {
  const a = await postAccess(postId);
  if (!a || !a.c.isMember) return { error: "Join the community to comment." };
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "Write a comment first." };
  const { data, error } = await a.db.from("community_comments").insert({ post_id: postId, author_id: a.user.id, body: text }).select("id, body, created_at").single();
  if (error || !data) return { error: "Couldn't comment. Try again." };
  return { comment: { id: data.id, body: data.body, createdAt: data.created_at, author: a.user.name || "You" } };
}

export async function loadComments(postId: string) {
  const a = await postAccess(postId);
  if (!a || !a.c.isMember) return [];
  const { data } = await a.db.from("community_comments").select("id, body, created_at, author:profiles(full_name)").eq("post_id", postId).order("created_at").limit(200);
  return (data ?? []).map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: c.author?.full_name || "Member" }));
}

export async function toggleLike(postId: string): Promise<{ liked?: boolean; error?: string }> {
  const a = await postAccess(postId);
  if (!a || !a.c.isMember) return { error: "Join the community first." };
  const { data: had } = await a.db.from("community_likes").select("post_id").eq("post_id", postId).eq("user_id", a.user.id).maybeSingle();
  if (had) await a.db.from("community_likes").delete().eq("post_id", postId).eq("user_id", a.user.id);
  else await a.db.from("community_likes").insert({ post_id: postId, user_id: a.user.id });
  return { liked: !had };
}

export async function deletePost(fd: FormData) {
  const a = await postAccess(str(fd, "post_id", 40));
  if (!a || (a.post.author_id !== a.user.id && !a.c.canModerate)) return;
  await a.db.from("community_posts").delete().eq("id", a.post.id);
  refresh();
}

export async function pinPost(fd: FormData) {
  const a = await postAccess(str(fd, "post_id", 40));
  if (!a || !a.c.canModerate) return;
  await a.db.from("community_posts").update({ pinned: fd.get("pinned") === "1" }).eq("id", a.post.id);
  refresh();
}

// Approve or turn down a join request.
export async function decideRequest(fd: FormData) {
  const user = await viewer();
  const c = await getCommunity(str(fd, "slug", 80), user.id, user.roles);
  if (!c?.canModerate) return;
  const db = createAdminClient();
  const target = str(fd, "user_id", 40);
  if (fd.get("approve") === "1") await db.from("community_members").update({ status: "active", joined_at: new Date().toISOString() }).eq("community_id", c.id).eq("user_id", target).eq("status", "pending");
  else await db.from("community_members").delete().eq("community_id", c.id).eq("user_id", target).eq("status", "pending");
  refresh();
}

export async function createCommunity(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await viewer();
  if (!canCreateCommunity(user.roles)) return { error: "Only tutors can create communities." };
  const db = createAdminClient();
  const name = str(fd, "name", 80);
  if (name.length < 3) return { error: "Give the community a name of at least 3 characters." };
  const joinMode = (MODES.includes(str(fd, "join_mode", 10) as JoinMode) ? str(fd, "join_mode", 10) : "open") as JoinMode;
  const courseId = str(fd, "course_id", 40) || null;
  if (joinMode === "course") {
    if (!courseId) return { error: "Pick the course whose students can join." };
    const { data: course } = await db.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
    if (!course) return { error: "That course wasn't found." };
    const staff = user.roles.includes("super_admin");
    if (!staff && course.instructor_id !== user.id) return { error: "You can only link a course you teach." };
  }
  const base = slugify(name).slice(0, 50) || "community";
  let id: string | null = null;
  let slug = base;
  for (let attempt = 0; attempt < 4 && !id; attempt++) {
    slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("communities")
      .insert({
        slug,
        name,
        description: str(fd, "description", 600) || null,
        owner_id: user.id,
        join_mode: joinMode,
        course_id: joinMode === "course" ? courseId : null,
        join_question: joinMode === "request" ? str(fd, "join_question", 200) || null : null,
        is_official: user.roles.includes("super_admin") && fd.get("official") === "on",
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error?.code !== "23505") return { error: "Couldn't create the community. Try again." };
  }
  if (!id) return { error: "That name is taken. Try another." };
  await db.from("community_members").insert({ community_id: id, user_id: user.id, role: "owner", status: "active" });
  redirect(`/communities/${slug}`);
}
