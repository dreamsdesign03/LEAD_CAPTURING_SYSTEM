import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchLeadById,
  fetchWhatsAppChat,
  fetchWhatsAppConversations,
  markWhatsAppThreadRead,
  sendWhatsAppReply,
  supabase,
} from '../lib/supabase'

const WA_GREEN = '#25D366'
const WA_CANVAS = '#F0F4F0'
const BIZ_NUMBER = import.meta.env.VITE_WHATSAPP_BIZ_NUMBER || ''
const TEMPLATES = [
  {
    name: 'mansi_lead_demo_appointment_booking',
    label: 'Appointment Booking',
    params: (c) => [firstName(c), c.company || 'Dreamsdesign'],
  },
]

const QUICK_REPLIES = [
  'Hi {{name}} 👋 Following up on your consultation call — do you have 5 minutes today?',
  'Great to hear from you! Can I book your free 30-minute call with Krishna?',
  'Thanks for your message! Our team will get back to you shortly.',
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

function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.83 14.12c-.25.7-1.45 1.33-2.04 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.32-1.71-.63-3.02-1.3-5-4.34-5.15-4.54-.15-.2-1.24-1.65-1.24-3.14 0-1.5.79-2.24 1.07-2.54.28-.31.61-.39.81-.39h.58c.19 0 .44-.07.69.52.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.14-.3.29-.13.57.17.28.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.7-.18 1.4z" />
    </svg>
  )
}

export default function WhatsAppPanel({ preselectedLeadId }) {
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [leadStub, setLeadStub] = useState(null)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [waText, setWaText] = useState('')
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
    if (preselectedLeadId && preselectedLeadId !== handledPreselect.current) {
      handledPreselect.current = preselectedLeadId
      selectLead(preselectedLeadId)
    }
  }, [preselectedLeadId, selectLead])

  useEffect(() => {
    const channel = supabase
      .channel('wa-panel-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => {
          refreshConvs()
          if (selectedId) {
            refreshChat(selectedId)
            markWhatsAppThreadRead(selectedId).catch(() => {})
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outreach_log' },
        () => {
          if (selectedId) refreshChat(selectedId)
        }
      )
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

  async function handleSend(e, template = null) {
    e?.preventDefault()
    const isTemplate = Boolean(template)
    const text = isTemplate ? null : waText.trim()
    if (!isTemplate && !text) return
    if (!activeLead || !activePhone || sending) return
    setSending(true)
    try {
      const payload = { leadId: activeLead.lead_id, phone: activePhone }
      if (isTemplate) {
        payload.templateName = template.name
        payload.templateParams = template.params({ name: activeLead.name, company: activeLead.company })
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
          content: isTemplate ? `[Template: ${template.name}]` : text,
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
    <div id="whatsapp-panel" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-white"
            style={{ background: WA_GREEN }}
          >
            <WhatsAppIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">WhatsApp Inbox</h3>
            <p className="text-[11px] text-slate-400">
              {BIZ_NUMBER ? `Business number +${BIZ_NUMBER}` : 'Live inbox'}
            </p>
          </div>
        </div>
        <button
          onClick={refreshConvs}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex h-[560px] min-h-0">
        {/* Conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-200">
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <p className="p-4 text-xs text-slate-400">Loading conversations…</p>
            ) : convs.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                No WhatsApp conversations yet. Inbound messages or sent templates will show up here.
              </div>
            ) : (
              convs.map((conv) => {
                const isSelected = conv.lead_id === selectedId
                const hasUnread = Number(conv.unread_count || 0) > 0
                return (
                  <button
                    key={conv.lead_id}
                    onClick={() => selectLead(conv.lead_id)}
                    className={`flex w-full gap-2.5 px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50'
                        : hasUnread
                        ? 'border-l-4 border-l-transparent bg-emerald-50/40'
                        : 'border-l-4 border-l-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: '#CB3273' }}
                      >
                        {initials(conv.name)}
                      </div>
                      {hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span
                          className={`truncate text-xs ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}
                        >
                          {conv.name}
                        </span>
                        <span
                          className={`ml-1 flex-shrink-0 text-[10px] ${hasUnread ? 'font-bold text-emerald-600' : 'text-slate-400'}`}
                        >
                          {timeAgo(conv.last_activity)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`flex-1 truncate text-[11px] ${hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}
                        >
                          {conv.last_message || (conv.company ? conv.company : 'No messages yet')}
                        </span>
                        {hasUnread && (
                          <span className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
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

        {/* Thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeLead ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#CB3273' }}
                >
                  {initials(activeLead.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{activeLead.name}</div>
                  <div className="truncate text-[11px] text-slate-400">{activePhone || 'No phone on file'}</div>
                </div>
                {activeLead.lead_status && (
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                    {activeLead.lead_status}
                  </span>
                )}
              </div>

              <div
                ref={threadRef}
                className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
                style={{ background: WA_CANVAS }}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No messages yet — send the first WhatsApp message to start the conversation.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOut = msg.direction === 'outbound'
                    return (
                      <div key={msg.key || msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm"
                          style={{
                            background: isOut ? WA_GREEN : '#ffffff',
                            color: isOut ? '#ffffff' : '#111827',
                            borderBottomRightRadius: isOut ? 4 : 16,
                            borderBottomLeftRadius: isOut ? 16 : 4,
                          }}
                        >
                          {msg.template && (
                            <div
                              className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${isOut ? 'text-white/80' : 'text-indigo-600'}`}
                            >
                              Template: {msg.template}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-[13px] leading-snug">
                            {msg.content || ''}
                          </p>
                          <div
                            className={`mt-1 text-[10px] ${isOut ? 'text-right text-white/75' : 'text-left text-slate-400'}`}
                          >
                            {msg.status === 'failed' && <span className="mr-1 font-semibold text-rose-300">Failed · </span>}
                            {bubbleTime(msg.sentAt)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {!activePhone ? (
                <div className="border-t border-slate-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  This lead has no phone number, so WhatsApp messages can't be sent yet.
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex-shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
                    <span className="flex-shrink-0 text-[11px] font-bold text-emerald-900">⚡ Official Template:</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const t = TEMPLATES.find((x) => x.name === e.target.value)
                          if (t) handleSend(e, t)
                          e.target.value = ''
                        }
                      }}
                      className="flex-1 rounded-lg border border-emerald-300 bg-white p-1.5 text-xs font-bold text-emerald-900 outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      <option value="" disabled>
                        -- Select & Send Approved Template --
                      </option>
                      {TEMPLATES.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.label} ({t.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {QUICK_REPLIES.map((r) => {
                      const txt = r.replaceAll('{{name}}', firstName(activeLead))
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setWaText(txt)}
                          className="flex-shrink-0 whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 transition-colors hover:bg-green-100"
                        >
                          {txt.slice(0, 30)}…
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      value={waText}
                      onChange={(e) => setWaText(e.target.value)}
                      placeholder={`Send WhatsApp message to ${firstName(activeLead)}…`}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300"
                    />
                    <button
                      type="submit"
                      disabled={sending || !waText.trim()}
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
                      style={{ background: WA_GREEN }}
                    >
                      {sending ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      )}
                      Send
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-400">
              Select a conversation to view and reply to WhatsApp messages.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}