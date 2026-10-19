import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/announcements";
import { formatPrice } from "@/lib/format";
import { everyone, recipient } from "./recipients";
import { sendBatch, sendEmail, sentRecently, siteUrl, type Mail } from "./send";
import { compose, fillStored, storedTemplate } from "./stored";
import { announcementEmail, applicationEmail, productApprovedEmail, productChangesEmail, productSubmittedEmail, receiptEmail, certificateEmail, enrolledEmail, reviewReplyEmail, supportReplyEmail, testEmail, welcomeEmail } from "./templates";

// Every email Etivio sends from the app. Callers run these inside after() so a slow mail API never delays a page.
// Account emails (welcome, enrolment, certificates, application decisions) always send; the rest follow the
// learner's notification settings. The wording lives in templates.ts.

export async function emailWelcome(userId: string) {
  const r = await recipient(userId);
  if (!r) return;
  const email = await compose("welcome", { name: r.name, browse_url: `${siteUrl()}/learn/browse` }, () => welcomeEmail({ name: r.name }));
  await sendEmail({ to: r.email, userId, kind: "welcome", ref: userId, ...email });
}

export async function emailEnrolled(userId: string, courseId: string) {
  const [r, { data: c }] = await Promise.all([
    recipient(userId),
    createAdminClient().from("courses").select("title, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", courseId).maybeSingle(),
  ]);
  if (!r || !c) return;
  const instructor = c.instructor?.full_name ?? null;
  const email = await compose("enrolled", { name: r.name, course: c.title, instructor: instructor ?? "Etivio", course_url: `${siteUrl()}/learn/course/${courseId}` }, () =>
    enrolledEmail({ name: r.name, course: c.title, instructor, courseId }),
  );
  await sendEmail({ to: r.email, userId, kind: "enrolled", ref: courseId, ...email });
}

export async function emailCertificates(userId: string, certs: { code: string; course_title: string }[]) {
  if (!certs.length) return;
  const r = await recipient(userId);
  if (!r) return;
  for (const cert of certs) {
    const vars = { name: r.name, course: cert.course_title, code: cert.code, certificate_url: `${siteUrl()}/certificate/${cert.code}` };
    const email = await compose("certificate", vars, () => certificateEmail({ name: r.name, course: cert.course_title, code: cert.code }));
    await sendEmail({ to: r.email, userId, kind: "certificate", ref: cert.code, ...email });
  }
}

// At most one email per support thread every 15 minutes, so a back-and-forth chat doesn't flood their inbox.
export async function emailSupportReply(threadId: string, body: string) {
  const { data: t } = await createAdminClient().from("support_threads").select("user_id, subject").eq("id", threadId).maybeSingle();
  if (!t || (await sentRecently("support_reply", threadId, 15))) return;
  const r = await recipient(t.user_id, "support_replies");
  if (!r) return;
  const email = await compose("support_reply", { name: r.name, subject: t.subject ?? "", message: body, conversation_url: `${siteUrl()}/support` }, () =>
    supportReplyEmail({ name: r.name, subject: t.subject, body }),
  );
  await sendEmail({ to: r.email, userId: r.userId, kind: "support_reply", ref: threadId, ...email });
}

export async function emailReviewReply(reviewId: string) {
  const { data: rv } = await createAdminClient().from("course_reviews").select("user_id, course_id, admin_reply, course:courses(title)").eq("id", reviewId).maybeSingle();
  if (!rv?.admin_reply) return;
  const r = await recipient(rv.user_id, "course_updates");
  if (!r) return;
  const course = rv.course?.title ?? "your course";
  const email = await compose("review_reply", { name: r.name, course, reply: rv.admin_reply, course_url: `${siteUrl()}/learn/course/${rv.course_id}` }, () =>
    reviewReplyEmail({ name: r.name, course, courseId: rv.course_id, reply: rv.admin_reply! }),
  );
  await sendEmail({ to: r.email, userId: r.userId, kind: "review_reply", ref: reviewId, ...email });
}

