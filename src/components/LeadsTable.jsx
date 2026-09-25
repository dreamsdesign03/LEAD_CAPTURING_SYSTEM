import { useMemo, useState } from 'react'
import { SOURCE_LABELS, STATUS_META, appointmentMeta, formatDate, scoreColor } from '../lib/supabase'

const SOURCE_OPTIONS = ['', 'meta', 'linkedin', 'google_form', 'google_sheet', 'whatsapp', 'calling_agent', 'manual']
const STATUS_OPTIONS = ['', 'new', 'hot', 'warm', 'cold', 'qualified', 'contacted', 'responded', 'converted', 'unqualified']

export default function LeadsTable({ leads, onSelect, onOpenChat }) {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [minScore, setMinScore] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (source && l.source !== source) return false
      if (status && l.status !== status) return false
      if (minScore !== '' && (l.score ?? -1) < Number(minScore)) return false
      if (q) {
        const hay = [l.name, l.email, l.phone].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, search, source, status, minScore])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <input
          value={minScore}
          onChange={(e) => setMinScore(e.target.value.replace(/\D/g, ''))}
          placeholder="Min score"
          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <span className="ml-auto text-xs text-slate-400">{filtered.length} leads</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Appointment</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                onClick={() => onSelect(l.id)}
                className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/40"
              >
                <td className="px-4 py-3 font-medium text-slate-800">{l.name}</td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{l.email || '—'}</div>
                  <div>{l.phone || ''}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {SOURCE_LABELS[l.source] ?? l.source}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {l.score != null ? (
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${scoreColor(l.score)}`}
                    >
                      {l.score}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">…</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[l.status]?.color ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {STATUS_META[l.status]?.label ?? l.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${appointmentMeta(l.appointment_booked).color}`}
                  >
                    {appointmentMeta(l.appointment_booked).label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {formatDate(l.created_at)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenChat?.(l.id)
                    }}
                    title="Open WhatsApp chat"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
                    style={{ background: '#25D366' }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.83 14.12c-.25.7-1.45 1.33-2.04 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.32-1.71-.63-3.02-1.3-5-4.34-5.15-4.54-.15-.2-1.24-1.65-1.24-3.14 0-1.5.79-2.24 1.07-2.54.28-.31.61-.39.81-.39h.58c.19 0 .44-.07.69.52.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.14-.3.29-.13.57.17.28.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.7-.18 1.4z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}