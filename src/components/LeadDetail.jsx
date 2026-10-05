import { useEffect, useState } from 'react'
import { X, MessageSquare, Sparkles, Calendar, CheckCircle2, Clock, ShieldCheck, User } from 'lucide-react'
import {
  SOURCE_LABELS,
  STATUS_META,
  appointmentMeta,
  fetchLeadDetail,
  formatDate,
  scoreColor,
} from '../lib/supabase'

const BREAKDOWN_LABELS = {
  urgency: 'Urgency',
  specificity: 'Specificity',
  treatment_value: 'Treatment Value',
  booking_readiness: 'Booking Readiness',
  budget: 'Budget',
  authority: 'Authority',
  need: 'Need',
  timing: 'Timing',
}
const CHANNEL_LABELS = { email: 'Email', whatsapp: 'WhatsApp', ai_call: 'AI Call' }

const AURA_PINK = '#CB3273'

export default function LeadDetail({ leadId, onClose, onOpenChat }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!leadId) return
    let stale = false
    setData(null)
    setError(null)
    fetchLeadDetail(leadId)
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [leadId])

  if (!leadId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-pink-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {error && (
          <div className="border-b border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            Failed to load lead details: {error}
          </div>
        )}

        {data ? (
          <LeadDetailBody data={data} onClose={onClose} onOpenChat={onOpenChat} />
        ) : (
          <div className="p-16 text-center text-xs font-semibold text-slate-400 flex flex-col items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-400 animate-pulse" />
            Loading lead profile…
          </div>
        )}
      </div>
    </div>
  )
}

function LeadDetailBody({ data, onClose, onOpenChat }) {
  const { lead, score, outreach, followups } = data
  const meta = STATUS_META[lead.status]

  return (
    <div className="flex flex-col max-h-[85vh] overflow-hidden">
      {/* Modal Header */}
      <div className="flex items-start justify-between border-b border-pink-100 bg-gradient-to-r from-pink-50/60 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md shadow-pink-500/20"
            style={{ background: AURA_PINK }}
          >
            {lead.name ? lead.name.charAt(0).toUpperCase() : 'L'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{lead.name}</h2>
              {score?.qualified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  AI Qualified
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {[lead.email, lead.phone].filter(Boolean).join(' • ') || 'No contact info on file'}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {SOURCE_LABELS[lead.source] ?? lead.source}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta?.color ?? ''}`}>
                {meta?.label ?? lead.status}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${appointmentMeta(lead.appointment_booked).color}`}>
                Appointment {appointmentMeta(lead.appointment_booked).label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenChat && lead.phone && (
            <button
              onClick={() => onOpenChat(lead.id)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
              style={{ background: AURA_PINK }}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="flex-1 overflow-y-auto space-y-5 p-6">
        <ScoreSection score={score} />

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#CB3273]" />
            Outreach History
          </h3>
          {outreach.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
              No outreach messages sent yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {outreach.map((o) => (
                <li key={o.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-800">{CHANNEL_LABELS[o.channel] ?? o.channel}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{o.status}</span>
                    {o.meta?.template && (
                      <span className="rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[10px] font-bold text-[#CB3273]">
                        {o.meta.template}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">{formatDate(o.sent_at)}</span>
                  </div>
                  {o.message_content && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-line bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {o.message_content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#CB3273]" />
            Scheduled Follow-ups
          </h3>
          {followups.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
              No pending follow-ups scheduled.
            </p>
          ) : (
            <ul className="space-y-2">
              {followups.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-xs bg-white">
                  <span className="font-bold text-slate-800">{CHANNEL_LABELS[f.channel] ?? f.channel}</span>
                  <span className="text-[10px] text-slate-400">Attempt {f.attempt}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{formatDate(f.scheduled_at)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      f.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {f.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {lead.notes && (
          <section className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lead Notes</h3>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed">
              {lead.notes}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function ScoreSection({ score }) {
  if (!score) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-400">No AI qualification score logged yet.</p>
      </section>
    )
  }
  const sorted = Object.entries(score.breakdown ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <section className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50/50 via-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white font-bold shadow-md ${scoreColor(
            score.score
          )}`}
        >
          <span className="text-xl leading-none">{score.score}</span>
          <span className="text-[9px] opacity-80">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Sparkles className="h-3.5 w-3.5 text-[#CB3273]" />
            AI Score Analysis
          </div>
          {score.reasoning && <p className="mt-1 text-xs text-slate-600 leading-relaxed">{score.reasoning}</p>}
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-200/60 pt-3">
          {sorted.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{BREAKDOWN_LABELS[k] ?? k}</span>
                <span className="font-bold text-slate-800">{v ?? '-'}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#CB3273]"
                  style={{ width: `${Math.min(v ?? 0, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}