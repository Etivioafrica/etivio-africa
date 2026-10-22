-- Runs the abandoned-checkout reminders every 10 minutes. The bearer secret is read from Supabase Vault (name
-- 'cron_secret', the same value as CRON_SECRET in Vercel) so it never sits in this public repo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'checkout-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://etivio.co/api/cron/checkout-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
  );
  $$
);
