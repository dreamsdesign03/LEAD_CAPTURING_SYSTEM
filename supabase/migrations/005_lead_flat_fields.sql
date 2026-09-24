-- Migration 005: add flat columns for lead details + message
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS role    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget  TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS message TEXT;