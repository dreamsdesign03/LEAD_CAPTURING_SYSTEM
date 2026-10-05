import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  CheckCheck,
  Sparkles,
  FileText
} from 'lucide-react'
import {
  fetchLeadById,
  fetchWhatsAppChat,
  fetchWhatsAppConversations,
  markWhatsAppThreadRead,
  sendWhatsAppReply,
  supabase,
} from '../lib/supabase'

const AURA_PINK = '#CB3273'
const BIZ_NUMBER = import.meta.env.VITE_WHATSAPP_BIZ_NUMBER || ''

const TEMPLATES = [
  {
    name: 'aura_lead_appointment_booking',
    label: 'Aura Appointment Booking',
    language: 'en_IN',
    params: (c) => [firstName(c), c.purpose || 'Skin & Hair Consultation', c.branch || 'Alkapuri'],
    preview: (c) => `Welcome to Aura Laser & Cosmetic Clinic

Hi ${firstName(c)}!
Thank you for reaching out to Aura Clinic!
Your request for ${c.purpose || 'Skin & Hair Consultation'} at ${c.branch || 'Alkapuri'} has been received.
Dr. Aditya Shah's team would love to help you get started.

🗓️ Book your consultation slot here:
https://cal.com/aura-laser-cosmetic-clinic/30min

On your visit we will:
• Understand your skin/hair concern
• Recommend the right treatment plan
• Answer all your questions

No obligation. Just honest advice from a dermatologist with 12+ years of experience.

💬 Any questions before your visit? Just reply here.

Aura Laser & Cosmetic Clinic
📍 Alkapuri
🌐 auralaserclinic.com
📞 +91 8048039290`,
  },
]

const QUICK_REPLIES = [
  'Hi {{name}}, following up on your consultation request. Do you have 5 minutes today?',
  'Can I help book your 30-minute consultation with Dr. Aditya Shah?',
  'Thanks for reaching out! Our team is reviewing your details.',
]

