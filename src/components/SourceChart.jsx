import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/supabase'

export default function SourceChart({ leads }) {
  const data = Object.entries(
    leads.reduce((acc, l) => {
      acc[l.source] = (acc[l.source] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([source, count]) => ({
      source,
      count,
      name: SOURCE_LABELS[source] ?? source,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Leads by Source</h3>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" allowDecimals={false} className="text-xs" />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              className="text-xs"
            />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.1)' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
              {data.map((d) => (
                <Cell key={d.source} fill={SOURCE_COLORS[d.source] ?? '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}