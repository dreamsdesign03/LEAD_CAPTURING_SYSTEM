import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Supabase not configured. Create/keep a `.env` file at the project root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server (npm run dev).'
  )
}

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
  hot: { label: 'Hot', color: 'bg-rose-100 text-rose-700' },
  warm: { label: 'Warm', color: 'bg-amber-100 text-amber-700' },
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

export const APPOINTMENT_META = {
  booked: { label: 'Booked', color: 'bg-emerald-100 text-emerald-700' },
  not_booked: { label: 'Not booked', color: 'bg-slate-100 text-slate-500' },
}

export function appointmentMeta(appointmentBooked) {
  return appointmentBooked ? APPOINTMENT_META.booked : APPOINTMENT_META.not_booked
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

export async function fetchLeadById(id) {
  const { data, error } = await supabase
    .from('leads_with_score')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchWhatsAppConversations() {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_activity', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function fetchWhatsAppChat(leadId) {
  const [msgs, outreach] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('sent_at', { ascending: true }),
    supabase
      .from('outreach_log')
      .select('*')
      .eq('lead_id', leadId)
      .eq('channel', 'whatsapp')
      .order('sent_at', { ascending: true }),
  ])
  for (const r of [msgs, outreach]) if (r.error) throw r.error
  const chatMsgs = (msgs.data ?? []).map((m) => ({
    key: `wm:${m.id}`,
    id: m.id,
    direction: m.direction,
    content: m.content,
    template: m.template_name,
    status: m.status,
    sentAt: m.sent_at,
  }))
  const chatOutreach = (outreach.data ?? []).map((o) => ({
    key: `ol:${o.id}`,
    id: o.id,
    direction: 'outbound',
    content: o.message_content,
    template: o.meta?.template ?? null,
    status: o.status,
    sentAt: o.sent_at,
  }))
  return [...chatMsgs, ...chatOutreach].sort(
    (a, b) => new Date(a.sentAt) - new Date(b.sentAt)
  )
}

export async function markWhatsAppThreadRead(leadId) {
  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('direction', 'inbound')
    .is('read_at', null)
  if (error) throw error
}

export async function sendWhatsAppReply({ leadId, phone, message, templateName, templateParams }) {
  const url = import.meta.env.VITE_WHATSAPP_SEND_URL
  if (!url) throw new Error('WhatsApp send URL not configured. Set VITE_WHATSAPP_SEND_URL in .env')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_id: leadId,
      phone,
      message,
      template_name: templateName,
      template_params: templateParams,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data.error || `WhatsApp send failed (${res.status})`)
  return data
}