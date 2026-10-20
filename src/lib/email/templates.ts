import { render, type EmailContent } from "./layout";
import { siteUrl } from "./site";

// Every email's wording, as pure functions: data in, subject + HTML + text out. notify.ts fills them with real data
// and sends; the admin Templates page and the Supabase template build render them with samples.

export type Rendered = { subject: string; html: string; text: string };

const build = (subject: string, content: EmailContent): Rendered => ({ subject, ...render(content) });
const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function welcomeEmail({ name }: { name: string }) {
  return build("Welcome to Etivio", {
    preheader: "Your account is ready. Here's how to get the most out of Etivio.",
    banner: "welcome",
    heading: "Welcome to Etivio",
    greeting: name,
    blocks: [
      { p: "Your account is ready. Etivio is where you learn practical skills from instructors across Africa, at your own pace. Here's how to get going:" },
      { list: ["Browse courses and enroll in one that fits your goal", "Learn a little each week and keep your streak going", "Finish a course to earn a certificate anyone can verify"] },
    ],
    cta: { label: "Browse courses", url: `${siteUrl()}/learn/browse` },
    reason: "You're getting this because you created an Etivio account. Need a hand? Just reply to this email.",
  });
}

export function enrolledEmail({ name, course, instructor, courseId }: { name: string; course: string; instructor: string | null; courseId: string }) {
  return build(`You're enrolled: ${course}`, {
    preheader: `You're in. Start ${course} whenever you're ready.`,
    banner: "enrolled",
    heading: "You're enrolled!",
    greeting: name,
    blocks: [{ p: "Great choice. You now have full access to your new course. Work through the lessons in order and mark each one complete, and you'll earn a certificate when you finish." }],
    info: { title: course, rows: [...(instructor ? ([["Instructor", instructor]] as [string, string][]) : []), ["Access", "Lifetime"], ["Certificate", "On completion"]] },
    cta: { label: "Start learning", url: `${siteUrl()}/learn/course/${courseId}` },
    reason: "You're getting this because you enrolled in a course on Etivio.",
  });
}

export function certificateEmail({ name, course, code }: { name: string; course: string; code: string }) {
  return build(`Your certificate for ${course}`, {
    preheader: `You finished ${course}. Your certificate is ready to share.`,
    banner: "certificate",
    heading: "Congratulations, you did it!",
    greeting: name,
    blocks: [{ p: "You completed every lesson, and your certificate is ready. Anyone can check it's genuine with its ID, so it's ready to add to LinkedIn or your CV." }],
    info: { title: course, rows: [["Certificate ID", code], ["Status", "Verified"]] },
    cta: { label: "View your certificate", url: `${siteUrl()}/certificate/${code}` },
    reason: "You're getting this because you completed a course on Etivio.",
  });
}

export function supportReplyEmail({ name, subject, body }: { name: string; subject: string | null; body: string }) {
  return build("New reply from Etivio support", {
    preheader: excerpt(body, 110),
    banner: "support_reply",
    heading: "You have a new reply",
    greeting: name,
    blocks: [{ p: `The Etivio team replied to your support conversation${subject ? ` about "${subject}"` : ""}:` }, { quote: excerpt(body, 1200) }],
    cta: { label: "Open the conversation", url: `${siteUrl()}/support` },
    reason: "You're getting this because you have support replies turned on.",
    manageLink: true,
  });
}

export function reviewReplyEmail({ name, course, courseId, reply }: { name: string; course: string; courseId: string; reply: string }) {
  return build(`Reply to your review of ${course}`, {
    preheader: `Etivio replied to your review of ${course}.`,
    banner: "review_reply",
    heading: "We replied to your review",
    greeting: name,
    blocks: [{ p: `Thank you for reviewing ${course}. Feedback like yours helps us make every course better. Here's our reply:` }, { quote: reply }],
    cta: { label: "Back to the course", url: `${siteUrl()}/learn/course/${courseId}` },
    reason: "You're getting this because you have course updates turned on.",
    manageLink: true,
  });
}

