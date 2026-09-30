-- Migration 011: Clean leads table schema with CASCADE drop of dependent views
-- Keeps only: name, email, phone, source, branch, purpose, time_slot, message

-- 1. Drop dependent views with CASCADE so columns can be modified safely
DROP VIEW IF EXISTS public.whatsapp_conversations CASCADE;
DROP VIEW IF EXISTS public.leads_with_score CASCADE;

-- 2. Add requested columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS branch    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS purpose   TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS time_slot TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS message   TEXT;

-- 3. Drop unwanted extra columns
ALTER TABLE public.leads DROP COLUMN IF EXISTS company CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS industry CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS city CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS website CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS budget CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS notes CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS assigned_to CASCADE;

-- 4. Recreate public.whatsapp_conversations view
CREATE OR REPLACE VIEW public.whatsapp_conversations AS
WITH wm AS (
  SELECT
    lead_id,
    MAX(sent_at) AS last_at,
    (ARRAY_AGG(content ORDER BY sent_at DESC))[1] AS last_message,
    COUNT(*) FILTER (WHERE direction = 'inbound' AND read_at IS NULL) AS unread_count
  FROM public.whatsapp_messages
  GROUP BY lead_id
),
ol AS (
  SELECT
    lead_id,
    MAX(sent_at) AS last_at,
    (ARRAY_AGG(message_content ORDER BY sent_at DESC))[1] AS last_message
  FROM public.outreach_log
  WHERE channel = 'whatsapp'
  GROUP BY lead_id
)
SELECT
  l.id AS lead_id,
  l.name,
  l.branch,
  l.phone,
  l.email,
  l.status AS lead_status,
  l.appointment_booked,
  COALESCE(wm.last_message, ol.last_message) AS last_message,
  GREATEST(wm.last_at, ol.last_at, l.updated_at) AS last_activity,
  COALESCE(wm.unread_count, 0) AS unread_count
FROM public.leads l
LEFT JOIN wm ON wm.lead_id = l.id
LEFT JOIN ol ON ol.lead_id = l.id
ORDER BY GREATEST(wm.last_at, ol.last_at, l.updated_at) DESC;

-- 5. Recreate public.leads_with_score view
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
