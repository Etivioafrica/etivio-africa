-- Super admins manage other admins and financials.
-- Enum values must be committed before they are used, so this lives in its own migration.

alter type public.user_role add value if not exists 'super_admin';
