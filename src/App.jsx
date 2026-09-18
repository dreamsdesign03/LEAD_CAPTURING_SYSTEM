import { useCallback, useEffect, useState } from 'react'
import { fetchLeads, supabase } from './lib/supabase'
import StatsCards from './components/StatsCards'
import SourceChart from './components/SourceChart'
import LeadsTable from './components/LeadsTable'
import LeadDetail from './components/LeadDetail'

export default function App() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchLeads()
      setLeads(data)
      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">Lead Capturing System</h1>
            <p className="text-xs text-slate-500">
              Multi-source capture · AI qualification · automated outreach
            </p>
          </div>
          <button
            onClick={refresh}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load leads: {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-400">
            Loading leads…
          </div>
        ) : (
          <>
            <StatsCards leads={leads} />

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <SourceChart leads={leads} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Lead Pipeline</h3>
                  {lastRefresh && (
                    <span className="text-xs text-slate-400">
                      Updated {lastRefresh.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {['converted', 'qualified', 'contacted', 'responded', 'new', 'cold'].map((s) => {
                    const count = leads.filter((l) => l.status === s).length
                    const pct = leads.length ? Math.round((count / leads.length) * 100) : 0
                    return (
                      <li key={s}>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span className="capitalize">{s}</span>
                          <span className="font-medium">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <LeadsTable leads={leads} onSelect={setSelectedLeadId} />
          </>
        )}
      </main>

      <LeadDetail leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </div>
  )
}