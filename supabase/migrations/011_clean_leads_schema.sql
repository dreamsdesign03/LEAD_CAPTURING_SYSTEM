-- Migration 011: Clean leads table - Keep only requested lead fields
-- Target JSON fields: name, email, phone, source, branch, purpose, time_slot, message

-- 1. Ensure required columns exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS branch    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS purpose   TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS time_slot TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS message   TEXT;

-- 2. Drop unused / unwanted columns
ALTER TABLE public.leads DROP COLUMN IF EXISTS company;
ALTER TABLE public.leads DROP COLUMN IF EXISTS role;
ALTER TABLE public.leads DROP COLUMN IF EXISTS industry;
ALTER TABLE public.leads DROP COLUMN IF EXISTS city;
ALTER TABLE public.leads DROP COLUMN IF EXISTS website;
ALTER TABLE public.leads DROP COLUMN IF EXISTS budget;
ALTER TABLE public.leads DROP COLUMN IF EXISTS notes;
ALTER TABLE public.leads DROP COLUMN IF EXISTS assigned_to;

-- 3. Recreate view to match clean schema
DROP VIEW IF EXISTS public.leads_with_score CASCADE;

CREATE OR REPLACE VIEW public.leads_with_score AS
SELECT
  l.*,
  s.score,
  s.breakdown,
  s.reasoning,
  s.qualified AS ai_qualified,
  CASE
    WHEN s.score IS NULL THEN 0
    WHEN s.score >= coalesce((SELECT (value->>'threshold')::int FROM public.config WHERE key = 'qualifier'), 70) THEN 1
    ELSE 0
  END AS is_hot
FROM public.leads l
LEFT JOIN public.lead_scores s ON s.lead_id = l.id;
