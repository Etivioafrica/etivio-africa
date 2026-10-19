import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalLink } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { BadgeSeal } from "@/components/dash/Badges";
import type { Database } from "@/lib/database.types";
import { BADGE_INFO, type BadgeId } from "@/lib/badges";
import { readPrefs } from "@/lib/data/profile";
import { GOAL_LABELS, HOURS_LABELS, LEVEL_LABELS, label } from "@/lib/learner-prefs";
import { formatDate, formatDateTime } from "@/lib/format";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Db = SupabaseClient<Database>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What a learner set up on their own, split by the tab it shows on.
export async function LearnerProfile({ db, id, profile }: { db: Db; id: string; profile: Profile }) {
  const factors = await db.auth.admin.mfa.listFactors({ userId: id });
  const prefs = readPrefs(profile.notification_prefs);
  const twoStep = (factors.data?.factors ?? []).some((f) => f.status === "verified");

  return (
    <>
      <section className="et-card">
        <div className="et-card-head">
          <h2>Profile and preferences</h2>
          {profile.username && profile.profile_public && (
            <Link href={`/@${profile.username}`} target="_blank">
              Public profile <ExternalLink size={12} style={{ verticalAlign: -1 }} />
            </Link>
          )}
        </div>
        <dl className="et-kv et-card-pad">
          <dt>Username</dt>
          <dd>{profile.username ? `@${profile.username} · ${profile.profile_public ? "public" : "private"}` : "Not claimed"}</dd>
          <dt>Headline</dt>
          <dd>{profile.headline || "None"}</dd>
          <dt>Location</dt>
          <dd>{profile.location || "None"}</dd>
          <dt>Interests</dt>
          <dd>{profile.interests?.length ? profile.interests.join(", ") : "None"}</dd>
          <dt>Weekly goal</dt>
          <dd>{profile.weekly_goal ? `${profile.weekly_goal} lessons a week` : "Not set"}</dd>
          <dt>Welcome guide</dt>
          <dd>{profile.onboarded_at ? `Done ${formatDateTime(profile.onboarded_at)}` : "Not done yet"}</dd>
          <dt>Why they joined</dt>
          <dd>{label(GOAL_LABELS, profile.learning_goal) ?? "Not answered"}</dd>
          <dt>Skill level</dt>
          <dd>{label(LEVEL_LABELS, profile.skill_level) ?? "Not answered"}</dd>
          <dt>Time per week</dt>
          <dd>{label(HOURS_LABELS, profile.weekly_hours) ?? "Not answered"}</dd>
          <dt>Shows learning</dt>
          <dd>{profile.show_current_learning ? "Yes, on public profile" : "Hidden"}</dd>
          <dt>Two-step</dt>
          <dd>{twoStep ? <Status value="active" /> : "Off"}</dd>
          <dt>Emails</dt>
          <dd>
            {[prefs.course_updates && "Course updates", prefs.support_replies && "Support replies", prefs.product_news && "Etivio news"]
              .filter(Boolean)
              .join(", ") || "None"}
          </dd>
        </dl>
      </section>
    </>
  );
}

export async function LearnerAchievements({ db, id }: { db: Db; id: string }) {
  const [badges, certs, saved, notes] = await Promise.all([
    db.from("user_badges").select("badge_id, earned_at, seen_at").eq("user_id", id).order("earned_at", { ascending: false }),
    db.from("certificates").select("code, course_title, issued_at").eq("user_id", id).order("issued_at", { ascending: false }),
    db.from("saved_courses").select("created_at, course:courses(title)").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("lesson_notes").select("bookmarked", { count: "exact" }).eq("user_id", id),
  ]);
  const bookmarks = (notes.data ?? []).filter((n) => n.bookmarked).length;

  return (
    <>
      <section className="et-card">
        <div className="et-card-head">
          <h2>Badges and certificates</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            {plural(badges.data?.length ?? 0, "badge")} · {plural(certs.data?.length ?? 0, "certificate")}
          </span>
        </div>
        {badges.data?.length ? (
          <div className="et-admin-badges">
            {badges.data.map((x) => {
              const info = BADGE_INFO[x.badge_id as BadgeId];
              return (
                <div key={x.badge_id} title={`${info?.label ?? x.badge_id}: earned ${formatDate(x.earned_at)}${x.seen_at ? "" : " (not seen yet)"}`}>
                  <BadgeSeal id={x.badge_id as BadgeId} size={56} />
                  <small>{info?.label ?? x.badge_id}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="et-empty">No badges yet.</p>
        )}
        {!!certs.data?.length && (
          <ul className="et-feed" style={{ borderTop: "1px solid var(--a-border)" }}>
            {certs.data.map((c) => (
              <li key={c.code}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: "var(--a-fg)" }}>{c.course_title}</b>
                  <br />
                  <small className="et-muted">
                    {formatDate(c.issued_at)} · {c.code}
                  </small>
                </span>
                <Link href={`/certificate/${c.code}`} target="_blank" className="et-btn et-btn-ghost et-btn-sm">
                  Verify
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Saved and notes</h2>
        </div>
        <dl className="et-kv et-card-pad">
          <dt>Saved courses</dt>
          <dd>{saved.data?.length ? saved.data.map((s) => (s.course as { title: string } | null)?.title ?? "Removed course").join(", ") : "None"}</dd>
          <dt>Lesson notes</dt>
          <dd>{notes.count ?? 0}</dd>
          <dt>Bookmarks</dt>
          <dd>{bookmarks}</dd>
        </dl>
      </section>
    </>
  );
}

export async function LearnerBilling({ db, id }: { db: Db; id: string }) {
  const [billing, payout] = await Promise.all([
    db.from("billing_details").select("*").eq("user_id", id).maybeSingle(),
    db.from("payout_accounts").select("*").eq("user_id", id).maybeSingle(),
  ]);
  const p = payout.data;
  const b = billing.data;

  return (
    <>
      <section className="et-card">
        <div className="et-card-head">
          <h2>Billing and payouts</h2>
        </div>
        <dl className="et-kv et-card-pad">
          <dt>Name on receipts</dt>
          <dd>{b?.name || "Not set"}</dd>
          {b?.company && (
            <>
              <dt>Company</dt>
              <dd>{b.company}</dd>
              <dt>Address</dt>
              <dd>{[b.address, b.city].filter(Boolean).join(", ") || "None"}</dd>
              <dt>Tax ID</dt>
              <dd>{b.tax_id || "None"}</dd>
            </>
          )}
          <dt>Country</dt>
          <dd>{b?.country || "Not set"}</dd>
          <dt>Receipts to</dt>
          <dd>{b?.receipt_email || "Account email"}</dd>
          <dt>Payout account</dt>
          <dd>
            {p ? (
              <>
                {p.account_name} · {p.bank_name} · ••••{p.account_number.slice(-4)}{" "}
                {p.verified_at ? <Status value="verified" /> : <span className="et-tag">Not verified</span>}
              </>
            ) : (
              "None"
            )}
          </dd>
        </dl>
      </section>
    </>
  );
}
