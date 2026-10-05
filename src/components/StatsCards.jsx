import { Users, UserPlus, Flame, ThermometerSun, Snowflake, CheckCircle2 } from 'lucide-react'

const CARDS = [
  { key: 'total', label: 'Total Leads', icon: Users, color: 'text-slate-900', border: 'border-slate-200' },
  { key: 'new', label: 'New / Awaiting AI', icon: UserPlus, color: 'text-slate-600', border: 'border-slate-200' },
  { key: 'hot', label: 'Hot / Qualified', icon: Flame, color: 'text-[#CB3273]', border: 'border-pink-200' },
  { key: 'warm', label: 'Warm Interest', icon: ThermometerSun, color: 'text-amber-600', border: 'border-slate-200' },
  { key: 'cold', label: 'Cold / Archived', icon: Snowflake, color: 'text-sky-600', border: 'border-slate-200' },
  { key: 'converted', label: 'Converted Client', icon: CheckCircle2, color: 'text-emerald-600', border: 'border-slate-200' },
]

export default function StatsCards({ leads }) {
  const counts = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    hot: leads.filter((l) => l.status === 'hot' || l.status === 'qualified').length,
    warm: leads.filter((l) => l.status === 'warm').length,
    cold: leads.filter((l) => l.status === 'cold').length,
    converted: leads.filter((l) => l.status === 'converted').length,
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.key}
            className={`rounded-xl border ${c.border} bg-white p-4 shadow-2xs hover:shadow-xs transition-all`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {c.label}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${c.color}`}>
              {counts[c.key]}
            </p>
          </div>
        )
      })}
    </div>
  )
}