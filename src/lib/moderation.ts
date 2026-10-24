import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured } from "@/lib/ai";
import { STAFF_ROLES, type AppRole } from "@/lib/roles";

// Content moderation (migration 0048). Text people type is checked before it's saved:
//   1. a word list of clearly sexual or vulgar words (blocked straight away, with a strike), then
//   2. an AI check on Cloudflare Workers AI (Llama 3.3 70B with our own rules), which reads meaning and Pidgin:
//      "breast cancer screening" passes, "fine girl, make we link up for hotel" doesn't. What it catches is saved but
//      held back for Admin › Moderation; sexual content involving children is blocked outright.
// Uploaded images are checked by a vision model. Reports from people land in the same queue.
// If the AI is down or slow, the word list still applies and the text goes through.

export type TargetType =
  | "community_post"
  | "community_comment"
  | "community"
  | "message"
  | "support_message"
  | "blog_comment"
  | "course_review"
  | "product_review"
  | "course"
  | "lesson"
  | "product"
  | "profile"
  | "image"
  | "campus_post"
  | "campus_comment";

export type Reason = "sexual" | "harassment" | "hate" | "violence" | "spam" | "other";

export const REASON_LABELS: Record<Reason, string> = {
  sexual: "Sexual or explicit",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  violence: "Violence or threats",
  spam: "Spam or scam",
  other: "Something else",
};

export const TARGET_LABELS: Record<TargetType, string> = {
  community_post: "Community post",
  community_comment: "Community comment",
  community: "Community",
  message: "Message",
  support_message: "Support message",
  blog_comment: "Blog comment",
  course_review: "Course review",
  product_review: "Product review",
  course: "Course",
  lesson: "Lesson",
  product: "Product",
  profile: "Profile",
  image: "Image upload",
  campus_post: "Campus post",
  campus_comment: "Campus comment",
};

export const MUTE_AT = 3;
export const SUSPEND_AT = 5;
const MUTE_DAYS = 7;
// Reports from this many people hide a post, comment or message until staff look at it.
export const HIDE_AT_REPORTS = 3;

// ---------------------------------------------------------------------------------------------------------------------
// Word list. Only words that are sexual or vulgar in any context. Words with innocent meanings ("sex" in a biology
// lesson, "nude" lipstick, "cock" for a rooster, "hooker" in rugby, "toto", "rape" in a safety course) are left to the
// AI, which reads them in context. Includes Nigerian Pidgin, Yoruba, Igbo and Hausa slang. Matching ignores case,
// accents, repeated letters, look-alike digits (p0rn), symbols standing in for vowels (p*rn) and dots or spaces
// between letters (p.o.r.n).

const WORDS = [
  // English
  "porn", "porno", "pornography", "pornhub", "xvideos", "xhamster", "xnxx", "onlyfans", "nsfw",
  "nudes", "send nudes", "naked pics", "naked pictures", "sexting", "sext", "sexy pics",
  "blowjob", "blow job", "handjob", "hand job", "rimjob", "deepthroat", "cumshot", "creampie", "gangbang", "bukkake",
  "pussy", "pussies", "cunt", "twat", "dickhead", "dick pic", "dick pics", "cocksucker", "cock sucker",
  "boobs", "tits", "titties",
  "fuck", "fucker", "fucking", "fucked", "motherfucker", "fuckboy", "fvck",
  "horny", "orgy", "jerk off", "wank", "wanker",
  "anal sex", "oral sex", "doggy style", "doggystyle",
  "slut", "whore", "escort service", "sugar daddy", "sugar mummy", "sugar mommy",
  "milf", "dildo", "fleshlight", "camgirl", "cam girl", "child porn",
  // Nigerian Pidgin and slang
  "preeq", "preek", "knacking", "knack you", "nack you", "do runs", "runs girl", "runz girl", "olosho", "ashawo", "ashewo",
  // Igbo and Hausa
  "ikpu", "karuwa",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "8": "b" };
const VOWEL = (v: string) => `[${v}*#%]`;
const SEP = "[\\s._\\-*'\"~|]{0,2}";

function wordPattern(word: string) {
  const parts = [...word].map((ch) => {
    if (ch === " ") return "\\s*";
    const cls = "aeiou".includes(ch) ? VOWEL(ch) : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return `${cls}+`;
  });
  return parts.join(SEP);
}

const STRONG = new RegExp(`(?<![a-z])(?:${WORDS.map(wordPattern).join("|")})(?![a-z])`, "i");

function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[01!34@5$78]/g, (c) => LEET[c] ?? c);
}

