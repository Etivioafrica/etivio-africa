import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Export your data" in Settings > Account. Runs as the user, so RLS keeps it to their own rows.
export async function GET() {
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

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="etivio-data-${body.exported_at.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
