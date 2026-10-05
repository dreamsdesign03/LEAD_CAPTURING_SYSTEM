import { useMemo, useState } from 'react'
import { MessageSquare, Search, Eye, Filter } from 'lucide-react'
import { SOURCE_LABELS, STATUS_META, appointmentMeta, formatDate, scoreColor } from '../lib/supabase'

const SOURCE_OPTIONS = ['', 'meta', 'linkedin', 'google_form', 'google_sheet', 'whatsapp', 'calling_agent', 'manual']
const STATUS_OPTIONS = ['', 'new', 'hot', 'warm', 'cold', 'qualified', 'contacted', 'responded', 'converted', 'unqualified']

const AURA_PINK = '#CB3273'

export default function LeadsTable({ leads, onSelect, onOpenChat }) {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [minScore, setMinScore] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const normFilterSource = source ? source.toLowerCase().replace(/[\s-]/g, '_') : ''
    const normFilterStatus = status ? status.toLowerCase().trim() : ''

    return leads.filter((l) => {
      if (normFilterSource) {
        const leadSrc = (l.source || '').toLowerCase().replace(/[\s-]/g, '_')
        if (leadSrc !== normFilterSource) return false
      }
      if (normFilterStatus) {
        const leadStat = (l.status || '').toLowerCase().trim()
        if (leadStat !== normFilterStatus) return false
      }
      if (minScore !== '' && (l.score ?? -1) < Number(minScore)) return false
      if (q) {
        const hay = [l.name, l.email, l.phone, l.company, l.source, l.status].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, search, source, status, minScore])

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-pink-100 bg-white shadow-2xs">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-100 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-pink-300 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none hover:bg-[#FBE9F1]/40 focus:border-pink-300 focus:bg-white transition-colors"
            >
              <option value="">All Sources</option>
              {SOURCE_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none hover:bg-[#FBE9F1]/40 focus:border-pink-300 focus:bg-white transition-colors"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s]?.label || s}
                </option>
              ))}
            </select>

            <input
              value={minScore}
              onChange={(e) => setMinScore(e.target.value.replace(/\D/g, ''))}
              placeholder="Min Score"
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none hover:bg-[#FBE9F1]/40 focus:border-pink-300 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
          Showing <span className="text-[#CB3273] font-bold">{filtered.length}</span> of {leads.length} leads
        </div>
      </div>

      {/* Table Body Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Lead Name</th>
              <th className="px-4 py-3">Contact Details</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">AI Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Appointment</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l) => (
              <tr
                key={l.id}
                onClick={() => onSelect(l.id)}
                className="group cursor-pointer hover:bg-[#FBE9F1]/60 transition-colors"
              >
                <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-100 text-[10px] font-bold text-[#CB3273]">
                    {l.name ? l.name.charAt(0).toUpperCase() : 'L'}
                  </div>
                  <div>
                    <div>{l.name}</div>
                    {l.company && <div className="text-[10px] text-slate-400 font-normal">{l.company}</div>}
                  </div>
                </td>

                <td className="px-4 py-3 text-slate-600">
                  <div>{l.email || '—'}</div>
                  <div className="text-slate-400">{l.phone || ''}</div>
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {SOURCE_LABELS[l.source] ?? l.source}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {l.score != null ? (
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold shadow-xs ${scoreColor(l.score)}`}
                    >
                      {l.score}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Pending</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[l.status]?.color ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {STATUS_META[l.status]?.label ?? l.status}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${appointmentMeta(l.appointment_booked).color}`}
                  >
                    {appointmentMeta(l.appointment_booked).label}
                  </span>
                </td>

                <td className="px-4 py-3 text-[11px] text-slate-400">
                  {formatDate(l.created_at)}
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelect(l.id)}
                      title="View Details"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-[#FBE9F1] hover:text-[#CB3273] transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onOpenChat?.(l.id)}
                      title="Open WhatsApp Chat"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:opacity-90 transition-transform hover:scale-105"
                      style={{ background: AURA_PINK }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Chat
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No leads match your active search filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}