// A word-list match, or null.
export function bannedWord(text: string) {
  const m = normalize(text).match(STRONG);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// AI checks

const CF = (model: string) => `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

const MODERATOR = `You moderate an education platform for Nigerian learners and tutors (English, Nigerian Pidgin, Yoruba, Igbo, Hausa). Classify the user's text. Reply with exactly one word:
CHILD - anything sexual involving children or minors
SEXUAL - sexual content, sexual advances or flirting, comments on someone's body, asking for private photos or to meet for sex, hookup offers, sexual slang
HARASSMENT - insults aimed at a person, bullying, threats to find or hurt someone
HATE - attacks on tribe, religion, gender or other identity
VIOLENCE - encouraging or planning violence
SPAM - scams, ads, asking for money, get-rich offers
OK - anything else, including normal course talk, health and biology topics, polite disagreement and complaints about a course`;

const VERDICTS: Record<string, Reason> = { CHILD: "sexual", SEXUAL: "sexual", HARASSMENT: "harassment", HATE: "hate", VIOLENCE: "violence", SPAM: "spam" };

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function classify(text: string): Promise<{ reason: Reason; severe: boolean } | null> {
  if (!aiConfigured() || text.trim().length < 3) return null;
  const answer = await withTimeout(8000, async (signal) => {
    const res = await fetch(CF("@cf/meta/llama-3.3-70b-instruct-fp8-fast"), {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_tokens: 4, temperature: 0, messages: [{ role: "system", content: MODERATOR }, { role: "user", content: text.slice(0, 4000) }] }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { response?: string } };
    return json.result?.response ?? null;
  });
  const word = answer?.trim().toUpperCase().match(/[A-Z]+/)?.[0] ?? "";
  return VERDICTS[word] ? { reason: VERDICTS[word], severe: word === "CHILD" } : null;
}

// "explicit" (nudity, sex), "suggestive" (lingerie, sexual posing) or "safe". null when the check couldn't run.
// Llama 3.2 Vision answers in about a second (the account has accepted its licence once, by sending it "agree").
export async function checkImage(jpeg: Buffer): Promise<"safe" | "suggestive" | "explicit" | null> {
  if (!aiConfigured()) return null;
  const answer = await withTimeout(15000, async (signal) => {
    const res = await fetch(CF("@cf/meta/llama-3.2-11b-vision-instruct"), {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        max_tokens: 8,
        temperature: 0,
        image: [...jpeg],
        messages: [
          { role: "system", content: "You are an image safety filter for a school website. You never describe images. You answer with exactly one word." },
          {
            role: "user",
            content:
              "Rate this image. EXPLICIT = nudity, exposed genitals or breasts, sexual acts. SUGGESTIVE = lingerie or underwear posing, sexualised poses, see-through clothing. SAFE = everything else, including swimwear at a beach, medical diagrams and art. Answer with one word only: SAFE, SUGGESTIVE or EXPLICIT.",
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { response?: string } };
    return json.result?.response ?? null;
  });
  if (!answer) return null;
  const word = answer.toUpperCase();
  return word.includes("EXPLICIT") ? "explicit" : word.includes("SUGGESTIVE") ? "suggestive" : word.includes("SAFE") ? "safe" : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Checking what someone typed

export type Moderation = {
  error?: string;
  // Save it hidden (or unapproved) and call record() with the new row's id.
  hold: boolean;
  record: (targetId: string | null | undefined) => Promise<void>;
};

const noop = async () => {};
const clip = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);

// Is this person muted or suspended right now? Returns the message to show, or null.
export async function postingBlocked(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("muted_until, status").eq("id", userId).maybeSingle();
  if (data?.status === "suspended") return "Your account is suspended.";
  if (data?.muted_until && Date.parse(data.muted_until) > Date.now()) {
    const until = new Date(data.muted_until).toLocaleDateString("en-NG", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    return `You can't post or send messages until ${until}, because earlier posts broke Etivio's community rules.`;
  }
  return null;
}

// Checks text before it's saved. `fields` are the parts people typed (title, body...). `link` is where staff can see it.
// Course and product editors autosave, so they pass ai: false while editing (word list only, run on every save) and
// strike: false (a blocked autosave isn't an attempt to post), then ai: true when the tutor submits or publishes.
export async function moderate(
  type: TargetType,
  userId: string | null,
  fields: (string | null | undefined)[],
  link?: string,
  { ai: useAi = true, strike: useStrike = true }: { ai?: boolean; strike?: boolean } = {},
): Promise<Moderation> {
  const text = fields.filter(Boolean).join("\n").trim();
  const ok: Moderation = { hold: false, record: noop };
  if (userId && useStrike) {
    const blocked = await postingBlocked(userId);
    if (blocked) return { ...ok, error: blocked };
  }
  if (!text) return ok;
  const db = createAdminClient();

  const word = bannedWord(text);
  const ai = word || !useAi ? null : await classify(text);
  if (word || ai?.severe) {
    // Editors (no strikes) are told which word, so a tutor can fix their text; they aren't logged on every autosave.
    if (!useStrike) return { ...ok, error: `This can't be saved: ${word ? `"${word}" isn't allowed on Etivio` : "it breaks Etivio's rules on sexual content"}. Change it and try again.` };
    const { data: flag } = await db
      .from("moderation_flags")
      .insert({ target_type: type, author_id: userId, excerpt: clip(text), link: link ?? null, source: "auto", reason: ai?.reason ?? "sexual", details: word ? `Blocked word: ${word}` : "Blocked by AI check", status: "blocked" })
      .select("id")
      .single();
    const strike = userId ? await giveStrike(userId, "Tried to post sexual or explicit content", flag?.id ?? null, null) : null;
    return {
      ...ok,
      error: `This goes against Etivio's community rules on sexual and explicit content, so it wasn't posted.${strike?.message ? ` ${strike.message}` : ""}`,
    };
  }
  if (ai) {
    return {
      hold: true,
      record: async (targetId) => {
        await db.from("moderation_flags").insert({ target_type: type, target_id: targetId ?? null, author_id: userId, excerpt: clip(text), link: link ?? null, source: "auto", reason: ai.reason, details: "Held by AI check" });
      },
    };
  }
  return ok;
}

