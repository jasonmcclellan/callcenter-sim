// Map a SL value to a background/text color on a red→green gradient
function cellStyle(sl) {
  if (sl === null) return { backgroundColor: '#f9fafb', color: '#d1d5db' }
  const hue = Math.max(0, Math.min(120, sl * 1.2))   // 0% → red, 100% → green
  return {
    backgroundColor: `hsl(${hue}, 60%, 93%)`,
    color:           `hsl(${hue}, 55%, 28%)`,
    fontWeight:      600,
  }
}

export default function SensitivityGrid({ data, baseAgents, slTargetPct, loading, label }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-700">{label ?? 'Staffing Sensitivity'}</h2>
        <span className="text-xs text-gray-400">Est. hourly SL · ~60 runs per column</span>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-gray-400 py-6 justify-center">
          <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Computing sensitivity…</span>
        </div>
      )}

      {!loading && data && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  Hour
                </th>
                {data.agentCounts.map((n, i) => (
                  <th
                    key={n}
                    className={`py-2 px-3 text-xs font-semibold text-center whitespace-nowrap ${
                      i === 0
                        ? 'text-blue-700 border-l-2 border-r border-blue-200 bg-blue-50 rounded-t'
                        : 'text-gray-500 border-r border-gray-100'
                    }`}
                  >
                    {n}
                    {i === 0 && (
                      <span className="block text-blue-400 font-normal normal-case tracking-normal" style={{ fontSize: 10 }}>
                        current
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.hours.map((hour, h) => (
                <tr key={h} className="border-t border-gray-50">
                  <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap text-xs">{hour}</td>
                  {data.grid[h].map((sl, i) => (
                    <td
                      key={i}
                      className={`py-1.5 px-3 text-center text-xs ${
                        i === 0 ? 'border-l-2 border-r border-blue-200' : 'border-r border-gray-50'
                      }`}
                      style={cellStyle(sl)}
                    >
                      {sl !== null ? `${sl.toFixed(0)}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex rounded overflow-hidden h-3 w-24">
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: `hsl(${i * 10}, 60%, 93%)` }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-400">Low SL → High SL</span>
            <span className="text-xs text-gray-400 ml-2">
              Target: <span className="font-medium text-gray-600">{slTargetPct}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