const ROLE_NAMES: Record<string, string> = { tutor: "tutor", coach: "coach", event_manager: "event manager", community_owner: "community owner" };
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function applicationEmail({ name, role, approved, note }: { name: string; role: string; approved: boolean; note: string | null }) {
  const r = ROLE_NAMES[role] ?? role.replace(/_/g, " ");
  const a = article(r);
  const noteBlock = note ? [{ p: "A note from the team:" }, { quote: note }] : [];
  return approved
    ? build(`You're approved as an Etivio ${r}`, {
        preheader: `You can now create on Etivio as ${a} ${r}.`,
        banner: "application_approved",
        heading: `Welcome aboard, ${title(r)}!`,
        greeting: name,
        blocks: [{ p: `Good news: your application to become ${a} ${r} on Etivio was approved. Switch to Teach in your dashboard to start building your first course.` }, ...noteBlock],
        info: { title: "Application approved", rows: [["Role", title(r)], ["Next step", "Create your first course"]] },
        cta: { label: "Open your Teach dashboard", url: `${siteUrl()}/teach` },
        reason: "You're getting this because you applied to teach on Etivio.",
      })
    : build(`Your Etivio ${r} application`, {
        preheader: `An update on your ${r} application.`,
        banner: "application_rejected",
        heading: "About your application",
        greeting: name,
        blocks: [
          { p: `Thank you for applying to be ${a} ${r} on Etivio. After reviewing it, we aren't able to approve your application right now.` },
          ...noteBlock,
          { p: "You're welcome to apply again later. Reply to this email if you have any questions." },
        ],
        reason: "You're getting this because you applied to teach on Etivio.",
      });
}

export function announcementEmail({ name, title: heading, summary }: { name: string; title: string; summary: string }) {
  return build(heading, {
    preheader: excerpt(summary, 110),
    banner: "announcement",
    heading,
    greeting: name,
    blocks: [{ p: excerpt(summary, 600) }],
    cta: { label: "Read the announcement", url: `${siteUrl()}/learn/announcements` },
    reason: "You're getting this because you have course updates turned on.",
    manageLink: true,
  });
}

export function receiptEmail({ name, item, amount, reference, date, url, cta }: { name: string; item: string; amount: string; reference: string; date: string; url: string; cta: string }) {
  return build(`Receipt: ${item}`, {
    preheader: `Payment received for ${item}. Here's your receipt.`,
    banner: "receipt",
    heading: "Payment received",
    greeting: name,
    blocks: [{ p: "Thank you for your purchase. Your payment went through and it's ready for you now." }],
    info: { title: item, rows: [["Amount paid", amount], ["Reference", reference], ["Date", date]] },
    cta: { label: cta, url },
    reason: "This is your receipt for a purchase on Etivio. Keep it for your records.",
  });
}

