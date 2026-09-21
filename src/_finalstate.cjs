const fs = require('fs');
// ---- 1) Ensure idempotent migrations dir + migration file in REAL tree ----
const dir = 'supabase/migrations';
fs.mkdirSync(dir, { recursive: true });
const MIG = `-- Migration: lead detail columns + budget tier band + hot/warm/cold status
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
`;
fs.writeFileSync(dir + '/migration_lead_details_budget.sql', MIG, 'utf8');

// ---- 2) Fix stale status CHECK in real schema.sql ----
const p = 'supabase/schema.sql';
let s = fs.readFileSync(p, 'utf8');
// replace old status check values with tier-aware version
s = s.replace(/'new','qualified','cold','contacted','responded','converted','unqualified'/, "'new','hot','warm','cold','contacted','responded','converted','unqualified'");
s = s.replace(/('qualified','cold'|'cold','contacted')/g, "'warm','cold','contacted'");
fs.writeFileSync(p, s, 'utf8');
console.log('migration written:', fs.existsSync(dir + '/migration_lead_details_budget.sql'));
console.log('schema hotwarm now:', fs.readFileSync(p, 'utf8').includes("'new','hot','warm','cold'"));
