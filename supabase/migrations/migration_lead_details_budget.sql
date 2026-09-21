-- Migration: lead detail columns + budget tier band + hot/warm/cold status
-- Idempotent: safe to run multiple times / on existing installs.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS role     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city     TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget   TEXT
  CHECK (budget IS NULL OR budget IN
    ('$350-$500','$500-$750','$750-$1,000','$1,000-$1,500','$1,500-$2,500','$2,500-$5,000','Over $5,000'));

-- widen status: hot/warm join the old 'qualified' tier (backfill qualified -> hot)
UPDATE public.leads SET status = 'hot' WHERE status = 'qualified';
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new','hot','warm','cold','contacted','responded','converted','unqualified'));
