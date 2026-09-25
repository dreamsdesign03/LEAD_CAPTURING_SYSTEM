-- Migration 007: WhatsApp chat inbox
-- Stores WhatsApp messages (inbound + outbound) so the dashboard can render
-- per-lead WhatsApp conversations like a chat app (mirrors the Aura AI inbox).

-- 1. Messages table ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone          TEXT,
  direction      TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content        TEXT,
  template_name  TEXT,
  wa_message_id  TEXT,
  status         TEXT DEFAULT 'sent',
  read_at        TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead
  ON public.whatsapp_messages (lead_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_waid
  ON public.whatsapp_messages (wa_message_id);

-- 2. RLS (same dev-wide-open policy style as the other tables) --------------
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'dev_all_whatsapp_messages'
  ) THEN
    CREATE POLICY dev_all_whatsapp_messages ON public.whatsapp_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- 3. Fuzzy phone lookup for inbound webhooks -------------------------------
-- Meta sends FROM as the raw digits (e.g. 918866351852) but leads store
-- +918866351852. Matches on the last 10 digits so it works either way.
CREATE OR REPLACE FUNCTION public.find_lead_by_whatsapp(p_phone TEXT)
RETURNS TABLE (lead_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  IF digits = '' THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;
  RETURN QUERY
  SELECT l.id
  FROM public.leads l
  WHERE regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
        LIKE '%' || right(digits, 10)
  LIMIT 1;
END;
$$;

-- 4. Conversations view (dashboard inbox list) ------------------------------
-- A conversation exists per lead that has ANY WhatsApp activity: an inbound
-- chat message OR a WhatsApp outreach_log entry (templates/reminders).
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
WHERE wm.lead_id IS NOT NULL OR ol.lead_id IS NOT NULL;