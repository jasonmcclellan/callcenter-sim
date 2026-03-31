import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
        <p className="font-semibold text-gray-700">SL: {label}%</p>
        <p className="text-gray-500">{payload[0].value} run{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    )
  }
  return null
}

export default function SLHistogram({ histogram, slTargetPct, numRuns }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Service Level Distribution</h2>
        <span className="text-xs text-gray-400">{numRuns} runs</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={histogram} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={1}
            angle={-40}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={histogram.find((b) => b.midpoint >= slTargetPct)?.bin}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: `Target ${slTargetPct}%`, fontSize: 11, fill: '#ef4444', position: 'insideTopRight' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {histogram.map((entry) => (
              <Cell
                key={entry.bin}
                fill={entry.midpoint >= slTargetPct ? '#3b82f6' : '#fca5a5'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 mr-1 align-middle" />
        At or above target
        <span className="inline-block w-3 h-3 rounded-sm bg-red-300 ml-3 mr-1 align-middle" />
        Below target
      </p>
    </div>
  )
}
