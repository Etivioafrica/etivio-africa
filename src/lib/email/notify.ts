import "server-only";
import { accessPeriod } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/announcements";
import { formatPrice } from "@/lib/format";
import { everyone, recipient } from "./recipients";
import { sendBatch, sendEmail, sentRecently, siteUrl, type Mail } from "./send";
import { compose, fillStored, storedTemplate } from "./stored";
import { announcementEmail, applicationEmail, courseApprovedEmail, courseChangesEmail, courseSubmittedEmail, productApprovedEmail, productChangesEmail, productSubmittedEmail, receiptEmail, guestAccessEmail, checkoutReminderEmail, certificateEmail, enrolledEmail, reviewReplyEmail, supportReplyEmail,
  supportResolvedEmail, testEmail, welcomeEmail } from "./templates";

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
  const db = createAdminClient();
  const [r, { data: c }, { data: e }] = await Promise.all([
    recipient(userId),
    db.from("courses").select("title, access_days, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("expires_at").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
  ]);
  if (!r || !c) return;
  const instructor = c.instructor?.full_name ?? null;
  const access = e?.expires_at ? `${accessPeriod(c.access_days)} (until ${formatDate(e.expires_at)})` : "Lifetime";
  const email = await compose("enrolled", { name: r.name, course: c.title, instructor: instructor ?? "Etivio", access, course_url: `${siteUrl()}/learn/course/${courseId}` }, () =>
    enrolledEmail({ name: r.name, course: c.title, instructor, courseId, access }),
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

export async function emailSupportResolved(threadId: string) {
  const { data: t } = await createAdminClient().from("support_threads").select("user_id, subject").eq("id", threadId).maybeSingle();
  if (!t || (await sentRecently("support_resolved", threadId, 60))) return;
  const r = await recipient(t.user_id, "support_replies");
  if (!r) return;
  const email = await compose("support_resolved", { name: r.name, subject: t.subject ?? "", support_url: `${siteUrl()}/support` }, () => supportResolvedEmail({ name: r.name, subject: t.subject }));
  await sendEmail({ to: r.email, userId: r.userId, kind: "support_resolved", ref: threadId, ...email });
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

export async function emailProductReviewReply(reviewId: string) {
  const { data: rv } = await createAdminClient().from("product_reviews").select("user_id, product_id, admin_reply, product:products(title, slug)").eq("id", reviewId).maybeSingle();
  if (!rv?.admin_reply) return;
  const r = await recipient(rv.user_id, "course_updates");
  if (!r) return;
  const product = rv.product?.title ?? "your purchase";
  const url = `${siteUrl()}/products/${rv.product?.slug ?? ""}`;
  const email = await compose("review_reply", { name: r.name, course: product, reply: rv.admin_reply, course_url: url }, () =>
    reviewReplyEmail({ name: r.name, course: product, courseId: rv.product_id, reply: rv.admin_reply!, url, cta: "View the product" }),
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
    const { data: a } = await db.from("announcements").update({ emailed_at: now }).eq("id", id).is("emailed_at", null).select("id, title, body, course_id").maybeSingle();
    if (!a) continue;
    let people = await everyone("course_updates");
    // A course announcement only goes to learners enrolled in that course.
    if (a.course_id) {
      const { data: enrolled } = await db.from("enrollments").select("user_id").eq("course_id", a.course_id);
      const ids = new Set((enrolled ?? []).map((e) => e.user_id));
      people = people.filter((p) => ids.has(p.userId));
    }
    const summary = stripHtml(a.body);
    const stored = await storedTemplate("announcement");
    const url = a.course_id ? `${siteUrl()}/learn/announcements/${a.id}` : `${siteUrl()}/learn/announcements`;
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

// What an order contains, for its emails: item titles and where to open them.
async function orderSummary(orderId: string) {
  const db = createAdminClient();
  const [{ data: order }, { data: items }] = await Promise.all([
    db.from("orders").select("id, reference, user_id, email, first_name, total_minor, currency, paid_at, status, reminders_sent").eq("id", orderId).maybeSingle(),
    db.from("payments").select("course_id, product_id, course:courses(title), product:products(title)").eq("order_id", orderId).order("reference"),
  ]);
  if (!order) return null;
  const rows = items ?? [];
  const titles = rows.map((r) => r.course?.title ?? r.product?.title ?? "Item");
  // One course goes straight to it; anything else opens the dashboard, where courses and the library both are.
  const onlyCourse = rows.length === 1 && rows[0].course_id ? rows[0].course_id : null;
  const next = onlyCourse ? `/learn/course/${onlyCourse}` : rows.every((r) => r.product_id) ? "/learn/library" : "/learn";
  return { order, titles, next, onlyCourse: !!onlyCourse };
}

export async function emailOrderReceipt(orderId: string) {
  const s = await orderSummary(orderId);
  if (!s?.order.user_id) return;
  const r = await recipient(s.order.user_id);
  if (!r) return;
  const vars = {
    name: r.name,
    item: s.titles.join(", "),
    amount: formatPrice(s.order.total_minor, s.order.currency),
    reference: s.order.reference,
    date: new Date(s.order.paid_at ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    item_url: `${siteUrl()}${s.next}`,
  };
  const cta = s.onlyCourse ? "Start the course" : s.next === "/learn/library" ? "Go to your library" : "Go to my dashboard";
  const email = await compose("receipt", vars, () => receiptEmail({ ...vars, url: vars.item_url, cta }));
  await sendEmail({ to: r.email, userId: r.userId, kind: "receipt", ref: s.order.reference, ...email });
}

// Login details for someone whose account was just created by a guest purchase. The button signs them straight in
// with a one-time link (valid for an hour); the temporary password works after that until they choose their own.
export async function emailGuestAccess(orderId: string, password: string) {
  const s = await orderSummary(orderId);
  if (!s?.order.user_id) return;
  const r = await recipient(s.order.user_id);
  if (!r) return;
  const db = createAdminClient();
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: r.email });
  const token = link?.properties?.hashed_token;
  const accessUrl = token ? `${siteUrl()}/auth/confirm?token_hash=${token}&type=magiclink&next=${encodeURIComponent(s.next)}` : `${siteUrl()}/login?next=${encodeURIComponent(s.next)}`;
  const item = s.titles.join(", ");
  const vars = { name: r.name, item, email: r.email, password, access_url: accessUrl, login_url: `${siteUrl()}/login` };
  const email = await compose("guest_access", vars, () => guestAccessEmail({ name: r.name, item, email: r.email, password, accessUrl, loginUrl: vars.login_url }));
  await sendEmail({ to: r.email, userId: r.userId, kind: "guest_access", ref: s.order.reference, ...email });
}

// Abandoned-checkout reminder number `attempt` (1 to 4). Sent to the address on the order, account or not.
export async function emailCheckoutReminder(orderId: string, attempt: number) {
  const s = await orderSummary(orderId);
  if (!s || s.order.status === "success") return;
  const name = (s.order.first_name || "there").split(/\s+/)[0];
  const total = formatPrice(s.order.total_minor, s.order.currency);
  const resumeUrl = `${siteUrl()}/checkout/resume?order=${s.order.reference}`;
  const vars = { name, items: s.titles.join(", "), total, reminder: String(attempt), resume_url: resumeUrl };
  const email = await compose("checkout_reminder", vars, () => checkoutReminderEmail({ name, items: s.titles, total, resumeUrl, attempt }));
  await sendEmail({ to: s.order.email, userId: s.order.user_id, kind: "checkout_reminder", ref: `${s.order.reference}#${attempt}`, ...email });
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
  const [{ data: p }, admins] = await Promise.all([
    db.from("products").select("title, kind, creator:profiles!products_creator_id_fkey(full_name)").eq("id", productId).maybeSingle(),
    reviewerIds(),
  ]);
  if (!p) return;
  const vars = { product: p.title, creator: p.creator?.full_name || "A tutor", kind: KIND_LABELS[p.kind] ?? "Product", review_url: `${siteUrl()}/admin/review/products/${productId}` };
  const email = await compose("product_submitted", vars, () => productSubmittedEmail({ product: vars.product, creator: vars.creator, kind: vars.kind, url: vars.review_url }));
  for (const id of admins) {
    const r = await recipient(id);
    if (r) await sendEmail({ to: r.email, userId: r.userId, kind: "product_submitted", ref: productId, ...email });
  }
}

// Everyone who can work the review queue: reviewers and super admins.
async function reviewerIds() {
  const { data } = await createAdminClient().from("user_roles").select("user_id").in("role", ["reviewer", "super_admin"]);
  return [...new Set((data ?? []).map((r) => r.user_id))];
}

// Tells the tutor their course was approved (now live) or needs changes (with the reviewer's note).
export async function emailCourseDecision(courseId: string, approved: boolean) {
  const { data: c } = await createAdminClient().from("courses").select("instructor_id, title, slug, review_note").eq("id", courseId).maybeSingle();
  if (!c) return;
  const r = await recipient(c.instructor_id);
  if (!r) return;
  const courseUrl = `${siteUrl()}/courses/${c.slug}`;
  const editUrl = `${siteUrl()}/teach/courses/${courseId}`;
  const email = approved
    ? await compose("course_approved", { name: r.name, course: c.title, course_url: courseUrl }, () => courseApprovedEmail({ name: r.name, course: c.title, url: courseUrl }))
    : await compose("course_rejected", { name: r.name, course: c.title, note: c.review_note ?? "", edit_url: editUrl }, () =>
        courseChangesEmail({ name: r.name, course: c.title, note: c.review_note ?? "", url: editUrl }),
      );
  await sendEmail({ to: r.email, userId: r.userId, kind: approved ? "course_approved" : "course_rejected", ref: courseId, ...email });
}

// Tells the review team a tutor's course is waiting.
export async function emailCourseSubmitted(courseId: string) {
  const db = createAdminClient();
  const [{ data: c }, ids] = await Promise.all([
    db.from("courses").select("title, instructor_id, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", courseId).maybeSingle(),
    reviewerIds(),
  ]);
  if (!c) return;
  const vars = { course: c.title, tutor: c.instructor?.full_name || "A tutor", review_url: `${siteUrl()}/admin/review/courses/${courseId}` };
  const email = await compose("course_submitted", vars, () => courseSubmittedEmail({ course: vars.course, tutor: vars.tutor, url: vars.review_url }));
  for (const id of ids) {
    if (id === c.instructor_id) continue;
    const r = await recipient(id);
    if (r) await sendEmail({ to: r.email, userId: r.userId, kind: "course_submitted", ref: courseId, ...email });
  }
}

export async function emailTest(to: string, userId: string) {
  return sendEmail({ to, userId, kind: "test", ref: null, ...(await compose("test", {}, testEmail)) });
}
