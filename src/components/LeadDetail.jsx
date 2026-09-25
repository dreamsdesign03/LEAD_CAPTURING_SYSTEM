import { useEffect, useState } from 'react'
import {
  SOURCE_LABELS,
  STATUS_META,
  appointmentMeta,
  fetchLeadDetail,
  formatDate,
  scoreColor,
} from '../lib/supabase'

const BREAKDOWN_LABELS = { budget: 'Budget', authority: 'Authority', need: 'Need', timing: 'Timing' }
const CHANNEL_LABELS = { email: 'Email', whatsapp: 'WhatsApp', ai_call: 'AI Call' }

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {error && (
          <div className="rounded-t-2xl border-b border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load: {error}
          </div>
        )}

        {data ? (
          <LeadDetailBody data={data} onClose={onClose} onOpenChat={onOpenChat} />
        ) : (
          <div className="p-16 text-center text-slate-400">Loading lead…</div>
        )}
      </div>
    </div>
  )
}

function LeadDetailBody({ data, onClose, onOpenChat }) {
  const { lead, score, outreach, followups } = data
  const meta = STATUS_META[lead.status]

  return (
    <div>
      <div className="flex items-start justify-between rounded-t-2xl border-b border-slate-200 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
            {score?.qualified && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Qualified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact info'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {SOURCE_LABELS[lead.source] ?? lead.source}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta?.color ?? ''}`}>
              {meta?.label ?? lead.status}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${appointmentMeta(lead.appointment_booked).color}`}
            >
              Appointment {appointmentMeta(lead.appointment_booked).label}
            </span>
            <span className="text-xs text-slate-400">Added {formatDate(lead.created_at)}</span>
          </div>
        </div>
        {onOpenChat && lead.phone && (
          <button
            onClick={() => onOpenChat(lead.id)}
            className="mr-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.83 14.12c-.25.7-1.45 1.33-2.04 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.32-1.71-.63-3.02-1.3-5-4.34-5.15-4.54-.15-.2-1.24-1.65-1.24-3.14 0-1.5.79-2.24 1.07-2.54.28-.31.61-.39.81-.39h.58c.19 0 .44-.07.69.52.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.14-.3.29-.13.57.17.28.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.7-.18 1.4z" />
            </svg>
            WhatsApp
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="space-y-5 p-5">
        <ScoreSection score={score} />

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Outreach Timeline</h3>
          {outreach.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-400">
              No outreach sent yet{lead.status === 'cold' ? ' (cold lead — stored only)' : '.'}
            </p>
          ) : (
            <ul className="space-y-2">
                  {outreach.map((o) => (
                    <li key={o.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">{CHANNEL_LABELS[o.channel] ?? o.channel}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{o.status}</span>
                        {o.meta?.template && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                            {o.meta.template}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-slate-400">{formatDate(o.sent_at)}</span>
                      </div>
                      {o.message_content && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                          {o.message_content}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Scheduled Follow-ups</h3>
          {followups.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-400">No follow-ups scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {followups.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-medium text-slate-700">{CHANNEL_LABELS[f.channel] ?? f.channel}</span>
                  <span className="text-xs text-slate-400">attempt {f.attempt}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDate(f.scheduled_at)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
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
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Notes</h3>
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{lead.notes}</p>
          </section>
        )}
      </div>
    </div>
  )
}

function ScoreSection({ score }) {
  if (!score) {
    return (
      <section className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-400">No AI score yet — the qualifier workflow will pick this lead up shortly.</p>
      </section>
    )
  }
  const sorted = Object.entries(score.breakdown ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50/60 to-slate-50 p-4">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white ${scoreColor(score.score)}`}
        >
          <span className="text-2xl font-bold leading-none">{score.score}</span>
          <span className="text-[10px] font-medium opacity-80">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          {score.reasoning && <p className="text-sm text-slate-700">{score.reasoning}</p>}
          <p className="mt-1 text-xs text-slate-400">Scored {formatDate(score.created_at)}</p>
        </div>
      </div>
      {sorted.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sorted.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{BREAKDOWN_LABELS[k] ?? k}</span>
                <span className="font-medium">{v ?? '-'}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-500"
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