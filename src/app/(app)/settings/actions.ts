"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { bankName } from "@/lib/banks";
import type { FormState } from "../teach/actions";
import { normalizeUsername, usernameCandidates, usernameProblem } from "@/lib/username";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const text = (fd: FormData, key: string, max = 2000) => String(fd.get(key) ?? "").trim().slice(0, max);

// Accepts "example.com" or a full URL; returns a normalised https URL, "" for empty, or null when invalid.
function cleanUrl(raw: string, mustInclude?: string): string | null {
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return null;
    if (mustInclude && !url.hostname.endsWith(mustInclude)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();

  const website = cleanUrl(text(fd, "website_url"));
  if (website === null) return { error: "That website link doesn't look right." };
  const linkedin = cleanUrl(text(fd, "linkedin_url"), "linkedin.com");
  if (linkedin === null) return { error: "Use a linkedin.com link for LinkedIn." };
  const x = cleanUrl(text(fd, "x_url"));
  if (x === null || (x && !/(^|\.)(x|twitter)\.com$/.test(new URL(x).hostname))) return { error: "Use an x.com link for X." };

  const interests = [
    ...new Set(
      text(fd, "interests", 600)
        .split(",")
        .map((s) => s.trim().slice(0, 32))
        .filter(Boolean),
    ),
  ].slice(0, 12);

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: text(fd, "full_name", 80) || null,
      headline: text(fd, "headline", 120) || null,
      location: text(fd, "location", 80) || null,
      bio: text(fd, "bio") || null,
      website_url: website || null,
      linkedin_url: linkedin || null,
      x_url: x || null,
      interests,
      profile_public: fd.get("profile_public") === "on",
      show_current_learning: fd.get("show_current_learning") === "on",
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your profile." };
  refresh();
  return { ok: "Profile saved." };
}

export async function updateNotifications(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  const { error } = await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        course_updates: fd.get("course_updates") === "on",
        support_replies: fd.get("support_replies") === "on",
        product_news: fd.get("product_news") === "on",
      },
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your preferences." };
  refresh();
  return { ok: "Preferences saved." };
}

