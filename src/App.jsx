import { useCallback, useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react'
import logoImg from './assets/logo.png'
import { fetchLeads, supabase } from './lib/supabase'
import StatsCards from './components/StatsCards'
import SourceChart from './components/SourceChart'
import LeadsTable from './components/LeadsTable'
import LeadDetail from './components/LeadDetail'
import WhatsAppPanel from './components/WhatsAppPanel'

const AURA_PINK = '#CB3273'

export default function App() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [chatLeadId, setChatLeadId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'leads' | 'whatsapp' | 'analytics'

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const openChatForLead = (leadId) => {
    setChatLeadId(leadId)
    setActiveTab('whatsapp')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Top Executive Header Navigation */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          {/* Logo & Brand Title matching Aura AI */}
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Aura AI" className="h-9 w-auto object-contain" />
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-outfit font-extrabold text-base tracking-tight gradient-text-aura">
                  Aura AI
                </span>
                <span className="text-xs font-semibold text-slate-700">Lead Engine</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live Sync
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Multi-channel Capture • AI Qualification • Automated Outreach
              </p>
            </div>
          </div>

          {/* Segmented Tab Navigation */}
          <nav className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'leads'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-slate-500" />
              Lead CRM
              <span className="rounded-full bg-slate-200 text-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'whatsapp'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp Inbox
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
              Analytics
            </button>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="hidden sm:inline-block text-[11px] text-slate-400">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:opacity-90"
              style={{ background: AURA_PINK }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            Failed to load lead capturing engine: {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <RefreshCw className="h-6 w-6 text-[#CB3273] animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-600">Loading Aura Lead Capturing Engine...</p>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="h-full overflow-y-auto space-y-5 pr-1">
                {/* Stats Cards Row */}
                <StatsCards leads={leads} />

                {/* Grid: Source Breakdown + Pipeline Status */}
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <SourceChart leads={leads} />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Lead Pipeline Distribution</h3>
                        <p className="text-xs text-slate-500">Live breakdown of lead progression stages</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('leads')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#CB3273] hover:underline"
                      >
                        View Full Lead CRM <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {['converted', 'qualified', 'hot', 'warm', 'contacted', 'responded', 'new', 'cold'].map((s) => {
                        const count = leads.filter((l) => l.status === s).length
                        const pct = leads.length ? Math.round((count / leads.length) * 100) : 0
                        return (
                          <div key={s} className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span className="capitalize">{s}</span>
                              <span className="font-bold text-slate-900">{count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-[#CB3273]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block font-medium">{pct}% of pipeline</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Recent Leads Preview */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-bold text-slate-900">Recent Leads Activity</h3>
                    <button
                      onClick={() => setActiveTab('leads')}
                      className="text-xs font-semibold text-[#CB3273] hover:underline"
                    >
                      Open CRM Directory →
                    </button>
                  </div>
                  <LeadsTable
                    leads={leads.slice(0, 10)}
                    onSelect={setSelectedLeadId}
                    onOpenChat={openChatForLead}
                  />
                </div>
              </div>
            )}

            {/* LEADS CRM TAB */}
            {activeTab === 'leads' && (
              <div className="h-full">
                <LeadsTable
                  leads={leads}
                  onSelect={setSelectedLeadId}
                  onOpenChat={openChatForLead}
                />
              </div>
            )}

            {/* WHATSAPP INBOX TAB */}
            {activeTab === 'whatsapp' && (
              <div className="h-full">
                <WhatsAppPanel
                  preselectedLeadId={chatLeadId}
                  onOpenLeadDetail={setSelectedLeadId}
                />
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="h-full overflow-y-auto space-y-5 pr-1">
                <div className="grid gap-5 lg:grid-cols-2">
                  <SourceChart leads={leads} />
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Source Acquisition Performance</h3>
                    <p className="text-xs text-slate-500 mb-4">Channel volume breakdown</p>
                    <div className="space-y-3">
                      {['meta', 'whatsapp', 'linkedin', 'google_form', 'google_sheet', 'calling_agent', 'manual'].map((src) => {
                        const count = leads.filter((l) => l.source === src).length
                        const pct = leads.length ? Math.round((count / leads.length) * 100) : 0
                        return (
                          <div key={src} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-semibold capitalize text-slate-700">{src}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500 font-medium">{count} leads</span>
                              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                                {pct}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Lead Detail Modal */}
      <LeadDetail
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onOpenChat={(id) => {
          setSelectedLeadId(null)
          openChatForLead(id)
        }}
      />
    </div>
  )
}