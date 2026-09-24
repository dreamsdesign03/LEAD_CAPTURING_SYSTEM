-- Migration 004: appointment booking tracking + reminder counters
-- Idempotent - safe to run in the Supabase SQL editor.

-- 1) True when the prospect books via the WhatsApp template (Calendly/inbound) - default false
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS appointment_booked BOOLEAN NOT NULL DEFAULT false;

-- 2) Reminder bookkeeping: how many reminders were sent + when the last one went out
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reminders_sent     INT NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_reminder_at   TIMESTAMPTZ;

-- 3) Index used by the reminder cron workflow
CREATE INDEX IF NOT EXISTS idx_leads_reminders
  ON public.leads (status, appointment_booked, reminders_sent);