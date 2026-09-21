-- Migration 003: lead detail columns + budget band + hot/warm/cold status
-- Idempotent — safe to run in the Supabase SQL editor.
-- Kept idempotent database-side so it works in edits.

-- 1) Detail columns (company, role, industry, city, website, whatsapp)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS role     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 2) Budget band (7-option dropdown, stored as the label)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget TEXT;

-- 3) Widen status to hot/warm/cold + backfill old 'qualified'
UPDATE public.leads SET status = 'hot' WHERE status = 'qualified';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new','hot','warm','cold','contacted','responded','converted','unqualified'));
