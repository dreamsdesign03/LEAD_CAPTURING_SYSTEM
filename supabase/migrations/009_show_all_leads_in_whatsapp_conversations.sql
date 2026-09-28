-- Migration 009: Show ALL leads in WhatsApp Inbox conversations list
-- Removes the WHERE filter so every lead in the database shows up in the WhatsApp Inbox list,
-- sorted by most recent message/activity first.

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
  l.company,
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
