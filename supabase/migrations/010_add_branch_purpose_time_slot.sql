-- Migration 010: Add branch, purpose, and time_slot columns to public.leads

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS time_slot TEXT;

-- Recreate view so PostgREST API exposes new columns immediately
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
