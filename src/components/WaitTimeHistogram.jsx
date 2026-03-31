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
        <p className="font-semibold text-gray-700">{label}</p>
        <p className="text-gray-500">{payload[0].value.toFixed(1)}% of calls</p>
      </div>
    )
  }
  return null
}

// Find the bucket label that contains the SL threshold, for the ReferenceLine
function thresholdBucketLabel(waitHistogram, slThreshold) {
  const entry = waitHistogram.find((b) => slThreshold >= b.min && slThreshold < b.max)
  return entry?.label ?? null
}

export default function WaitTimeHistogram({ waitHistogram, slThreshold }) {
  const refLabel = thresholdBucketLabel(waitHistogram, slThreshold)

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex justify-between items-baseline mb-1">
        <h2 className="text-lg font-semibold text-gray-700">Wait Time Distribution</h2>
        <span className="text-xs text-gray-400">% of all calls (across all runs)</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        SL threshold: <span className="font-medium text-gray-600">{slThreshold}s</span> —
        blue bars are entirely within threshold, red bars are beyond.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={waitHistogram} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          {refLabel && (
            <ReferenceLine
              x={refLabel}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `SL cutoff`, fontSize: 10, fill: '#f59e0b', position: 'insideTopRight' }}
            />
          )}
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {waitHistogram.map((entry) => (
              <Cell
                key={entry.label}
                // Blue only if the bucket's upper bound is fully within the SL threshold
                fill={entry.max <= slThreshold ? '#3b82f6' : '#fca5a5'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 mr-1 align-middle" />
        Within SL threshold
        <span className="inline-block w-3 h-3 rounded-sm bg-red-300 ml-3 mr-1 align-middle" />
        Beyond SL threshold
      </p>
    </div>
  )
}
