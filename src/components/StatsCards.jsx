import { Users, UserPlus, Flame, ThermometerSun, Snowflake, CheckCircle2 } from 'lucide-react'

const CARDS = [
  { key: 'total', label: 'Total Leads', icon: Users, color: 'text-slate-900', bg: 'from-pink-500/10 to-rose-500/5', border: 'border-pink-200' },
  { key: 'new', label: 'New / Awaiting AI', icon: UserPlus, color: 'text-slate-600', bg: 'from-slate-500/10 to-gray-500/5', border: 'border-slate-200' },
  { key: 'hot', label: 'Hot / Qualified', icon: Flame, color: 'text-[#CB3273]', bg: 'from-pink-500/15 to-rose-500/10', border: 'border-pink-300' },
  { key: 'warm', label: 'Warm Interest', icon: ThermometerSun, color: 'text-amber-600', bg: 'from-amber-500/10 to-yellow-500/5', border: 'border-amber-200' },
  { key: 'cold', label: 'Cold / Archived', icon: Snowflake, color: 'text-sky-600', bg: 'from-sky-500/10 to-blue-500/5', border: 'border-sky-200' },
  { key: 'converted', label: 'Converted Client', icon: CheckCircle2, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-200' },
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
            className={`relative overflow-hidden rounded-2xl border ${c.border} bg-white p-4 shadow-sm hover:shadow-md transition-all bg-gradient-to-br ${c.bg}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {c.label}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <p className={`text-2xl font-black tabular-nums tracking-tight ${c.color}`}>
              {counts[c.key]}
            </p>
          </div>
        )
      })}
    </div>
  )
}