export function guestAccessEmail({ name, item, email, password, accessUrl, loginUrl }: { name: string; item: string; email: string; password: string; accessUrl: string; loginUrl: string }) {
  return build(`Your Etivio login: ${item}`, {
    preheader: `You're in. Here's how to get to ${item}.`,
    banner: "welcome",
    heading: "Your purchase is ready",
    greeting: name,
    blocks: [
      { p: "Thanks for your purchase. We've created an Etivio account for you so you can get to it any time, on any device." },
      { p: "Tap the button to go straight in (it works for the next hour). After that, sign in with the details below. The first time you sign in, you'll choose your own password." },
    ],
    info: { title: item, rows: [["Sign-in email", email], ["Temporary password", password], ["Sign in at", loginUrl.replace(/^https?:\/\//, "")]] },
    cta: { label: "Go to my purchase", url: accessUrl },
    reason: "You're getting this because you bought something on Etivio without an account. Didn't make this purchase? Reply to this email.",
  });
}

// Abandoned checkout, sent up to 4 times over 2 days. The wording moves from a nudge to a final reminder.
const REMINDER_COPY = [
  { subject: "You left something in your cart", heading: "Your order is waiting", p: "Looks like your payment didn't go through. Your items are saved, so you can pick up right where you left off." },
  { subject: "Still thinking it over?", heading: "Still interested?", p: "Your cart is still saved. Finish your order in a minute and start learning today." },
  { subject: "Your cart is waiting for you", heading: "Don't miss out", p: "Everything you picked is still here, ready when you are. It only takes a moment to finish." },
  { subject: "Last reminder about your cart", heading: "Last reminder", p: "This is the last email we'll send about this order. Complete it now to get lifetime access." },
] as const;

export function checkoutReminderEmail({ name, items, total, resumeUrl, attempt }: { name: string; items: string[]; total: string; resumeUrl: string; attempt: number }) {
  const copy = REMINDER_COPY[Math.min(Math.max(attempt, 1), 4) - 1];
  return build(copy.subject, {
    preheader: `${items[0]}${items.length > 1 ? ` and ${items.length - 1} more` : ""} is still in your cart.`,
    banner: "receipt",
    heading: copy.heading,
    greeting: name,
    blocks: [{ p: copy.p }, { list: items }],
    info: { title: "Your order", rows: [["Items", String(items.length)], ["Total", total]] },
    cta: { label: "Complete your purchase", url: resumeUrl },
    reason: "You're getting this because you started a checkout on Etivio and didn't finish paying. We send at most 4 reminders, then stop.",
  });
}

export function productApprovedEmail({ name, product, url }: { name: string; product: string; url: string }) {
  return build(`Your product is live: ${product}`, {
    preheader: `${product} is now on the Etivio marketplace.`,
    banner: "application_approved",
    heading: "Your product is live!",
    greeting: name,
    blocks: [{ p: "Good news: the Etivio team approved your product and it's now listed on the marketplace. Share the link with your audience to get your first sales." }],
    info: { title: product, rows: [["Status", "Live on the marketplace"]] },
    cta: { label: "View your product", url },
    reason: "You're getting this because you submitted a product to the Etivio marketplace.",
  });
}

export function productChangesEmail({ name, product, note, url }: { name: string; product: string; note: string; url: string }) {
  return build(`Changes requested: ${product}`, {
    preheader: `A few changes are needed before ${product} goes live.`,
    banner: "application_rejected",
    heading: "A few changes needed",
    greeting: name,
    blocks: [{ p: `Thanks for submitting ${product}. Before it goes live on the marketplace, the Etivio team asked for a few changes:` }, { quote: note }, { p: "Make the changes, then submit it again from Teach, then Products." }],
    cta: { label: "Edit your product", url },
    reason: "You're getting this because you submitted a product to the Etivio marketplace.",
  });
}

export function productSubmittedEmail({ product, creator, kind, url }: { product: string; creator: string; kind: string; url: string }) {
  return build(`New product to review: ${product}`, {
    preheader: `${creator} submitted ${product} for the marketplace.`,
    banner: "product_review",
    heading: "A product is waiting for review",
    blocks: [{ p: `${creator} submitted a product for the Etivio marketplace. Approve it to publish it, or request changes with a note.` }],
    info: { title: product, rows: [["Type", kind], ["Creator", creator]] },
    cta: { label: "Review it", url },
    reason: "You're getting this because you're an Etivio admin.",
  });
}

export function testEmail() {
  return build("Etivio test email", {
    preheader: "Your Etivio email setup works.",
    banner: "test",
    heading: "Email is working",
    blocks: [{ p: "This is a test from the Etivio admin. If you can read it, the app can send email, and it should land in the inbox rather than spam." }],
    cta: { label: "Open Etivio", url: siteUrl() },
    reason: "You're getting this because someone pressed 'Send a test email' in Etivio admin.",
  });
}

// Supabase Auth emails. `{{ .ConfirmationURL }}` and friends are filled in by Supabase when it sends.
const AUTH = {
  confirmation: {
    subject: "Confirm your Etivio account",
    heading: "Confirm your email",
    pre: "One click and your Etivio account is ready.",
    p: "Thanks for signing up to Etivio. Confirm your email address to finish creating your account.",
    cta: "Confirm my email",
    reason: "You're getting this because this address was used to sign up to Etivio. If that wasn't you, you can ignore this email.",
  },
  recovery: {
    subject: "Reset your Etivio password",
    heading: "Reset your password",
    pre: "Use this link to choose a new password.",
    p: "We got a request to reset the password for your Etivio account. The link below works once and expires soon.",
    cta: "Choose a new password",
    reason: "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
  },
  email_change: {
    subject: "Confirm your new email address",
    heading: "Confirm your new email",
    pre: "Confirm the change to your Etivio sign-in email.",
    p: "You asked to change the email address you sign in with. Confirm below to finish the change.",
    cta: "Confirm new email",
    reason: "If you didn't ask for this change, ignore this email and consider changing your password.",
  },
  magic_link: {
    subject: "Your Etivio sign-in link",
    heading: "Sign in to Etivio",
    pre: "Your one-time sign-in link.",
    p: "Use the button below to sign in. The link works once and expires soon.",
    cta: "Sign in",
    reason: "If you didn't try to sign in, you can ignore this email.",
  },
  invite: {
    subject: "You've been invited to Etivio",
    heading: "You're invited to Etivio",
    pre: "Accept your invite to join Etivio.",
    p: "You've been invited to join Etivio, a place to learn practical skills from instructors across Africa. Accept the invite to set up your account.",
    cta: "Accept invite",
    reason: "If you weren't expecting this invite, you can ignore this email.",
  },
} as const;

export type AuthEmail = keyof typeof AUTH;
export const AUTH_EMAILS = Object.keys(AUTH) as AuthEmail[];

// `vars` swaps the placeholders: Supabase's tags for the real templates, sample values for previews.
export function authEmail(kind: AuthEmail, vars: { url: string; email: string; newEmail: string }) {
  const t = AUTH[kind];
  const rendered = build(t.subject, {
    preheader: t.pre,
    banner: kind,
    heading: t.heading,
    blocks: [{ p: t.p }],
    info: kind === "email_change" ? { title: "Email change", rows: [["Current email", "{{EMAIL}}"], ["New email", "{{NEW_EMAIL}}"]] } : undefined,
    cta: { label: t.cta, url: "__URL__" },
    reason: t.reason,
  });
  const fill = (s: string) => s.replaceAll("__URL__", vars.url).replaceAll("{{EMAIL}}", vars.email).replaceAll("{{NEW_EMAIL}}", vars.newEmail);
  return { subject: rendered.subject, html: fill(rendered.html), text: fill(rendered.text) };
}

// Sample data for previews, one entry per email Etivio can send.
export function sampleEmails(): { key: string; label: string; group: "App" | "Sign-in (Supabase)"; when: string; email: Rendered }[] {
  const courseId = "00000000-0000-0000-0000-000000000000";
  const auth = (kind: AuthEmail) => authEmail(kind, { url: `${siteUrl()}/auth/callback`, email: "ada@example.com", newEmail: "ada.okafor@example.com" });
  return [
    { key: "welcome", label: "Welcome", group: "App", when: "First time someone finishes or skips the welcome guide", email: welcomeEmail({ name: "Ada" }) },
    { key: "enrolled", label: "Enrolled", group: "App", when: "Enrolling in a course", email: enrolledEmail({ name: "Ada", course: "Introduction To Web-Design", instructor: "Nnamdi Obi", courseId }) },
    { key: "certificate", label: "Certificate earned", group: "App", when: "Finishing every lesson and quiz in a course", email: certificateEmail({ name: "Ada", course: "Introduction To Web-Design", code: "K7M2QX9P" }) },
    {
      key: "support_reply",
      label: "Support reply",
      group: "App",
      when: "Staff reply in Chats (at most one email per conversation every 15 minutes)",
      email: supportReplyEmail({ name: "Ada", subject: "Can't see my certificate", body: "Hi Ada, thanks for flagging this. Your certificate is now showing under Profile, then Certificates. Let us know if anything else looks off!" }),
    },
    {
      key: "review_reply",
      label: "Review reply",
      group: "App",
      when: "Admin replies to a course review",
      email: reviewReplyEmail({ name: "Ada", course: "Introduction To Web-Design", courseId, reply: "Thank you, Ada! We're adding a module on responsive layouts next month based on feedback like yours." }),
    },
    { key: "application_approved", label: "Tutor approved", group: "App", when: "Admin approves a tutor application", email: applicationEmail({ name: "Ada", role: "tutor", approved: true, note: "Loved your portfolio. Welcome aboard!" }) },
    { key: "application_rejected", label: "Tutor declined", group: "App", when: "Admin declines a tutor application", email: applicationEmail({ name: "Ada", role: "tutor", approved: false, note: "We'd love to see a short sample lesson when you reapply." }) },
    {
      key: "announcement",
      label: "Announcement",
      group: "App",
      when: "An announcement is published, or its scheduled time arrives",
      email: announcementEmail({ name: "Ada", title: "New: course details pages", summary: "You can now open any course to see its full outline, what's included, reviews from other learners, and the instructor, before you enroll. Head to Browse courses to try it." }),
    },
    {
      key: "guest_access",
      label: "Guest login details",
      group: "App",
      when: "Someone buys without an account and one is created for them",
      email: guestAccessEmail({ name: "Ada", item: "Introduction To Web-Design", email: "ada@example.com", password: "k7MpQ2xRw9Td", accessUrl: `${siteUrl()}/auth/confirm`, loginUrl: `${siteUrl()}/login` }),
    },
    {
      key: "checkout_reminder",
      label: "Checkout reminder",
      group: "App",
      when: "A checkout isn't paid: right away if payment fails or is cancelled (else after 30 minutes), then about 6, 24 and 47 hours later",
      email: checkoutReminderEmail({ name: "Ada", items: ["Introduction To Web-Design", "Startup Pitch Deck Template"], total: "₦15,100", resumeUrl: `${siteUrl()}/checkout/resume`, attempt: 1 }),
    },
    { key: "test", label: "Test email", group: "App", when: "Admin presses Send a test email", email: testEmail() },
    { key: "confirmation", label: "Confirm sign-up", group: "Sign-in (Supabase)", when: "Someone creates an account", email: auth("confirmation") },
    { key: "recovery", label: "Reset password", group: "Sign-in (Supabase)", when: "Forgot password, or an admin sends a reset", email: auth("recovery") },
    { key: "email_change", label: "Change email", group: "Sign-in (Supabase)", when: "Someone changes their sign-in email", email: auth("email_change") },
    { key: "magic_link", label: "Magic link", group: "Sign-in (Supabase)", when: "Passwordless sign-in", email: auth("magic_link") },
    { key: "invite", label: "Invite", group: "Sign-in (Supabase)", when: "An admin invites someone by email", email: auth("invite") },
  ];
}
