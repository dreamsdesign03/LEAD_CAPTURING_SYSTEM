-- Migration 006: recreate leads_with_score so it includes the new
-- lead columns (company/role/budget/message + appointment_booked/reminders_sent).
-- PostgREST serves the view's column list as fixed at creation time, so run this
-- after migrations 003-005 to expose the new fields to the dashboard.

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