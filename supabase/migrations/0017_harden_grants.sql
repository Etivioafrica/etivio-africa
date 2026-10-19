-- Etivio Africa: tighten table privileges on private learner tables.
-- Supabase's default grants gave `anon` full privileges (including TRUNCATE, which ignores RLS) on new tables.
-- Signed-out visitors never touch these tables, and nobody needs TRUNCATE/TRIGGER/REFERENCES through the API.

revoke all on public.billing_details, public.lesson_notes, public.saved_courses, public.payout_accounts,
  public.certificates, public.user_badges, public.payment_methods
  from anon;

revoke truncate, trigger, references on public.billing_details, public.lesson_notes, public.saved_courses,
  public.payout_accounts, public.certificates, public.user_badges, public.payment_methods
  from authenticated;
