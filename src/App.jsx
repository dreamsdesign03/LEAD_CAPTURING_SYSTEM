import { useCallback, useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Sparkles,
  RefreshCw,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react'
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#FDF3F8] text-slate-900 font-sans">
      {/* Top Dashboard Header Navigation */}
      <header className="shrink-0 border-b border-pink-100 bg-white/90 backdrop-blur-md px-6 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md shadow-pink-500/20"
              style={{ background: 'linear-gradient(135deg, #E15C94 0%, #CB3273 100%)' }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                  Aura <span className="text-[#CB3273]">Lead Engine</span>
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live System
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Multi-channel Capture • AI BANT Qualification • Automated Outreach
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1 rounded-2xl border border-pink-100 bg-pink-50/50 p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-[#CB3273] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'leads'
                  ? 'bg-white text-[#CB3273] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Lead CRM
              <span className="rounded-full bg-pink-100 text-[#CB3273] px-1.5 py-0.2 text-[10px]">
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'whatsapp'
                  ? 'bg-white text-[#CB3273] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp Inbox
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-[#CB3273] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="hidden sm:inline-block text-[11px] text-slate-400">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90"
              style={{ background: AURA_PINK }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Data
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Main Workspace */}
      <main className="flex-1 overflow-hidden p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            Failed to load lead engine data: {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-pink-100 bg-white p-12 text-center shadow-xs">
            <Sparkles className="h-8 w-8 text-[#CB3273] animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading Aura Lead Capturing Dashboard…</p>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="h-full overflow-y-auto space-y-5 pr-1">
                {/* Stats Cards Row */}
                <StatsCards leads={leads} />

                {/* Grid: Charts & Pipeline Breakdown */}
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <SourceChart leads={leads} />
                  </div>

                  <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Lead Qualification Pipeline</h3>
                        <p className="text-[11px] text-slate-400">Distribution of active lead stages</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('leads')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#CB3273] hover:underline"
                      >
                        View All CRM Leads <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {['converted', 'qualified', 'hot', 'warm', 'contacted', 'responded', 'new', 'cold'].map((s) => {
                        const count = leads.filter((l) => l.status === s).length
                        const pct = leads.length ? Math.round((count / leads.length) * 100) : 0
                        return (
                          <div key={s} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                              <span className="capitalize">{s}</span>
                              <span className="text-[#CB3273]">{count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-[#CB3273]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">{pct}% of total</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Recent Leads Preview */}
                <div className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3 px-2">
                    <h3 className="text-sm font-bold text-slate-800">Recent Lead Activity</h3>
                    <button
                      onClick={() => setActiveTab('leads')}
                      className="text-xs font-bold text-[#CB3273] hover:underline"
                    >
                      Open Full CRM Directory
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

            {/* TAB 2: LEADS CRM DIRECTORY */}
            {activeTab === 'leads' && (
              <div className="h-full">
                <LeadsTable
                  leads={leads}
                  onSelect={setSelectedLeadId}
                  onOpenChat={openChatForLead}
                />
              </div>
            )}

            {/* TAB 3: WHATSAPP INBOX */}
            {activeTab === 'whatsapp' && (
              <div className="h-full">
                <WhatsAppPanel
                  preselectedLeadId={chatLeadId}
                  onOpenLeadDetail={setSelectedLeadId}
                />
              </div>
            )}

            {/* TAB 4: ANALYTICS */}
            {activeTab === 'analytics' && (
              <div className="h-full overflow-y-auto space-y-5 pr-1">
                <div className="grid gap-5 lg:grid-cols-2">
                  <SourceChart leads={leads} />
                  <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">Source Conversion Metrics</h3>
                    <p className="text-xs text-slate-500 mb-4">Breakdown of leads per channel</p>
                    <div className="space-y-3">
                      {['meta', 'whatsapp', 'linkedin', 'google_form', 'google_sheet', 'calling_agent', 'manual'].map((src) => {
                        const count = leads.filter((l) => l.source === src).length
                        const pct = leads.length ? Math.round((count / leads.length) * 100) : 0
                        return (
                          <div key={src} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-semibold capitalize text-slate-700">{src}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">{count} leads</span>
                              <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-bold text-[#CB3273]">
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