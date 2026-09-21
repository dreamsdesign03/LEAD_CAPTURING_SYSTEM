import { useMemo, useState } from 'react'
import { SOURCE_LABELS, STATUS_META, formatDate, scoreColor } from '../lib/supabase'

const SOURCE_OPTIONS = ['', 'meta', 'linkedin', 'google_form', 'google_sheet', 'whatsapp', 'calling_agent', 'manual']
const STATUS_OPTIONS = ['', 'new', 'hot', 'warm', 'cold', 'contacted', 'responded', 'converted', 'unqualified']

export default function LeadsTable({ leads, onSelect }) {
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
              <th className="px-4 py-2.5 font-medium">Created</th>
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
                <td className="px-4 py-3 text-xs text-slate-400">
                  {formatDate(l.created_at)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
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