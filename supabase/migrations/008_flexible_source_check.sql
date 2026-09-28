-- Migration 008: Flexible leads_source_check constraint
-- Allows both underscore and spaced source values ('google_form', 'google form', etc.)

DO $$
BEGIN
  IF exists(SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check') THEN
    ALTER TABLE public.leads DROP CONSTRAINT leads_source_check;
  END IF;
END $$;

ALTER TABLE public.leads ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'meta',
    'linkedin',
    'google_form',
    'google form',
    'google_sheet',
    'google sheet',
    'whatsapp',
    'calling_agent',
    'calling agent',
    'manual'
  ));
