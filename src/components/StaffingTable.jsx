import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Aggregate 24 half-hour intervals → 12 hourly rows
function buildHourly(intradayData) {
  return Array.from({ length: 12 }, (_, h) => {
    const a = intradayData[h * 2]
    const b = intradayData[h * 2 + 1]
    const endTime = h < 11 ? intradayData[(h + 1) * 2].time : '8:30 PM'
    // Weighted-average SL by call volume across the two half-hour intervals
    const totalCalls = a.calls + b.calls
    let sl = null
    if (totalCalls > 0) {
      const wA = a.sl !== null ? a.sl * a.calls : 0
      const wB = b.sl !== null ? b.sl * b.calls : 0
      sl = (wA + wB) / totalCalls
    }
    return {
      label:  `${a.time}–${endTime}`,
      short:  a.time,
      agents: (a.agents + b.agents) / 2,
      calls:  totalCalls,
      sl,
    }
  })
}

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

export default function StaffingTable({ intradayData, recommendedAgents, targetMet, slTargetPct }) {
  const hourly = buildHourly(intradayData)

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">Recommended Staffing Schedule</h2>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            targetMet
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {targetMet
            ? `${recommendedAgents} agents meets ${slTargetPct}% SL`
            : `${recommendedAgents} agents (target not reached)`}
        </span>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={hourly} margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={46}
          />
          <YAxis yAxisId="agents" orientation="left"  tick={{ fontSize: 11, fill: '#1d4ed8' }} allowDecimals={false} width={32} />
          <YAxis yAxisId="calls"  orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} width={36} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Bar
            yAxisId="agents"
            dataKey="agents"
            name="Avg Available Agents"
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
          <Line
            yAxisId="calls"
            dataKey="calls"
            name="Avg Calls / Hour"
            stroke="#d1d5db"
            strokeWidth={2}
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Hour</th>
              <th className="pb-2 pr-4 font-medium text-blue-600 text-xs uppercase tracking-wide text-right">
                Avg Available Agents
              </th>
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">
                Avg Call Volume
              </th>
              <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">
                Est. Service Level
              </th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((row, i) => {
              const slOk = row.sl !== null && row.sl >= slTargetPct
              const slLow = row.sl !== null && row.sl < slTargetPct
              return (
                <tr key={i} className="border-b border-gray-50 even:bg-gray-50/60">
                  <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{row.label}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-blue-700">
                    {row.agents.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-500">
                    {row.calls.toFixed(1)}
                  </td>
                  <td className="py-2 text-right">
                    {row.sl !== null ? (
                      <span className={`font-semibold ${slOk ? 'text-green-600' : slLow ? 'text-red-500' : 'text-gray-500'}`}>
                        {row.sl.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Available agents = on shift and not on lunch or break. Averages across all simulation runs.
      </p>
    </div>
  )
}