// ---------------------------------------------------------------------------------------------------------------------
// Strikes

async function isStaffUser(userId: string) {
  const { data } = await createAdminClient().from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) => STAFF_ROLES.includes(r.role as AppRole));
}

// Adds a strike. 3 mutes the person for 7 days, 5 suspends the account. Staff accounts are never muted or suspended.
export async function giveStrike(userId: string, reason: string, flagId: string | null, givenBy: string | null): Promise<{ strikes: number; message: string }> {
  const db = createAdminClient();
  await db.from("user_strikes").insert({ user_id: userId, flag_id: flagId, reason: reason.slice(0, 300), given_by: givenBy });
  const { count } = await db.from("user_strikes").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const strikes = count ?? 1;
  const staff = await isStaffUser(userId);
  const update: { strikes: number; muted_until?: string; status?: "suspended" } = { strikes };
  let message = strikes === 1 ? "This is a warning." : `You now have ${strikes} strikes.`;
  if (!staff && strikes >= SUSPEND_AT) {
    update.status = "suspended";
    message = "Your account has been suspended.";
  } else if (!staff && strikes >= MUTE_AT) {
    update.muted_until = new Date(Date.now() + MUTE_DAYS * 86400_000).toISOString();
    message = `You can't post or send messages for ${MUTE_DAYS} days.`;
  } else if (strikes >= 2) {
    message += ` At ${MUTE_AT} you'll be stopped from posting for ${MUTE_DAYS} days.`;
  }
  await db.from("profiles").update(update).eq("id", userId);
  if (update.status === "suspended") await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  return { strikes, message };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reported things: where they live, who wrote them, and how to hide or remove them.

type Target = { table: string; text: string; author: string; link: (row: Record<string, unknown>) => Promise<string | null> | string | null };

const TARGETS: Partial<Record<TargetType, Target>> = {
  community_post: {
    table: "community_posts",
    text: "body",
    author: "author_id",
    link: async (r) => {
      const { data } = await createAdminClient().from("communities").select("slug").eq("id", String(r.community_id)).maybeSingle();
      return data ? `/communities/${data.slug}` : null;
    },
  },
  community_comment: {
    table: "community_comments",
    text: "body",
    author: "author_id",
    link: async (r) => {
      const db = createAdminClient();
      const { data: post } = await db.from("community_posts").select("community_id").eq("id", String(r.post_id)).maybeSingle();
      const { data } = post ? await db.from("communities").select("slug").eq("id", post.community_id).maybeSingle() : { data: null };
      return data ? `/communities/${data.slug}` : null;
    },
  },
  community: { table: "communities", text: "name", author: "owner_id", link: (r) => `/communities/${r.slug}` },
  campus_post: { table: "campus_posts", text: "body", author: "author_id", link: (r) => `/campus/${r.id}` },
  campus_comment: { table: "campus_comments", text: "body", author: "author_id", link: (r) => `/campus/${r.post_id}` },
  message: { table: "conversation_messages", text: "body", author: "sender_id", link: () => null },
  blog_comment: { table: "blog_comments", text: "content", author: "user_id", link: () => "/admin/blog/comments" },
  course_review: { table: "course_reviews", text: "body", author: "user_id", link: () => "/admin/courses/reviews" },
  product_review: { table: "product_reviews", text: "body", author: "user_id", link: () => "/admin/marketplace/reviews" },
  course: { table: "courses", text: "title", author: "instructor_id", link: (r) => `/courses/${r.slug}` },
  product: { table: "products", text: "title", author: "creator_id", link: (r) => `/products/${r.slug}` },
  profile: { table: "profiles", text: "full_name", author: "id", link: (r) => (r.username ? `/u/${r.username}` : `/admin/users/${r.id}`) },
};

export const reportable = (type: string): type is TargetType => type in TARGETS;

// Tables that stay saved but hidden while staff look at them.
const HIDEABLE: Partial<Record<TargetType, string>> = {
  community_post: "community_posts",
  community_comment: "community_comments",
  message: "conversation_messages",
  campus_post: "campus_posts",
  campus_comment: "campus_comments",
};

// Loose typing: the target table is picked at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = () => createAdminClient() as any;

export async function loadTarget(type: TargetType, id: string) {
  const t = TARGETS[type];
  if (!t) return null;
  const { data } = await anyDb().from(t.table).select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const text = type === "profile" ? [row.full_name, row.headline, row.bio].filter(Boolean).join(" · ") : String(row[t.text] ?? "");
  return { row, text, authorId: (row[t.author] as string | null) ?? null, link: await t.link(row) };
}

export async function setHidden(type: TargetType, id: string, hidden: boolean) {
  const table = HIDEABLE[type];
  if (table) await anyDb().from(table).update({ hidden }).eq("id", id);
  // Reviews and blog comments already wait for approval; send them back to waiting.
  if (hidden && (type === "course_review" || type === "product_review" || type === "blog_comment")) await anyDb().from(TARGETS[type]!.table).update({ approved: false }).eq("id", id);
}

// Takes reported or caught content down for good.
export async function removeTarget(type: TargetType, id: string) {
  const db = anyDb();
  switch (type) {
    case "community_post":
    case "community_comment":
    case "campus_post":
    case "campus_comment":
    case "message":
    case "blog_comment":
    case "course_review":
    case "product_review":
      await db.from(TARGETS[type]!.table).delete().eq("id", id);
      break;
    case "course":
    case "product":
      await db.from(TARGETS[type]!.table).update({ status: "rejected", review_note: "Removed by Etivio for breaking the community rules." }).eq("id", id);
      break;
    case "community":
      await db.from("communities").update({ status: "archived" }).eq("id", id);
      break;
    case "profile":
      await db.from("profiles").update({ bio: null, headline: null, avatar_url: null, cover_url: null, profile_public: false }).eq("id", id);
      break;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Course and product text, checked by the AI when a tutor submits or publishes (run after the response, so submitting
// stays quick). Anything it catches goes to Admin › Moderation next to the human review.

const plain = (html: string | null | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export async function reviewCourseText(courseId: string, userId: string) {
  const db = createAdminClient();
  const [{ data: course }, { data: modules }, { data: lessons }] = await Promise.all([
    db.from("courses").select("title, summary, description, skills").eq("id", courseId).maybeSingle(),
    db.from("course_modules").select("title").eq("course_id", courseId),
    db.from("lessons").select("title, content").eq("course_id", courseId),
  ]);
  if (!course) return;
  const text = [course.title, course.summary, plain(course.description), (course.skills ?? []).join(", "), ...(modules ?? []).map((m) => m.title), ...(lessons ?? []).flatMap((l) => [l.title, plain(l.content)])];
  await flagIfCaught("course", courseId, userId, text.filter(Boolean).join("\n"));
}

export async function reviewProductText(productId: string, userId: string) {
  const { data: p } = await createAdminClient().from("products").select("title, summary, description, tags").eq("id", productId).maybeSingle();
  if (!p) return;
  await flagIfCaught("product", productId, userId, [p.title, p.summary, plain(p.description), (p.tags ?? []).join(", ")].filter(Boolean).join("\n"));
}

// Long text is checked in pieces (the model reads about 4,000 characters at a time).
async function flagIfCaught(type: TargetType, id: string, userId: string, text: string) {
  const pieces = text.match(/[\s\S]{1,3800}/g)?.slice(0, 12) ?? [];
  for (const piece of pieces) {
    const hit = bannedWord(piece) ? { reason: "sexual" as Reason } : await classify(piece);
    if (!hit) continue;
    const db = createAdminClient();
    const { count } = await db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("target_type", type).eq("target_id", id).eq("status", "open").eq("source", "auto");
    if (!count) await db.from("moderation_flags").insert({ target_type: type, target_id: id, author_id: userId, excerpt: clip(piece), source: "auto", reason: hit.reason, details: "Caught when submitted" });
    return;
  }
}