function firstName(lead) {
  return String(lead?.name || '').trim().split(/\s+/)[0] || 'there'
}

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function bubbleTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function WhatsAppPanel({ preselectedLeadId, onOpenLeadDetail }) {
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [leadStub, setLeadStub] = useState(null)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [waText, setWaText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const threadRef = useRef(null)
  const handledPreselect = useRef(null)

  const refreshConvs = useCallback(async () => {
    try {
      const data = await fetchWhatsAppConversations()
      setConvs(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshChat = useCallback(async (leadId) => {
    if (!leadId) {
      setMessages([])
      return
    }
    try {
      setMessages(await fetchWhatsAppChat(leadId))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const selectLead = useCallback(
    async (leadId) => {
      setSelectedId(leadId)
      setLeadStub(null)
      try {
        await markWhatsAppThreadRead(leadId)
      } catch {
        /* non-fatal */
      }
      const known = convs.some((c) => c.lead_id === leadId)
      if (!known) {
        try {
          setLeadStub(await fetchLeadById(leadId))
        } catch {
          setLeadStub(null)
        }
      }
      refreshChat(leadId)
    },
    [convs, refreshChat]
  )

  useEffect(() => {
    refreshConvs()
  }, [refreshConvs])

  useEffect(() => {
    if (!selectedId && convs.length > 0 && !handledPreselect.current) {
      setSelectedId(convs[0].lead_id)
      refreshChat(convs[0].lead_id)
    }
  }, [convs, selectedId, refreshChat])

  useEffect(() => {
    if (preselectedLeadId && preselectedLeadId !== handledPreselect.current) {
      handledPreselect.current = preselectedLeadId
      selectLead(preselectedLeadId)
    }
  }, [preselectedLeadId, selectLead])

  useEffect(() => {
    const channel = supabase
      .channel('wa-panel-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => refreshConvs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        refreshConvs()
        const affectedId = payload.new?.lead_id || payload.old?.lead_id
        if (selectedId && (!affectedId || affectedId === selectedId)) {
          refreshChat(selectedId)
          markWhatsAppThreadRead(selectedId).catch(() => {})
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_log' }, (payload) => {
        refreshConvs()
        const affectedId = payload.new?.lead_id || payload.old?.lead_id
        if (selectedId && (!affectedId || affectedId === selectedId)) {
          refreshChat(selectedId)
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshConvs, refreshChat, selectedId])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  const selectedConv = convs.find((c) => c.lead_id === selectedId)
  const activeLead = selectedConv || leadStub
  const activePhone = String(activeLead?.phone || '').replace(/[^\d+]/g, '')

  const filteredConvs = convs.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.last_message && c.last_message.toLowerCase().includes(q))
    )
  })

  async function handleSend(e, template = null) {
    e?.preventDefault()
    const isTemplate = Boolean(template)
    const text = isTemplate ? null : waText.trim()
    if (!isTemplate && !text) return
    if (!activeLead || !activePhone || sending) return
    setSending(true)
    try {
      const payload = { leadId: activeLead.lead_id, phone: activePhone }
      let messageContent = text
      if (isTemplate) {
        payload.templateName = template.name
        payload.templateLanguage = template.language || 'en_IN'
        payload.templateParams = template.params(activeLead)
        messageContent = template.preview ? template.preview(activeLead) : `[Template: ${template.name}]`
        payload.message = messageContent
      } else {
        payload.message = text
      }
      await sendWhatsAppReply(payload)
      if (!isTemplate) setWaText('')
      setMessages((prev) => [
        ...prev,
        {
          key: `tmp-${Date.now()}`,
          direction: 'outbound',
          content: messageContent,
          template: isTemplate ? template.name : null,
          status: 'sent',
          sentAt: new Date().toISOString(),
        },
      ])
      refreshConvs()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      {/* Inbox Sub-header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-2">
              WhatsApp Conversations
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                Meta Cloud API Active
              </span>
            </h2>
          </div>
        </div>

        <button
          onClick={refreshConvs}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          Sync
        </button>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Main Inbox Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Conversations Sidebar */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/40">
          <div className="p-2.5 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or phone..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading inbox...</div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No conversations found.</div>
            ) : (
              filteredConvs.map((conv) => {
                const isSelected = conv.lead_id === selectedId
                const hasUnread = Number(conv.unread_count || 0) > 0
                return (
                  <button
                    key={conv.lead_id}
                    onClick={() => selectLead(conv.lead_id)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-l-4 border-l-[#CB3273] bg-[#FBE9F1]/50'
                        : hasUnread
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/40'
                        : 'border-l-4 border-l-transparent hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                        style={{ background: AURA_PINK }}
                      >
                        {initials(conv.name)}
                      </div>
                      {hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`truncate text-xs ${
                            isSelected || hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                          }`}
                        >
                          {conv.name}
                        </span>
                        <span className="ml-1 shrink-0 text-[10px] text-slate-400">
                          {timeAgo(conv.last_activity)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`truncate text-[11px] leading-tight ${
                            hasUnread ? 'font-semibold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {conv.last_message || (conv.company ? conv.company : 'WhatsApp thread')}
                        </p>
                        {hasUnread && (
                          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Active Conversation Pane Matching Provided Screenshot */}
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          {activeLead ? (
            <>
              {/* Header Bar Matching Screenshot Exactly */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                    style={{ background: AURA_PINK }}
                  >
                    {initials(activeLead.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900 leading-tight">
                      {activeLead.name}
                    </h3>
                    <p className="truncate text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{activeLead.company || 'dreamsdesign'}</span>
                      <span className="text-slate-400">{activePhone || 'No phone number'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Status Pill Badge */}
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {activeLead.lead_status || activeLead.status || 'outbound_sent'}
                  </span>

                  {/* View Lead Button */}
                  {onOpenLeadDetail && (
                    <button
                      onClick={() => onOpenLeadDetail(activeLead.lead_id || activeLead.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      View Lead
                    </button>
                  )}

                  {/* Refresh Button */}
                  <button
                    onClick={() => refreshChat(activeLead.lead_id || activeLead.id)}
                    title="Refresh Chat"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Canvas (Messages List) */}
              <div
                ref={threadRef}
                className="flex-1 space-y-3 overflow-y-auto p-5 wa-wallpaper-bg"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-xs font-medium text-slate-600">No messages in thread yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOut = msg.direction === 'outbound'
                    return (
                      <div
                        key={msg.key || msg.id}
                        className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`relative max-w-[72%] rounded-2xl px-4 py-3 shadow-2xs ${
                            isOut
                              ? 'rounded-tr-xs bg-[#dcf8c6] text-slate-900'
                              : 'rounded-tl-xs bg-white border border-slate-200/80 text-slate-900'
                          }`}
                        >
                          {msg.template && (
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-pink-700 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Template: {msg.template}
                            </div>
                          )}

                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                            {msg.content || ''}
                          </p>

                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                              isOut ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            {msg.status === 'failed' && (
                              <span className="font-semibold text-rose-600">Failed • </span>
                            )}
                            <span>{bubbleTime(msg.sentAt)}</span>

                            {isOut && (
                              <CheckCheck className="h-3.5 w-3.5 text-[#34b7f1]" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Message Composer */}
              {!activePhone ? (
                <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  This lead has no registered phone number for WhatsApp messaging.
                </div>
              ) : (
                <form
                  onSubmit={handleSend}
                  className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                    <span className="shrink-0 text-xs font-semibold text-slate-700">Official Template:</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const t = TEMPLATES.find((x) => x.name === e.target.value)
                          if (t) handleSend(e, t)
                          e.target.value = ''
                        }
                      }}
                      className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-slate-400"
                    >
                      <option value="" disabled>
                        Select Meta Approved Template...
                      </option>
                      {TEMPLATES.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.label} ({t.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {QUICK_REPLIES.map((r) => {
                      const txt = r.replaceAll('{{name}}', firstName(activeLead))
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setWaText(txt)}
                          className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
                        >
                          {txt.slice(0, 32)}…
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={waText}
                      onChange={(e) => setWaText(e.target.value)}
                      placeholder={`Send WhatsApp message to ${firstName(activeLead)}...`}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    />
                    <button
                      type="submit"
                      disabled={sending || !waText.trim()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
                      style={{ background: AURA_PINK }}
                    >
                      {sending ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-slate-400">
              <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-xs font-medium">Select a conversation from the left sidebar to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}