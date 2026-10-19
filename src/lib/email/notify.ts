import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/announcements";
import { render } from "./layout";
import { everyone, recipient } from "./recipients";
import { sendBatch, sendEmail, sentRecently, siteUrl, type Mail } from "./send";

// Every email Etivio sends from the app. Callers run these inside after() so a slow mail API never delays a page.
// Account emails (welcome, enrolment, certificates, application decisions) always send; the rest follow the
// learner's notification settings.

const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function emailWelcome(userId: string) {
  const r = await recipient(userId);
  if (!r) return;
  const { html, text } = render({
    preheader: "Your account is ready. Here's how to get the most out of Etivio.",
    heading: `Welcome to Etivio, ${r.name}`,
    blocks: [
      { p: "Your account is ready. Etivio is where you learn practical skills from instructors across Africa, at your own pace." },
      { list: ["Browse courses and enroll in one that fits your goal", "Learn a little each week and keep your streak going", "Finish a course to earn a certificate anyone can verify"] },
      { p: "Need a hand? Reply to this email or use Support in your dashboard." },
    ],
    cta: { label: "Browse courses", url: `${siteUrl()}/learn/browse` },
    reason: "You're getting this because you created an Etivio account.",
  });
  await sendEmail({ to: r.email, userId, kind: "welcome", ref: userId, subject: "Welcome to Etivio", html, text });
}

export async function emailEnrolled(userId: string, courseId: string) {
  const [r, { data: c }] = await Promise.all([
    recipient(userId),
    createAdminClient().from("courses").select("title, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", courseId).maybeSingle(),
  ]);
  if (!r || !c) return;
  const { html, text } = render({
    preheader: `You're in. Start ${c.title} whenever you're ready.`,
    heading: `You're enrolled in ${c.title}`,
    blocks: [
      { p: `Hi ${r.name}, you now have access to ${c.title}${c.instructor?.full_name ? ` with ${c.instructor.full_name}` : ""}.` },
      { p: "Work through the lessons in order, mark each one complete, and you'll get a certificate when you finish." },
    ],
    cta: { label: "Start learning", url: `${siteUrl()}/learn/course/${courseId}` },
    reason: "You're getting this because you enrolled in a course on Etivio.",
  });
  await sendEmail({ to: r.email, userId, kind: "enrolled", ref: courseId, subject: `You're enrolled: ${c.title}`, html, text });
}

export async function emailCertificates(userId: string, certs: { code: string; course_title: string }[]) {
  if (!certs.length) return;
  const r = await recipient(userId);
  if (!r) return;
  for (const cert of certs) {
    const { html, text } = render({
      preheader: `You finished ${cert.course_title}. Your certificate is ready to share.`,
      heading: "You earned a certificate",
      blocks: [
        { p: `Well done, ${r.name}. You completed ${cert.course_title}, and your certificate is ready.` },
        { code: cert.code },
        { p: "Anyone can check it's genuine with the link below, so it's ready to add to LinkedIn or your CV." },
      ],
      cta: { label: "View your certificate", url: `${siteUrl()}/certificate/${cert.code}` },
      reason: "You're getting this because you completed a course on Etivio.",
    });
    await sendEmail({ to: r.email, userId, kind: "certificate", ref: cert.code, subject: `Your certificate for ${cert.course_title}`, html, text });
  }
}

// At most one email per support thread every 15 minutes, so a back-and-forth chat doesn't flood their inbox.
export async function emailSupportReply(threadId: string, body: string) {
  const db = createAdminClient();
  const { data: t } = await db.from("support_threads").select("user_id, subject").eq("id", threadId).maybeSingle();
  if (!t || (await sentRecently("support_reply", threadId, 15))) return;
  const r = await recipient(t.user_id, "support_replies");
  if (!r) return;
  const { html, text } = render({
    preheader: excerpt(body, 110),
    heading: "The Etivio team replied",
    blocks: [{ p: `Hi ${r.name}, we've replied to your support conversation${t.subject ? ` about "${t.subject}"` : ""}:` }, { quote: excerpt(body, 1200) }],
    cta: { label: "Open the conversation", url: `${siteUrl()}/support` },
    reason: "You're getting this because you have support replies turned on.",
    manageLink: true,
  });
  await sendEmail({ to: r.email, userId: r.userId, kind: "support_reply", ref: threadId, subject: "New reply from Etivio support", html, text });
}

