import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

function buildHourly(intradayData, sprinkles, baselineIntradayData, erlangNeeded) {
  return Array.from({ length: 12 }, (_, h) => {
    const a = intradayData[h * 2]
    const b = intradayData[h * 2 + 1]
    const endTime    = h < 11 ? intradayData[(h + 1) * 2].time : '8:30 PM'
    const totalCalls = a.calls + b.calls
    const sl = totalCalls > 0
      ? ((a.sl ?? 0) * a.calls + (b.sl ?? 0) * b.calls) / totalCalls
      : null

    let preSl = null, baselineAvail = null, erlangNeed = null
    if (baselineIntradayData) {
      const ba = baselineIntradayData[h * 2]
      const bb = baselineIntradayData[h * 2 + 1]
      const baseCalls = ba.calls + bb.calls
      if (baseCalls > 0) preSl = ((ba.sl ?? 0) * ba.calls + (bb.sl ?? 0) * bb.calls) / baseCalls
      baselineAvail = (ba.agents + bb.agents) / 2
    }
    if (erlangNeeded) {
      erlangNeed = Math.max(erlangNeeded[h * 2], erlangNeeded[h * 2 + 1])
    }

    return { label: `${a.time}–${endTime}`, short: a.time, calls: totalCalls, sprinkle: sprinkles[h], sl, preSl, baselineAvail, erlangNeed }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const base     = payload.find(p => p.dataKey === 'baselineAvail')
  const sprinkle = payload.find(p => p.dataKey === 'sprinkle')
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {base     && <p className="text-slate-500">{base.value.toFixed(1)} baseline available</p>}
      {sprinkle && sprinkle.value > 0
        ? <p className="text-blue-600">+{sprinkle.value} sprinkle agent{sprinkle.value !== 1 ? 's' : ''}</p>
        : <p className="text-gray-300">no sprinkle agents</p>}
    </div>
  )
}

export default function SprinklerResult({ sprinkles, intradayData, baselineIntradayData, erlangNeeded, targetMet, slTargetPct }) {
  const hourly            = buildHourly(intradayData, sprinkles, baselineIntradayData, erlangNeeded)
  const totalSprinkle     = sprinkles.reduce((a, b) => a + b, 0)
  const hoursWithSprinkle = sprinkles.filter((s) => s > 0).length

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-700">Sprinkler Schedule</h2>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          targetMet ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {targetMet
            ? `${totalSprinkle} sprinkle agent${totalSprinkle !== 1 ? 's' : ''} across ${hoursWithSprinkle} hour${hoursWithSprinkle !== 1 ? 's' : ''}`
            : `${totalSprinkle} placed — target not reached`}
        </span>
      </div>

      {/* Stacked bar chart: baseline available + sprinkle agents per hour */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={hourly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={46}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            allowDecimals={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="baselineAvail" name="Baseline" stackId="a" fill="#cbd5e1" maxBarSize={32} radius={[0, 0, 0, 0]} />
          <Bar dataKey="sprinkle"      name="Sprinkle" stackId="a" fill="#3b82f6" maxBarSize={32} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Chart legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 -mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />
          Baseline available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          Sprinkle added
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Hour</th>
              <th className="pb-2 pr-3 font-medium text-gray-400 text-xs uppercase tracking-wide text-right">Baseline Avail</th>
              <th className="pb-2 pr-3 font-medium text-gray-400 text-xs uppercase tracking-wide text-right">Needed</th>
              <th className="pb-2 pr-3 font-medium text-blue-500 text-xs uppercase tracking-wide text-right">Sprinkle</th>
              <th className="pb-2 pr-3 font-medium text-gray-400 text-xs uppercase tracking-wide text-right">Pre-SL</th>
              <th className="pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Post-SL</th>
            </tr>
          </thead>
          <tbody>
            {hourly.map((row, i) => {
              const slOk      = row.sl    !== null && row.sl    >= slTargetPct
              const slLow     = row.sl    !== null && row.sl    <  slTargetPct
              const preSlOk   = row.preSl !== null && row.preSl >= slTargetPct
              const preSlLow  = row.preSl !== null && row.preSl <  slTargetPct
              const hasGap    = row.erlangNeed !== null && row.baselineAvail !== null
                              && row.erlangNeed > row.baselineAvail
              return (
                <tr key={i} className="border-b border-gray-50 even:bg-gray-50/60">
                  <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap text-xs">{row.label}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-500">
                    {row.baselineAvail !== null ? row.baselineAvail.toFixed(1) : '—'}
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-medium ${hasGap ? 'text-amber-600' : 'text-gray-400'}`}>
                    {row.erlangNeed !== null ? row.erlangNeed : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold text-blue-600">
                    {row.sprinkle > 0 ? `+${row.sprinkle}` : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {row.preSl !== null
                      ? <span className={preSlOk ? 'text-green-500' : preSlLow ? 'text-red-400' : 'text-gray-400'}>{row.preSl.toFixed(1)}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    {row.sl !== null
                      ? <span className={`font-semibold ${slOk ? 'text-green-600' : slLow ? 'text-red-500' : 'text-gray-500'}`}>{row.sl.toFixed(1)}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Baseline available reflects shift coverage with lunch and breaks. Sprinkle agents
        are 1-hour workers assigned via Erlang-C gap analysis.
      </p>
    </div>
  )
}
