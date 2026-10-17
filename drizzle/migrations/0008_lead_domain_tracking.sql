ALTER TABLE public.leads
  ADD COLUMN domain_name text,
  ADD COLUMN domain_registrar text,
  ADD COLUMN domain_expiry_date date,
  ADD COLUMN domain_checked_at timestamp with time zone,
  ADD COLUMN domain_reminders_sent jsonb not null default '[]'::jsonb;