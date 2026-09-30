-- =====================================================================
-- LEAD CAPTURING SYSTEM - MASTER DATABASE INITIALIZATION SCRIPT
-- Paste and Run in Supabase Dashboard > SQL Editor
-- This will safely reset and set up all tables, views, indexes, & triggers
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. CLEANUP (Drop existing views and tables safely)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.whatsapp_conversations CASCADE;
DROP VIEW IF EXISTS public.leads_with_score CASCADE;

DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.lead_scores CASCADE;
DROP TABLE IF EXISTS public.outreach_log CASCADE;
DROP TABLE IF EXISTS public.followups CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 2. LEADS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  email              TEXT,
  phone              TEXT,
  source             TEXT NOT NULL DEFAULT 'whatsapp'
                     CHECK (source IN ('meta','linkedin','google_form','google form','google_sheet','google sheet','whatsapp','calling_agent','calling agent','manual')),
  branch             TEXT,
  purpose            TEXT,
  time_slot          TEXT,
  message            TEXT,
  raw_data           JSONB DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','hot','warm','cold','qualified','contacted','responded','converted','unqualified')),
  appointment_booked BOOLEAN NOT NULL DEFAULT false,
  reminders_sent     INT     NOT NULL DEFAULT 0,
  last_reminder_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. LEAD SCORES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.lead_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score       INT  NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown   JSONB DEFAULT '{}'::jsonb,
  reasoning   TEXT,
  qualified   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

-- ---------------------------------------------------------------------
-- 4. WHATSAPP MESSAGES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.whatsapp_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content       TEXT,
  media_url     TEXT,
  template_name TEXT,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  wa_message_id TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at       TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- 5. OUTREACH LOG TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.outreach_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email','whatsapp','ai_call')),
  status          TEXT NOT NULL DEFAULT 'sent',
  message_content TEXT,
  meta            JSONB DEFAULT '{}'::jsonb,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. FOLLOW-UPS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.followups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('email','whatsapp','ai_call')),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  attempt       INT  NOT NULL DEFAULT 1,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. CONFIG TABLE
-- ---------------------------------------------------------------------
CREATE TABLE public.config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Config Values
INSERT INTO public.config (key, value) VALUES
  ('qualifier', '{"threshold": 70, "model": "gpt-4o-mini", "max_followups": 3, "followup_intervals_days": [1, 3, 7]}'::jsonb),
  ('ai_call',   '{"provider": "vapi", "phone_number_id": "", "voice": "alloy"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX idx_leads_source           ON public.leads (source);
CREATE INDEX idx_leads_status           ON public.leads (status);
CREATE INDEX idx_leads_phone            ON public.leads (phone);
CREATE INDEX idx_leads_created_at       ON public.leads (created_at DESC);
CREATE INDEX idx_scores_lead            ON public.lead_scores (lead_id);
CREATE INDEX idx_wa_messages_lead       ON public.whatsapp_messages (lead_id);
CREATE INDEX idx_wa_messages_phone      ON public.whatsapp_messages (phone);
CREATE INDEX idx_wa_messages_sent_at    ON public.whatsapp_messages (sent_at DESC);
CREATE INDEX idx_outreach_lead          ON public.outreach_log (lead_id);

-- ---------------------------------------------------------------------
-- 9. TRIGGERS & FUNCTIONS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated ON public.leads;
CREATE TRIGGER trg_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_config_updated ON public.config;
CREATE TRIGGER trg_config_updated
  BEFORE UPDATE ON public.config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. RPC SEARCH FUNCTIONS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_lead_by_whatsapp(p_phone TEXT)
RETURNS TABLE (lead_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) > 10 THEN
    v_digits := right(v_digits, 10);
  END IF;

  RETURN QUERY
  SELECT l.id
  FROM public.leads l
  WHERE regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE '%' || v_digits
  ORDER BY l.created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_lead_by_contact(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS TABLE (lead_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id
  FROM public.leads l
  WHERE (p_email IS NOT NULL AND p_email <> '' AND l.email = p_email)
     OR (p_phone IS NOT NULL AND p_phone <> '' AND l.phone = p_phone)
  LIMIT 1;
END;
$$;

-- ---------------------------------------------------------------------
-- 11. VIEWS
-- ---------------------------------------------------------------------

-- View 1: leads_with_score (Dashboard)
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

-- View 2: whatsapp_conversations (WhatsApp Inbox UI)
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

-- ---------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config            ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_all_leads       ON public.leads             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_scores      ON public.lead_scores       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_wa_messages ON public.whatsapp_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_outreach    ON public.outreach_log      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_followups   ON public.followups         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_config      ON public.config            FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 13. REALTIME PUBLICATION
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_log;
