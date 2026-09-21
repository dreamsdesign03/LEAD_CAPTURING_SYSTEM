-- =====================================================================
-- Lead Capturing System - Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 2. LEADS (all sources: meta, linkedin, google_form, google_sheet, whatsapp, calling_agent)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  source      TEXT NOT NULL CHECK (source IN ('meta','linkedin','google_form','google_sheet','whatsapp','calling_agent','manual')),
  raw_data    JSONB DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','qualified','cold','contacted','responded','converted','unqualified')),
  assigned_to TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. LEAD SCORES (AI qualifier output)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_scores (
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
-- 4. OUTREACH LOG (email / whatsapp / ai_call)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email','whatsapp','ai_call')),
  status          TEXT NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent','delivered','opened','replied','failed','not_answered')),
  message_content TEXT,
  meta            JSONB DEFAULT '{}'::jsonb,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. FOLLOW-UPS (scheduled reminders)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.followups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('email','whatsapp','ai_call')),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','done','skipped')),
  attempt       INT  NOT NULL DEFAULT 1,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. CONFIG (thresholds, settings for n8n / AI agent)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default config values
INSERT INTO public.config (key, value) VALUES
  ('qualifier', '{"threshold": 70, "model": "gpt-4o-mini", "max_followups": 3, "followup_intervals_days": [1, 3, 7]}'::jsonb),
  ('ai_call',   '{"provider": "vapi", "phone_number_id": "", "voice": "alloy"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_source        ON public.leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_status        ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at    ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_lead         ON public.lead_scores (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_lead       ON public.outreach_log (lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_pending   ON public.followups (status, scheduled_at);

-- ---------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGER
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
-- 9. VIEW: leads joined with latest score (dashboard uses this)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (enable after creating auth / anon keys)
--     By default everything is locked. Open these once you have real
--     users or keep anon access using service-role keys in n8n only.
-- ---------------------------------------------------------------------
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config        ENABLE ROW LEVEL SECURITY;

-- Allow all (DEV ONLY - remove in production and use auth):
DROP POLICY IF EXISTS dev_all_leads        ON public.leads;
DROP POLICY IF EXISTS dev_all_scores       ON public.lead_scores;
DROP POLICY IF EXISTS dev_all_outreach     ON public.outreach_log;
DROP POLICY IF EXISTS dev_all_followups    ON public.followups;
DROP POLICY IF EXISTS dev_all_config       ON public.config;

CREATE POLICY dev_all_leads       ON public.leads        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_scores      ON public.lead_scores  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_outreach    ON public.outreach_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_followups   ON public.followups    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dev_all_config      ON public.config       FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 11. REALTIME (for live dashboard updates)
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_log;

-- ---------------------------------------------------------------------
-- 12. RPC: find existing lead by email OR phone (used by n8n dedupe)
--     Call: POST /rest/v1/rpc/find_lead_by_contact  {"p_email":"..","p_phone":".."}
-- ---------------------------------------------------------------------
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