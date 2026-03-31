export default function StatCard({ label, value, sub, highlight, danger }) {
  const bg = danger ? 'bg-red-50 border-red-200' : highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
  const textColor = danger ? 'text-red-700' : highlight ? 'text-blue-700' : 'text-gray-800'
  return (
    <div className={`rounded-xl p-4 shadow-sm border ${bg}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
