import { siteUrl } from "./site";
import { starterDesign, type StarterPart } from "./starter";
import { authLink } from "./auth-links";
import type { AuthEmail } from "./templates";

// The 15 emails that can be designed in Admin → Emails → Templates. Each lists the {{placeholders}} it can use, with
// sample values for previews and test sends, and the starter design it opens with before anyone customises it.

export type Placeholder = { tag: string; label: string; sample: string };
export type TemplateDef = {
  key: string;
  label: string;
  group: "app" | "auth";
  when: string;
  subject: string;
  placeholders: Placeholder[];
  starter: { banner: string; parts: StarterPart[]; footer: string };
};

const SITE = () => siteUrl();
const P = (tag: string, label: string, sample: string): Placeholder => ({ tag, label, sample });
const name = P("name", "First name", "Ada");
const course = P("course", "Course title", "Introduction To Web-Design");
const manage = "<a href=\"{{settings_url}}\">Manage email preferences</a>";

export const TEMPLATES: TemplateDef[] = [
  {
    key: "welcome",
    label: "Welcome",
    group: "app",
    when: "First time someone finishes or skips the welcome guide",
    subject: "Welcome to Etivio, {{name}}",
    placeholders: [name, P("browse_url", "Browse courses link", `${SITE()}/learn/browse`)],
    starter: {
      banner: "welcome",
      parts: [
        { type: "heading", text: "Welcome to Etivio" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Your account is ready. Etivio is where you learn practical skills from instructors across Africa, at your own pace.</p><ul><li>Browse courses and enroll in one that fits your goal</li><li>Learn a little each week and keep your streak going</li><li>Finish a course to earn a certificate anyone can verify</li></ul>" },
        { type: "button", label: "Browse courses", href: "{{browse_url}}" },
      ],
      footer: "You're getting this because you created an Etivio account. Need a hand? Just reply to this email.",
    },
  },
  {
    key: "enrolled",
    label: "Enrolled",
    group: "app",
    when: "Enrolling in a course",
    subject: "You're enrolled: {{course}}",
    placeholders: [name, course, P("instructor", "Instructor", "Nnamdi Obi"), P("course_url", "Course link", `${SITE()}/learn/course/…`)],
    starter: {
      banner: "enrolled",
      parts: [
        { type: "heading", text: "You're enrolled!" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Great choice. You now have full access to your new course. Work through the lessons in order and you'll earn a certificate when you finish.</p>" },
        { type: "box", html: "<p style=\"font-size:16px\"><strong>{{course}}</strong></p><p>Instructor: <strong>{{instructor}}</strong><br>Access: <strong>Lifetime</strong></p>" },
        { type: "button", label: "Start learning", href: "{{course_url}}" },
      ],
      footer: "You're getting this because you enrolled in a course on Etivio.",
    },
  },
  {
    key: "certificate",
    label: "Certificate earned",
    group: "app",
    when: "Finishing every lesson and quiz in a course",
    subject: "Your certificate for {{course}}",
    placeholders: [name, course, P("code", "Certificate ID", "K7M2QX9P"), P("certificate_url", "Certificate link", `${SITE()}/certificate/K7M2QX9P`)],
    starter: {
      banner: "certificate",
      parts: [
        { type: "heading", text: "Congratulations, you did it!" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>You completed every lesson, and your certificate is ready. Anyone can check it's genuine with its ID, so it's ready to add to LinkedIn or your CV.</p>" },
        { type: "box", html: "<p style=\"font-size:16px\"><strong>{{course}}</strong></p><p>Certificate ID: <strong>{{code}}</strong><br>Status: <strong>Verified</strong></p>" },
        { type: "button", label: "View your certificate", href: "{{certificate_url}}" },
      ],
      footer: "You're getting this because you completed a course on Etivio.",
    },
  },
  {
    key: "support_reply",
    label: "Support reply",
    group: "app",
    when: "Staff reply in Chats (at most one email per conversation every 15 minutes)",
    subject: "New reply from Etivio support",
    placeholders: [
      name,
      P("subject", "Conversation subject", "Can't see my certificate"),
      P("message", "Reply message", "Hi Ada, thanks for flagging this. Your certificate is now showing under Profile, then Certificates."),
      P("conversation_url", "Conversation link", `${SITE()}/support`),
    ],
    starter: {
      banner: "support_reply",
      parts: [
        { type: "heading", text: "You have a new reply" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>The Etivio team replied to your support conversation about \"{{subject}}\":</p>" },
        { type: "box", html: "<p>{{message}}</p>" },
        { type: "button", label: "Open the conversation", href: "{{conversation_url}}" },
      ],
      footer: `You're getting this because you have support replies turned on. ${manage}`,
    },
  },
  {
    key: "review_reply",
    label: "Review reply",
    group: "app",
    when: "Admin replies to a course review",
    subject: "Reply to your review of {{course}}",
    placeholders: [name, course, P("reply", "Our reply", "Thank you, Ada! We're adding a module on responsive layouts next month."), P("course_url", "Course link", `${SITE()}/learn/course/…`)],
    starter: {
      banner: "review_reply",
      parts: [
        { type: "heading", text: "We replied to your review" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thank you for reviewing {{course}}. Feedback like yours helps us make every course better. Here's our reply:</p>" },
        { type: "box", html: "<p>{{reply}}</p>" },
        { type: "button", label: "Back to the course", href: "{{course_url}}" },
      ],
      footer: `You're getting this because you have course updates turned on. ${manage}`,
    },
  },
  {
    key: "application_approved",
    label: "Tutor approved",
    group: "app",
    when: "Admin approves a tutor application",
    subject: "You're approved as an Etivio {{role}}",
    placeholders: [name, P("role", "Role", "tutor"), P("note", "Note from the team", "Loved your portfolio. Welcome aboard!"), P("teach_url", "Teach dashboard link", `${SITE()}/teach`)],
    starter: {
      banner: "application_approved",
      parts: [
        { type: "heading", text: "Welcome aboard!" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Good news: your application to become a {{role}} on Etivio was approved. Switch to Teach in your dashboard to start building your first course.</p>" },
        { type: "box", html: "<p>{{note}}</p>" },
        { type: "button", label: "Open your Teach dashboard", href: "{{teach_url}}" },
      ],
      footer: "You're getting this because you applied to teach on Etivio.",
    },
  },
  {
    key: "application_rejected",
    label: "Tutor declined",
    group: "app",
    when: "Admin declines a tutor application",
    subject: "Your Etivio {{role}} application",
    placeholders: [name, P("role", "Role", "tutor"), P("note", "Note from the team", "We'd love to see a short sample lesson when you reapply.")],
    starter: {
      banner: "application_rejected",
      parts: [
        { type: "heading", text: "About your application" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thank you for applying to be a {{role}} on Etivio. After reviewing it, we aren't able to approve your application right now.</p>" },
        { type: "box", html: "<p>{{note}}</p>" },
        { type: "text", html: "<p>You're welcome to apply again later. Reply to this email if you have any questions.</p>" },
      ],
      footer: "You're getting this because you applied to teach on Etivio.",
    },
  },
  {
    key: "announcement",
    label: "Announcement",
    group: "app",
    when: "An announcement is published, or its scheduled time arrives",
    subject: "{{title}}",
    placeholders: [
      name,
      P("title", "Announcement title", "New: course details pages"),
      P("summary", "Announcement text", "You can now open any course to see its full outline, reviews and instructor before you enroll."),
      P("announcement_url", "Announcements link", `${SITE()}/learn/announcements`),
    ],
    starter: {
      banner: "announcement",
      parts: [
        { type: "heading", text: "{{title}}" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>{{summary}}</p>" },
        { type: "button", label: "Read the announcement", href: "{{announcement_url}}" },
      ],
      footer: `You're getting this because you have course updates turned on. ${manage}`,
    },
  },
  {
    key: "receipt",
    label: "Payment receipt",
    group: "app",
    when: "A Paystack payment for a course or product goes through",
    subject: "Receipt: {{item}}",
    placeholders: [
      name,
      P("item", "What they bought", "Startup Pitch Deck Template"),
      P("amount", "Amount paid", "₦12,000"),
      P("reference", "Payment reference", "ET8F3K2M9QZ1"),
      P("date", "Payment date", "19 October 2026"),
      P("item_url", "Link to open it", `${SITE()}/learn/library`),
    ],
    starter: {
      banner: "receipt",
      parts: [
        { type: "heading", text: "Payment received" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thank you for your purchase. Your payment went through and it's ready for you now.</p>" },
        { type: "box", html: "<p style=\"font-size:16px\"><strong>{{item}}</strong></p><p>Amount paid: <strong>{{amount}}</strong><br>Reference: <strong>{{reference}}</strong><br>Date: <strong>{{date}}</strong></p>" },
        { type: "button", label: "Open it now", href: "{{item_url}}" },
      ],
      footer: "This is your receipt for a purchase on Etivio. Keep it for your records.",
    },
  },
  {
    key: "checkout_reminder",
    label: "Checkout reminder",
    group: "app",
    when: "A checkout isn't paid: right away if payment fails or is cancelled (else after 30 minutes), then about 6, 24 and 47 hours later",
    subject: "You left something in your cart",
    placeholders: [
      name,
      P("items", "Items in the cart", "Introduction To Web-Design, Startup Pitch Deck Template"),
      P("total", "Order total", "₦15,100"),
      P("reminder", "Which reminder this is (1 to 4)", "1"),
      P("resume_url", "Link back to payment", `${SITE()}/checkout/resume`),
    ],
    starter: {
      banner: "receipt",
      parts: [
        { type: "heading", text: "Your order is waiting" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Looks like your payment didn't go through. Your items are saved, so you can pick up right where you left off.</p>" },
        { type: "box", html: "<p style=\"font-size:16px\"><strong>Your order</strong></p><p>{{items}}<br>Total: <strong>{{total}}</strong></p>" },
        { type: "button", label: "Complete your purchase", href: "{{resume_url}}" },
      ],
      footer: "You're getting this because you started a checkout on Etivio and didn't finish paying. We send at most 4 reminders, then stop.",
    },
  },
  {
    key: "guest_access",
    label: "Guest login details",
    group: "app",
    when: "Someone buys without an account and one is created for them",
    subject: "Your Etivio login: {{item}}",
    placeholders: [
      name,
      P("item", "What they bought", "Introduction To Web-Design"),
      P("email", "Sign-in email", "ada@example.com"),
      P("password", "Temporary password", "k7MpQ2xRw9Td"),
      P("access_url", "One-click sign-in link (1 hour)", `${SITE()}/auth/confirm`),
      P("login_url", "Sign-in page", `${SITE()}/login`),
    ],
    starter: {
      banner: "welcome",
      parts: [
        { type: "heading", text: "Your purchase is ready" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thanks for your purchase. We've created an Etivio account for you so you can get to it any time, on any device.</p><p>Tap the button to go straight in (it works for the next hour). After that, sign in with the details below. The first time you sign in, you'll choose your own password.</p>" },
        { type: "box", html: "<p style=\"font-size:16px\"><strong>{{item}}</strong></p><p>Sign-in email: <strong>{{email}}</strong><br>Temporary password: <strong>{{password}}</strong><br>Sign in at: <strong>{{login_url}}</strong></p>" },
        { type: "button", label: "Go to my purchase", href: "{{access_url}}" },
      ],
      footer: "You're getting this because you bought something on Etivio without an account. Didn't make this purchase? Reply to this email.",
    },
  },
  {
    key: "product_approved",
    label: "Product approved",
    group: "app",
    when: "Admin approves a tutor's marketplace product",
    subject: "Your product is live: {{product}}",
    placeholders: [name, P("product", "Product title", "Startup Pitch Deck Template"), P("product_url", "Product page link", `${SITE()}/products/startup-pitch-deck`)],
    starter: {
      banner: "application_approved",
      parts: [
        { type: "heading", text: "Your product is live!" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Good news: the Etivio team approved {{product}} and it's now listed on the marketplace. Share the link with your audience to get your first sales.</p>" },
        { type: "button", label: "View your product", href: "{{product_url}}" },
      ],
      footer: "You're getting this because you submitted a product to the Etivio marketplace.",
    },
  },
  {
    key: "product_rejected",
    label: "Product needs changes",
    group: "app",
    when: "Admin requests changes on a tutor's marketplace product",
    subject: "Changes requested: {{product}}",
    placeholders: [name, P("product", "Product title", "Startup Pitch Deck Template"), P("note", "What to change", "Please add preview images of the main slides."), P("edit_url", "Edit link", `${SITE()}/teach/products`)],
    starter: {
      banner: "application_rejected",
      parts: [
        { type: "heading", text: "A few changes needed" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thanks for submitting {{product}}. Before it goes live, the Etivio team asked for a few changes:</p>" },
        { type: "box", html: "<p>{{note}}</p>" },
        { type: "button", label: "Edit your product", href: "{{edit_url}}" },
      ],
      footer: "You're getting this because you submitted a product to the Etivio marketplace.",
    },
  },
  {
    key: "product_submitted",
    label: "Product to review (admins)",
    group: "app",
    when: "A tutor submits a product for review",
    subject: "New product to review: {{product}}",
    placeholders: [P("product", "Product title", "Startup Pitch Deck Template"), P("creator", "Tutor's name", "Ada Okafor"), P("kind", "Product type", "Template"), P("review_url", "Review link", `${SITE()}/admin/marketplace`)],
    starter: {
      banner: "product_review",
      parts: [
        { type: "heading", text: "A product is waiting for review" },
        { type: "text", html: "<p>{{creator}} submitted a {{kind}} for the Etivio marketplace: <strong>{{product}}</strong>. Approve it to publish it, or request changes with a note.</p>" },
        { type: "button", label: "Review it", href: "{{review_url}}" },
      ],
      footer: "You're getting this because you're an Etivio admin.",
    },
  },
  {
    key: "course_approved",
    label: "Course approved",
    group: "app",
    when: "A reviewer approves a tutor's course",
    subject: "Your course is live: {{course}}",
    placeholders: [name, P("course", "Course title", "Brand Design Basics"), P("course_url", "Course page link", `${SITE()}/courses/brand-design-basics`)],
    starter: {
      banner: "application_approved",
      parts: [
        { type: "heading", text: "Your course is live!" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Good news: the Etivio team reviewed {{course}} and it's now live. Share the link with your audience to get your first students.</p>" },
        { type: "button", label: "View your course", href: "{{course_url}}" },
      ],
      footer: "You're getting this because you submitted a course for review on Etivio.",
    },
  },
  {
    key: "course_rejected",
    label: "Course needs changes",
    group: "app",
    when: "A reviewer requests changes on a tutor's course",
    subject: "Changes requested: {{course}}",
    placeholders: [name, P("course", "Course title", "Brand Design Basics"), P("note", "What to change", "Please add a cover image and a description."), P("edit_url", "Edit link", `${SITE()}/teach/courses`)],
    starter: {
      banner: "application_rejected",
      parts: [
        { type: "heading", text: "A few changes needed" },
        { type: "text", html: "<p><strong>Hi {{name}},</strong></p><p>Thanks for submitting {{course}}. Before it goes live, the Etivio team asked for a few changes:</p>" },
        { type: "box", html: "<p>{{note}}</p>" },
        { type: "button", label: "Edit your course", href: "{{edit_url}}" },
      ],
      footer: "You're getting this because you submitted a course for review on Etivio.",
    },
  },
  {
    key: "course_submitted",
    label: "Course to review (reviewers)",
    group: "app",
    when: "A tutor submits a course for review",
    subject: "New course to review: {{course}}",
    placeholders: [P("course", "Course title", "Brand Design Basics"), P("tutor", "Tutor's name", "Ada Okafor"), P("review_url", "Review link", `${SITE()}/admin/review`)],
    starter: {
      banner: "product_review",
      parts: [
        { type: "heading", text: "A course is waiting for review" },
        { type: "text", html: "<p>{{tutor}} submitted a course for review: <strong>{{course}}</strong>. Approve it to make it live, or request changes with a note.</p>" },
        { type: "button", label: "Review it", href: "{{review_url}}" },
      ],
      footer: "You're getting this because you review courses on Etivio.",
    },
  },
  {
    key: "test",
    label: "Test email",
    group: "app",
    when: "Admin presses Send a test email",
    subject: "Etivio test email",
    placeholders: [],
    starter: {
      banner: "test",
      parts: [
        { type: "heading", text: "Email is working" },
        { type: "text", html: "<p>This is a test from the Etivio admin. If you can read it, the app can send email, and it should land in the inbox rather than spam.</p>" },
        { type: "button", label: "Open Etivio", href: "{{site_url}}" },
      ],
      footer: "You're getting this because someone pressed 'Send a test email' in Etivio admin.",
    },
  },
  ...(
    [
      ["confirmation", "Confirm sign-up", "Someone creates an account", "Confirm your Etivio account", "Confirm your email", "Thanks for signing up to Etivio. Confirm your email address to finish creating your account.", "Confirm my email", "You're getting this because this address was used to sign up to Etivio. If that wasn't you, you can ignore this email."],
      ["recovery", "Reset password", "Forgot password, or an admin sends a reset", "Reset your Etivio password", "Reset your password", "We got a request to reset the password for your Etivio account. The link below works once and expires soon.", "Choose a new password", "If you didn't ask to reset your password, you can ignore this email. Your password won't change."],
      ["email_change", "Change email", "Someone changes their sign-in email", "Confirm your new email address", "Confirm your new email", "You asked to change your sign-in email from <strong>{{email}}</strong> to <strong>{{new_email}}</strong>. Confirm below to finish the change.", "Confirm new email", "If you didn't ask for this change, ignore this email and consider changing your password."],
      ["magic_link", "Magic link", "Passwordless sign-in", "Your Etivio sign-in link", "Sign in to Etivio", "Use the button below to sign in. The link works once and expires soon.", "Sign in", "If you didn't try to sign in, you can ignore this email."],
      ["invite", "Invite", "An admin invites someone by email", "You've been invited to Etivio", "You're invited to Etivio", "You've been invited to join Etivio, a place to learn practical skills from instructors across Africa. Accept the invite to set up your account.", "Accept invite", "If you weren't expecting this invite, you can ignore this email."],
    ] as const
  ).map(
    ([key, label, when, subject, heading, body, cta, footer]): TemplateDef => ({
      key,
      label,
      group: "auth",
      when,
      subject,
      placeholders: [
        P("confirmation_url", "Action link", `${SITE()}/auth/callback`),
        P("email", "Their email", "ada@example.com"),
        ...(key === "email_change" ? [P("new_email", "New email", "ada.okafor@example.com")] : []),
      ],
      starter: { banner: key, parts: [{ type: "heading", text: heading }, { type: "text", html: `<p>${body}</p>` }, { type: "button", label: cta, href: "{{confirmation_url}}" }], footer },
    }),
  ),
];

// Available in every template.
export const COMMON: Placeholder[] = [P("site_url", "Etivio website", SITE()), P("settings_url", "Email preferences link", `${SITE()}/settings/notifications`)];

export const templateDef = (key: string) => TEMPLATES.find((t) => t.key === key) ?? null;
export const starterFor = (t: TemplateDef) => starterDesign(t.starter);

// Supabase fills its own tags when it sends the auth emails.
export const SUPABASE_TAGS: Record<string, string> = { confirmation_url: "{{ .ConfirmationURL }}", email: "{{ .Email }}", new_email: "{{ .NewEmail }}", site_url: "{{ .SiteURL }}" };
// The button link for one sign-in email: our /auth/confirm link, which works across devices.
export const supabaseTags = (kind: AuthEmail) => ({ ...SUPABASE_TAGS, confirmation_url: authLink(kind) });

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Swaps {{tag}} for its value. The editor may URL-encode the braces inside links, so both forms are handled.
// In HTML mode values are escaped and line breaks kept; link placeholders (…_url) are inserted as-is.
export function fillTags(src: string, vars: Record<string, string>, mode: "html" | "text") {
  return src.replace(/\{\{\s*([a-z_]+)\s*\}\}|%7B%7B\s*([a-z_]+)\s*%7D%7D/gi, (whole, a, b) => {
    const tag = (a ?? b) as string;
    if (!(tag in vars)) return whole;
    const v = vars[tag];
    if (mode === "text" || tag.endsWith("_url")) return mode === "html" ? escHtml(v) : v;
    return escHtml(v).replace(/\n/g, "<br>");
  });
}

export const sampleVars = (t: TemplateDef) => Object.fromEntries([...COMMON, ...t.placeholders].map((p) => [p.tag, p.sample]));
