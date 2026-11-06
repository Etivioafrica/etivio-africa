import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Export your data" in Settings > Account. Runs as the user, so RLS keeps it to their own rows.
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "html";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [profile, priv, roles, enrollments, progress, payments, threads, applications, billing, payout] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, username, profile_public, avatar_url, cover_url, bio, headline, location, website_url, linkedin_url, x_url, interests, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("my_profile").maybeSingle(),
    supabase.from("user_roles").select("role, granted_at").eq("user_id", user.id),
    supabase.from("enrollments").select("enrolled_at, completed_at, course:courses(id, title)").eq("user_id", user.id),
    supabase.from("lesson_progress").select("completed_at, lesson:lessons(id, title, course_id)").eq("user_id", user.id),
    supabase.from("payments").select("reference, amount_minor, currency, status, provider, paid_at, created_at, course:courses(title)").eq("user_id", user.id),
    supabase.from("support_threads").select("id, subject, status, created_at, messages:support_messages(is_staff, body, created_at)").eq("user_id", user.id),
    supabase.from("role_applications").select("role, status, message, created_at").eq("user_id", user.id),
    supabase.from("billing_details").select("name, company, address, city, country, tax_id, receipt_email, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("payout_accounts").select("bank_name, account_number, account_name, verified_at").eq("user_id", user.id).maybeSingle(),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      sign_in_methods: user.app_metadata?.providers ?? [],
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profile.data,
    preferences: priv.data
      ? {
          notifications: priv.data.notification_prefs,
          weekly_goal: priv.data.weekly_goal,
          show_current_learning: priv.data.show_current_learning,
          welcome_guide: {
            completed_at: priv.data.onboarded_at,
            learning_goal: priv.data.learning_goal,
            skill_level: priv.data.skill_level,
            weekly_hours: priv.data.weekly_hours,
          },
        }
      : null,
    roles: roles.data ?? [],
    enrollments: enrollments.data ?? [],
    lesson_progress: progress.data ?? [],
    payments: (payments.data ?? []).map((p) => ({ ...p, amount: p.amount_minor / 100 })),
    support_threads: threads.data ?? [],
    role_applications: applications.data ?? [],
    billing_details: billing.data,
    payout_account: payout.data ? { ...payout.data, account_number: `******${payout.data.account_number.slice(-4)}` } : null,
  };

  const day = body.exported_at.slice(0, 10);
  if (format === "json") {
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="etivio-data-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  }
  return new NextResponse(renderReadable(body), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="etivio-data-${day}.html"`,
      "cache-control": "no-store",
    },
  });
}

// ---- Readable version: a plain page anyone can open in a browser, read, search and print to PDF. ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const yes = (v: unknown) => (v ? "Yes" : "No");
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

function facts(rows: [string, unknown][]) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!shown.length) return "<p class=none>Nothing saved.</p>";
  return `<table class=facts>${shown.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
}
function list(head: string[], rows: unknown[][], empty: string) {
  if (!rows.length) return `<p class=none>${esc(empty)}</p>`;
  return `<table class=list><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
const section = (title: string, note: string, html: string) => `<section><h2>${esc(title)}</h2><p class=note>${esc(note)}</p>${html}</section>`;

function renderReadable(b: Record<string, any>) {
  const a = b.account ?? {};
  const pr: Row = b.profile ?? {};
  const pf = b.preferences;
  const money = (n: number, cur: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency: cur || "NGN" }).format(n);
  const sections = [
    section("Your account", "The basics we use to sign you in.", facts([["Email", a.email], ["Account created", when(a.created_at)], ["Last signed in", when(a.last_sign_in_at)], ["Sign-in methods", (a.sign_in_methods ?? []).join(", ")]])),
    section("Your profile", "What you have filled in on your profile.", facts([["Name", pr.full_name], ["Username", pr.username ? `@${pr.username}` : ""], ["Headline", pr.headline], ["Bio", pr.bio], ["Location", pr.location], ["Website", pr.website_url], ["LinkedIn", pr.linkedin_url], ["X", pr.x_url], ["Interests", (pr.interests ?? []).join(", ")], ["Profile is public", yes(pr.profile_public)], ["Profile photo", pr.avatar_url ? "Uploaded" : "None"], ["Joined", when(pr.created_at)]])),
    section("Your preferences", "Your learning goals and notification choices.", pf ? facts([["Weekly lesson goal", pf.weekly_goal ? `${pf.weekly_goal} lessons` : ""], ["Learning goal", pf.welcome_guide?.learning_goal], ["Skill level", pf.welcome_guide?.skill_level], ["Time available", pf.welcome_guide?.weekly_hours], ["Show what I'm learning on my profile", yes(pf.show_current_learning)], ["Course update emails", yes(pf.notifications?.course_updates)], ["Support reply emails", yes(pf.notifications?.support_replies)], ["Product news emails", yes(pf.notifications?.product_news)]]) : "<p class=none>Nothing saved.</p>"),
    section("Your roles", "What you are allowed to do on Etivio.", list(["Role", "Since"], (b.roles ?? []).map((r: Row) => [String(r.role).replace(/_/g, " "), when(r.granted_at)]), "No special roles.")),
    section("Courses you joined", "Every course you enrolled in.", list(["Course", "Joined", "Finished"], (b.enrollments ?? []).map((e: Row) => [one(e.course as Row)?.title, when(e.enrolled_at), e.completed_at ? when(e.completed_at) : "Not yet"]), "You have not joined any course.")),
    section("Lessons you completed", "Each lesson you marked as done.", list(["Lesson", "Completed"], (b.lesson_progress ?? []).map((l: Row) => [one(l.lesson as Row)?.title, when(l.completed_at)]), "No lessons completed yet.")),
    section("Payments", "Your purchases and wallet top-ups paid through Paystack.", list(["Date", "For", "Amount", "Status", "Reference"], (b.payments ?? []).map((p: Row) => [when(p.paid_at ?? p.created_at), one(p.course as Row)?.title ?? "Etivio", money(Number(p.amount), String(p.currency)), p.status, p.reference]), "No payments.")),
    section("Support chats", "Your conversations with the Etivio team.", (b.support_threads ?? []).length ? (b.support_threads as Row[]).map((t) => `<h3>${esc(t.subject || "Support chat")} <span class=tag>${esc(t.status)}</span></h3>${list(["When", "From", "Message"], ((t.messages as Row[]) ?? []).sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))).map((m) => [when(m.created_at), m.is_staff ? "Etivio" : "You", m.body]), "No messages.")}`).join("") : "<p class=none>No support chats.</p>"),
    section("Applications", "Requests you made to take on a role.", list(["Role", "Status", "Sent", "Your message"], (b.role_applications ?? []).map((r: Row) => [String(r.role).replace(/_/g, " "), r.status, when(r.created_at), r.message]), "No applications.")),
    section("Billing details", "Used on your receipts.", b.billing_details ? facts([["Name", b.billing_details.name], ["Company", b.billing_details.company], ["Address", [b.billing_details.address, b.billing_details.city, b.billing_details.country].filter(Boolean).join(", ")], ["Tax ID", b.billing_details.tax_id], ["Receipt email", b.billing_details.receipt_email]]) : "<p class=none>Nothing saved.</p>"),
    ...(b.payout_account ? [section("Payout account", "Where your earnings are paid. The account number is hidden except the last 4 digits.", facts([["Bank", b.payout_account.bank_name], ["Account name", b.payout_account.account_name], ["Account number", b.payout_account.account_number], ["Verified", b.payout_account.verified_at ? when(b.payout_account.verified_at) : "Not yet"]]))] : []),
  ];
  return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>My Etivio data</title><style>
body{margin:0;background:#f4f6fb;color:#0f172a;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px 64px}
header{margin-bottom:24px}h1{margin:0 0 4px;font-size:28px}header p{margin:0;color:#64748b}
button{margin-top:14px;padding:9px 16px;border:0;border-radius:9px;background:#2563eb;color:#fff;font:600 14px inherit;cursor:pointer}
section{margin-top:20px;padding:20px 22px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;break-inside:avoid-page}
h2{margin:0;font-size:18px}h3{margin:18px 0 6px;font-size:15px}.note{margin:2px 0 12px;color:#64748b;font-size:13.5px}.none{margin:0;color:#94a3b8}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:8px 10px;text-align:left;vertical-align:top;border-top:1px solid #e2e8f0}
.facts th{width:34%;color:#64748b;font-weight:600}.list thead th{border-top:0;color:#64748b;font-size:12.5px;text-transform:uppercase;letter-spacing:.04em}
td{overflow-wrap:anywhere}.tag{margin-left:6px;padding:2px 8px;border-radius:99px;background:#e2e8f0;font-size:12px;font-weight:600}
@media print{body{background:#fff}button{display:none}section{border-color:#cbd5e1}}
</style></head><body><main><header><h1>My Etivio data</h1><p>Prepared ${esc(when(b.exported_at))} for ${esc(a.email)}. This is a copy of everything Etivio holds about you.</p><button type=button onclick="window.print()">Print or save as PDF</button></header>${sections.join("")}</main></body></html>`;
}