export async function emailReviewReply(reviewId: string) {
  const { data: rv } = await createAdminClient().from("course_reviews").select("user_id, course_id, admin_reply, course:courses(title)").eq("id", reviewId).maybeSingle();
  if (!rv?.admin_reply) return;
  const r = await recipient(rv.user_id, "course_updates");
  if (!r) return;
  const title = rv.course?.title ?? "your course";
  const { html, text } = render({
    preheader: `Etivio replied to your review of ${title}.`,
    heading: "We replied to your review",
    blocks: [{ p: `Hi ${r.name}, thanks for reviewing ${title}. Here's our reply:` }, { quote: rv.admin_reply }],
    cta: { label: "Back to the course", url: `${siteUrl()}/learn/course/${rv.course_id}` },
    reason: "You're getting this because you have course updates turned on.",
    manageLink: true,
  });
  await sendEmail({ to: r.email, userId: r.userId, kind: "review_reply", ref: reviewId, subject: `Reply to your review of ${title}`, html, text });
}

const ROLE_NAMES: Record<string, string> = { tutor: "tutor", coach: "coach", event_manager: "event manager", community_owner: "community owner" };

export async function emailApplicationDecision(userId: string, role: string, approved: boolean, note: string | null) {
  const r = await recipient(userId);
  if (!r) return;
  const name = ROLE_NAMES[role] ?? role.replace(/_/g, " ");
  const { html, text } = render(
    approved
      ? {
          preheader: `You can now create on Etivio as a ${name}.`,
          heading: `You're approved as a ${name}`,
          blocks: [
            { p: `Good news, ${r.name}. Your application to become a ${name} on Etivio was approved.` },
            ...(note ? [{ quote: note }] : []),
            { p: "Switch to Teach in your dashboard to start building your first course." },
          ],
          cta: { label: "Open your Teach dashboard", url: `${siteUrl()}/teach` },
          reason: "You're getting this because you applied to teach on Etivio.",
        }
      : {
          preheader: `An update on your ${name} application.`,
          heading: "About your application",
          blocks: [
            { p: `Hi ${r.name}, thank you for applying to be a ${name} on Etivio. We aren't able to approve your application right now.` },
            ...(note ? [{ quote: note }] : []),
            { p: "You're welcome to apply again later. Reply to this email if you have questions." },
          ],
          reason: "You're getting this because you applied to teach on Etivio.",
        },
  );
  await sendEmail({ to: r.email, userId, kind: approved ? "application_approved" : "application_rejected", ref: role, subject: approved ? `You're approved as an Etivio ${name}` : `Your Etivio ${name} application`, html, text });
}

// Emails every announcement that is live and hasn't been sent. The claim (setting emailed_at) happens first, so two
// requests running this at once can't both send. Called after saving an announcement and lazily from learner pages,
// which is how scheduled announcements go out once their time passes.
export async function sendDueAnnouncements() {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: due } = await db.from("announcements").select("id").is("emailed_at", null).or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`).limit(5);
  for (const { id } of due ?? []) {
    const { data: a } = await db.from("announcements").update({ emailed_at: now }).eq("id", id).is("emailed_at", null).select("id, title, body").maybeSingle();
    if (!a) continue;
    const people = await everyone("course_updates");
    const summary = excerpt(stripHtml(a.body), 600);
    const mails: Mail[] = people.map((r) => {
      const { html, text } = render({
        preheader: excerpt(summary, 110),
        heading: a.title,
        blocks: [{ p: `Hi ${r.name},` }, { p: summary }],
        cta: { label: "Read the announcement", url: `${siteUrl()}/learn/announcements` },
        reason: "You're getting this because you have course updates turned on.",
        manageLink: true,
      });
      return { to: r.email, userId: r.userId, kind: "announcement", ref: a.id, subject: a.title, html, text, bulk: true };
    });
    await sendBatch(mails);
  }
}

export async function emailTest(to: string, userId: string) {
  const { html, text } = render({
    preheader: "Your Etivio email setup works.",
    heading: "Email is working",
    blocks: [{ p: "This is a test from the Etivio admin. If you can read it, the app can send email, and it should land in the inbox rather than spam." }],
    cta: { label: "Open Etivio", url: siteUrl() },
    reason: "You're getting this because someone pressed 'Send test email' in Etivio admin settings.",
  });
  return sendEmail({ to, userId, kind: "test", ref: null, subject: "Etivio test email", html, text });
}
