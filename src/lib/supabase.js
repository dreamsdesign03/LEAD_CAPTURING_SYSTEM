import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey)

export const SOURCE_LABELS = {
  meta: 'Meta',
  linkedin: 'LinkedIn',
  google_form: 'Google Form',
  google_sheet: 'Google Sheet',
  whatsapp: 'WhatsApp',
  calling_agent: 'Calling Agent',
  manual: 'Manual',
}

export const STATUS_META = {
  new: { label: 'New', color: 'bg-slate-100 text-slate-700' },
  qualified: { label: 'Qualified', color: 'bg-emerald-100 text-emerald-700' },
  cold: { label: 'Cold', color: 'bg-sky-100 text-sky-700' },
  contacted: { label: 'Contacted', color: 'bg-indigo-100 text-indigo-700' },
  responded: { label: 'Responded', color: 'bg-amber-100 text-amber-700' },
  converted: { label: 'Converted', color: 'bg-green-600 text-white' },
  unqualified: { label: 'Unqualified', color: 'bg-rose-100 text-rose-700' },
}

export const SOURCE_COLORS = {
  meta: '#1877F2',
  linkedin: '#0A66C2',
  google_form: '#34A853',
  google_sheet: '#F4B400',
  whatsapp: '#25D366',
  calling_agent: '#7C3AED',
  manual: '#64748B',
}

export function scoreColor(score) {
  if (score == null) return 'bg-slate-200 text-slate-600'
  if (score >= 70) return 'bg-emerald-500 text-white'
  if (score >= 40) return 'bg-amber-400 text-slate-900'
  return 'bg-rose-500 text-white'
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads_with_score')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}

export async function fetchLeadDetail(id) {
  const [lead, scores, outreach, followups] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).single(),
    supabase.from('lead_scores').select('*').eq('lead_id', id).maybeSingle(),
    supabase
      .from('outreach_log')
      .select('*')
      .eq('lead_id', id)
      .order('sent_at', { ascending: false }),
    supabase
      .from('followups')
      .select('*')
      .eq('lead_id', id)
      .order('scheduled_at', { ascending: false }),
  ])
  for (const r of [lead, scores, outreach, followups]) if (r.error) throw r.error
  return {
    lead: lead.data,
    score: scores.data,
    outreach: outreach.data ?? [],
    followups: followups.data ?? [],
  }
}