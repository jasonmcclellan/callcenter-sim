const sharedFields = [
  { key: 'totalCallsPerDay', label: 'Total Calls / Day',  min: 10,  max: 50000, step: 10, unit: '' },
  { key: 'avgHandleTime',    label: 'Avg Handle Time',    min: 10,  max: 3600,  step: 10, unit: 'seconds' },
  { key: 'slThreshold',      label: 'SL Threshold',       min: 1,   max: 600,   step: 1,  unit: 'seconds' },
  { key: 'slTargetPct',      label: 'SL Target',          min: 1,   max: 100,   step: 1,  unit: '%' },
  { key: 'patienceThreshold',label: 'Patience Threshold', min: 30,  max: 1800,  step: 30, unit: 'seconds' },
  { key: 'numRuns',          label: 'Simulation Runs',    min: 10,  max: 5000,  step: 10, unit: 'runs' },
]

function NumberInput({ field, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {field.label}
        {field.unit && <span className="text-gray-400 font-normal ml-1">({field.unit})</span>}
      </label>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => onChange(field.key, Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      />
    </div>
  )
}

export default function SimulatorForm({ mode, onModeChange, params, onChange, onRun, running }) {
  const latePct      = 100 - params.earlyPct
  const isOptimize   = mode === 'optimize'
  const isSprinkler  = mode === 'sprinkler'

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-5">
      {/* Mode toggle */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Mode</p>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          <button
            onClick={() => onModeChange('manual')}
            className={`flex-1 py-2 transition-colors ${
              mode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => onModeChange('optimize')}
            className={`flex-1 py-2 transition-colors ${
              isOptimize
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Optimizer
          </button>
          <button
            onClick={() => onModeChange('sprinkler')}
            className={`flex-1 py-2 transition-colors ${
              isSprinkler
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Sprinkler
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 -mb-1">Parameters</h2>

      {/* Staffing input — changes per mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isOptimize ? (
          <NumberInput
            field={{ key: 'minAgents', label: 'Min Agents (floor)', min: 1, max: 200, step: 1, unit: '' }}
            value={params.minAgents}
            onChange={onChange}
          />
        ) : isSprinkler ? (
          <>
            <NumberInput
              field={{ key: 'baselineAgents', label: 'Baseline Agents', min: 1, max: 200, step: 1, unit: '' }}
              value={params.baselineAgents}
              onChange={onChange}
            />
            <NumberInput
              field={{ key: 'maxSprinklePerHour', label: 'Max Sprinkle / Hour', min: 1, max: 50, step: 1, unit: 'agents' }}
              value={params.maxSprinklePerHour}
              onChange={onChange}
            />
          </>
        ) : (
          <NumberInput
            field={{ key: 'numAgents', label: 'Number of Agents', min: 1, max: 500, step: 1, unit: '' }}
            value={params.numAgents}
            onChange={onChange}
          />
        )}

        {sharedFields.map((f) => (
          <NumberInput key={f.key} field={f} value={params[f.key]} onChange={onChange} />
        ))}
      </div>

      {/* Shift distribution slider */}
      <div className="flex flex-col gap-2 pt-1">
        <label className="text-sm font-medium text-gray-600">
          Shift Distribution
          <span className="text-gray-400 font-normal ml-1">(start-time bands)</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={params.earlyPct}
          onChange={(e) => onChange('earlyPct', Number(e.target.value))}
          className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="flex rounded-md overflow-hidden text-xs font-medium h-6">
          <div
            className="bg-blue-100 text-blue-700 flex items-center justify-center transition-all"
            style={{ width: `${params.earlyPct}%`, minWidth: params.earlyPct > 0 ? '2rem' : 0 }}
          >
            {params.earlyPct > 15 ? `${params.earlyPct}%` : ''}
          </div>
          <div
            className="bg-indigo-100 text-indigo-700 flex items-center justify-center transition-all"
            style={{ width: `${latePct}%`, minWidth: latePct > 0 ? '2rem' : 0 }}
          >
            {latePct > 15 ? `${latePct}%` : ''}
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span className="text-blue-600 font-medium">Early: 8:30–10:30 AM</span>
          <span className="text-indigo-600 font-medium">Late: 10:30 AM–12:00 PM</span>
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={running}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {running
          ? (isOptimize ? 'Optimizing…' : isSprinkler ? 'Sprinkling…' : 'Running…')
          : (isOptimize ? 'Run Optimizer' : isSprinkler ? 'Run Sprinkler' : 'Run Simulation')}
      </button>
    </div>
  )
}
