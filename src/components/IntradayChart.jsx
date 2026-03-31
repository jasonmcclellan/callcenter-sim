import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(1)}
        </p>
      ))}
    </div>
  )
}

export default function IntradayChart({ intradayData }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Intraday Profile</h2>
        <span className="text-xs text-gray-400">30-min intervals · avg across runs</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={intradayData} margin={{ top: 4, right: 48, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={1}
            angle={-35}
            textAnchor="end"
            height={50}
          />
          {/* Left axis — calls */}
          <YAxis
            yAxisId="calls"
            orientation="left"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            allowDecimals={false}
            width={36}
          />
          {/* Right axis — agents */}
          <YAxis
            yAxisId="agents"
            orientation="right"
            tick={{ fontSize: 11, fill: '#2563eb' }}
            allowDecimals={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span className="text-gray-600">{value}</span>}
          />
          <Bar
            yAxisId="calls"
            dataKey="calls"
            name="Calls Arriving"
            fill="#bfdbfe"
            radius={[2, 2, 0, 0]}
            maxBarSize={24}
          />
          <Line
            yAxisId="agents"
            dataKey="agents"
            name="Available Agents"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-1">
        Agents available = on shift and not on lunch or break.
        Call volume peaks at <span className="font-medium text-gray-500">2:00 PM</span>.
      </p>
    </div>
  )
}