export async function changeEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  const email = text(fd, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (email === user.email) return { error: "That's already your email." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://etivio.co";
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${site}/auth/callback?next=/settings/account` });
  if (error) return { error: error.status === 429 ? "Too many emails sent. Try again in an hour." : error.message };
  return { ok: `Confirmation links sent to ${user.email} and ${email}. Your email changes once you confirm.` };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  const current = String(fd.get("current_password") ?? "");
  const next = String(fd.get("new_password") ?? "");
  const confirm = String(fd.get("confirm_password") ?? "");

  if (next.length < 8) return { error: "Use at least 8 characters for your new password." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  const hasPassword = (user.app_metadata?.providers as string[] | undefined)?.includes("email");
  if (hasPassword) {
    const { error } = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
    if (error) return { error: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.code === "same_password" ? "Pick a password you haven't used here before." : error.message };
  return { ok: hasPassword ? "Password updated." : "Password set. You can now also sign in with your email." };
}

export async function signOutEverywhere() {
  const { supabase } = await authed();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

// Soft delete, same as an admin delete: hidden immediately, restorable by staff for 30 days, then purged.
export async function deleteAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  if (text(fd, "confirm") !== "DELETE") return { error: 'Type DELETE to confirm.' };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", user.id);
  if (error) return { error: "Could not delete your account. Contact support." };

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function setDefaultCard(fd: FormData) {
  const { supabase, user } = await authed();
  const id = String(fd.get("id") ?? "");
  // One default per user (partial unique index), so clear the old one first.
  await supabase.from("payment_methods").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  await supabase.from("payment_methods").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  refresh();
}

export async function removeCard(fd: FormData) {
  const { supabase, user } = await authed();
  await supabase.from("payment_methods").delete().eq("id", String(fd.get("id") ?? "")).eq("user_id", user.id);
  refresh();
}

// Cover banner saves immediately on upload, separate from the details form.
export async function saveCover(url: string | null) {
  const { supabase, user } = await authed();
  if (url && !/^https?:\/\//.test(url)) return { error: "Invalid image URL." };
  const { error } = await supabase.from("profiles").update({ cover_url: url }).eq("id", user.id);
  if (error) return { error: "Could not save your cover." };
  refresh();
  return {};
}

export type UsernameCheck = {
  name: string;
  status: "available" | "taken" | "invalid" | "current" | "empty";
  message: string;
  suggestions: string[];
};

// Up to 4 free usernames built from what was typed and the user's name.
async function freeSuggestions(supabase: Awaited<ReturnType<typeof createClient>>, seeds: string[]) {
  const candidates = usernameCandidates(seeds);
  if (!candidates.length) return [];
  const { data } = await supabase.from("profiles").select("username").in("username", candidates);
  const taken = new Set((data ?? []).map((r) => r.username));
  return candidates.filter((c) => !taken.has(c)).slice(0, 4);
}

// Live availability check for the username picker in Settings > My details.
export async function checkUsername(raw: string): Promise<UsernameCheck> {
  const { supabase, user } = await authed();
  const name = normalizeUsername(raw).slice(0, 40);
  const { data: me } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).single();
  const seeds = [name, me?.full_name ?? "", user.email?.split("@")[0] ?? ""];

  if (!name) return { name, status: "empty", message: "", suggestions: await freeSuggestions(supabase, seeds) };
  if (name === me?.username) return { name, status: "current", message: "This is your current username.", suggestions: [] };

  const problem = usernameProblem(name);
  if (problem) return { name, status: "invalid", message: problem, suggestions: await freeSuggestions(supabase, seeds) };

  const { data: existing } = await supabase.from("profiles").select("id").eq("username", name).maybeSingle();
  if (existing) return { name, status: "taken", message: `@${name} is taken.`, suggestions: await freeSuggestions(supabase, seeds) };
  return { name, status: "available", message: `@${name} is available.`, suggestions: [] };
}

// Saves the username once the user confirms it in the picker.
export async function claimUsername(raw: string): Promise<{ ok?: string; error?: string }> {
  const { supabase, user } = await authed();
  const name = normalizeUsername(raw);
  const problem = usernameProblem(name);
  if (problem) return { error: problem };
  const { error } = await supabase.from("profiles").update({ username: name }).eq("id", user.id);
  if (error?.code === "23505") return { error: `Someone just took @${name}. Pick another.` };
  if (error) return { error: "Could not save your username." };
  refresh();
  return { ok: `You're now @${name}.` };
}

// Profile photo saves immediately from the crop modal, separate from the details form.
export async function saveAvatar(url: string | null) {
  const { supabase, user } = await authed();
  if (url && !/^https?:\/\//.test(url)) return { error: "Invalid image URL." };
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: "Could not save your photo." };
  refresh();
  return {};
}

export async function saveBillingDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await authed();
  const receipt = text(fd, "receipt_email", 254).toLowerCase();
  if (receipt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receipt)) return { error: "Enter a valid email for receipts." };

  // With the company switch off, the hidden company fields are cleared rather than kept.
  const company = fd.get("company_invoice") === "on";
  const { error } = await supabase.from("billing_details").upsert({
    user_id: user.id,
    name: text(fd, "name", 120) || null,
    company: (company && text(fd, "company", 120)) || null,
    address: (company && text(fd, "address", 300)) || null,
    city: (company && text(fd, "city", 80)) || null,
    country: text(fd, "country", 80) || null,
    tax_id: (company && text(fd, "tax_id", 40)) || null,
    receipt_email: receipt && receipt !== user.email ? receipt : null,
  });
  if (error) return { error: "Could not save your billing details." };
  refresh();
  return { ok: "Billing details saved." };
}

// Confirms the account holder's name with Paystack when a secret key is configured.
async function resolveAccount(accountNumber: string, bankCode: string): Promise<string | null> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const body = (await res.json()) as { status?: boolean; data?: { account_name?: string } };
    return body.status && body.data?.account_name ? body.data.account_name : null;
  } catch {
    return null;
  }
}

// Tutor payout account. Written with the service role so `verified_at` can't be set from the browser.
export async function savePayoutAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) return { error: "Only tutors can add a payout account." };

  const bankCode = text(fd, "bank_code", 10);
  const bank = bankName(bankCode);
  const accountNumber = text(fd, "account_number", 20).replace(/\D/g, "");
  if (!bank) return { error: "Pick your bank." };
  if (accountNumber.length !== 10) return { error: "Account numbers are 10 digits." };

  const resolved = await resolveAccount(accountNumber, bankCode);
  const accountName = resolved ?? text(fd, "account_name", 120);
  if (!accountName) return { error: "Enter the name on the account." };
  if (process.env.PAYSTACK_SECRET_KEY && !resolved) return { error: "We couldn't find that account. Check the number and bank." };

  const { error } = await createAdminClient().from("payout_accounts").upsert({
    user_id: user.id,
    bank_code: bankCode,
    bank_name: bank,
    account_number: accountNumber,
    account_name: accountName,
    verified_at: resolved ? new Date().toISOString() : null,
  });
  if (error) return { error: "Could not save your payout account." };
  refresh();
  return { ok: resolved ? `Saved and verified: ${resolved}.` : "Payout account saved. We'll verify it before your first payout." };
}