export async function emailApplicationDecision(userId: string, role: string, approved: boolean, note: string | null) {
  const r = await recipient(userId);
  if (!r) return;
  const kind = approved ? "application_approved" : "application_rejected";
  const email = await compose(kind, { name: r.name, role: role.replace(/_/g, " "), note: note ?? "", teach_url: `${siteUrl()}/teach` }, () => applicationEmail({ name: r.name, role, approved, note }));
  await sendEmail({ to: r.email, userId, kind, ref: role, ...email });
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
    const summary = stripHtml(a.body);
    const stored = await storedTemplate("announcement");
    const url = `${siteUrl()}/learn/announcements`;
    const mails: Mail[] = people.map((r) => ({
      to: r.email,
      userId: r.userId,
      kind: "announcement",
      ref: a.id,
      bulk: true,
      ...(stored ? fillStored(stored, { name: r.name, title: a.title, summary, announcement_url: url }) : announcementEmail({ name: r.name, title: a.title, summary })),
    }));
    await sendBatch(mails);
  }
}

export async function emailReceipt(paymentId: string) {
  const db = createAdminClient();
  const { data: pay } = await db
    .from("payments")
    .select("user_id, amount_minor, currency, reference, paid_at, course_id, product_id, course:courses(title), product:products(title)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay?.user_id) return;
  const r = await recipient(pay.user_id);
  if (!r) return;
  const item = pay.course?.title ?? pay.product?.title ?? "Your purchase";
  const isCourse = !!pay.course_id;
  const vars = {
    name: r.name,
    item,
    amount: formatPrice(pay.amount_minor, pay.currency),
    reference: pay.reference,
    date: new Date(pay.paid_at ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    item_url: isCourse ? `${siteUrl()}/learn/course/${pay.course_id}` : `${siteUrl()}/learn/library`,
  };
  const email = await compose("receipt", vars, () => receiptEmail({ ...vars, url: vars.item_url, cta: isCourse ? "Start the course" : "Go to your library" }));
  await sendEmail({ to: r.email, userId: r.userId, kind: "receipt", ref: pay.reference, ...email });
}

const KIND_LABELS: Record<string, string> = { template: "Template", ebook: "E-book", resource_pack: "Resource pack", bundle: "Bundle" };

// Tells the tutor their product was approved or needs changes.
export async function emailProductDecision(productId: string, approved: boolean) {
  const { data: p } = await createAdminClient().from("products").select("creator_id, title, slug, review_note").eq("id", productId).maybeSingle();
  if (!p) return;
  const r = await recipient(p.creator_id);
  if (!r) return;
  const email = approved
    ? await compose("product_approved", { name: r.name, product: p.title, product_url: `${siteUrl()}/products/${p.slug}` }, () =>
        productApprovedEmail({ name: r.name, product: p.title, url: `${siteUrl()}/products/${p.slug}` }),
      )
    : await compose("product_rejected", { name: r.name, product: p.title, note: p.review_note ?? "", edit_url: `${siteUrl()}/teach/products/${productId}` }, () =>
        productChangesEmail({ name: r.name, product: p.title, note: p.review_note ?? "", url: `${siteUrl()}/teach/products/${productId}` }),
      );
  await sendEmail({ to: r.email, userId: r.userId, kind: approved ? "product_approved" : "product_rejected", ref: productId, ...email });
}

// Tells every super admin a tutor's product is waiting for review.
export async function emailProductSubmitted(productId: string) {
  const db = createAdminClient();
  const [{ data: p }, { data: admins }] = await Promise.all([
    db.from("products").select("title, kind, creator:profiles!products_creator_id_fkey(full_name)").eq("id", productId).maybeSingle(),
    db.from("user_roles").select("user_id").eq("role", "super_admin"),
  ]);
  if (!p) return;
  const vars = { product: p.title, creator: p.creator?.full_name || "A tutor", kind: KIND_LABELS[p.kind] ?? "Product", review_url: `${siteUrl()}/admin/marketplace/${productId}` };
  const email = await compose("product_submitted", vars, () => productSubmittedEmail({ product: vars.product, creator: vars.creator, kind: vars.kind, url: vars.review_url }));
  for (const a of admins ?? []) {
    const r = await recipient(a.user_id);
    if (r) await sendEmail({ to: r.email, userId: r.userId, kind: "product_submitted", ref: productId, ...email });
  }
}

export async function emailTest(to: string, userId: string) {
  return sendEmail({ to, userId, kind: "test", ref: null, ...(await compose("test", {}, testEmail)) });
}
