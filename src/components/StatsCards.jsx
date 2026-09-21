const CARDS = [
  { key: 'total', label: 'Total Leads', color: 'text-slate-900' },
  { key: 'new', label: 'New / Awaiting AI', color: 'text-slate-500' },
  { key: 'hot', label: 'Hot', color: 'text-rose-600' },
  { key: 'warm', label: 'Warm', color: 'text-amber-600' },
  { key: 'cold', label: 'Cold', color: 'text-sky-600' },
  { key: 'converted', label: 'Converted', color: 'text-green-600' },
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {c.label}
          </p>
          <p className={`mt-1 text-3xl font-semibold tabular-nums ${c.color}`}>
            {counts[c.key]}
          </p>
        </div>
      ))}
    </div>
  )
}