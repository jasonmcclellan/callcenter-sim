import React from 'react'

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

const SALT_PARTICLES = [
  { dx: -5, dy: 20, delay: 0,    dur: 0.7  },
  { dx:  3, dy: 24, delay: 0.15, dur: 0.8  },
  { dx: -1, dy: 18, delay: 0.05, dur: 0.65 },
  { dx:  6, dy: 22, delay: 0.25, dur: 0.75 },
  { dx: -4, dy: 26, delay: 0.1,  dur: 0.85 },
  { dx:  1, dy: 21, delay: 0.2,  dur: 0.7  },
]

const saltKeyframes = SALT_PARTICLES.map((p, i) => `
  @keyframes salt${i} {
    0%   { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(${p.dx}px,${p.dy}px) scale(0.5); opacity: 0; }
  }
`).join('')

export default function SimulatorForm({ mode, onModeChange, params, onChange, onRun, running }) {
  const [sprinklerHovered, setSprinklerHovered] = React.useState(false)
  const latePct      = 100 - params.earlyPct
  const isOptimize   = mode === 'optimize'
  const isSprinkler  = mode === 'sprinkler'

  return (
    <div className="relative bg-white rounded-2xl shadow-md p-6 space-y-5">
      {/* Mode toggle */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Mode</p>
        <div className="flex rounded-lg border border-gray-200 text-sm font-medium">
          <button
            onClick={() => onModeChange('manual')}
            className={`flex-1 py-2.5 px-1 transition-colors flex flex-col items-center gap-0.5 rounded-l-lg ${
              mode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="font-medium">Manual</span>
            <span className="font-normal leading-tight" style={{ fontSize: 10, opacity: 0.8 }}>Simulate fixed staffing</span>
          </button>
          <button
            onClick={() => onModeChange('optimize')}
            className={`flex-1 py-2.5 px-1 transition-colors flex flex-col items-center gap-0.5 ${
              isOptimize ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="font-medium">Optimizer</span>
            <span className="font-normal leading-tight" style={{ fontSize: 10, opacity: 0.8 }}>Find minimum to hit target</span>
          </button>
          <div className="relative flex-1">
            <button
              onClick={() => onModeChange('sprinkler')}
              onMouseEnter={() => setSprinklerHovered(true)}
              onMouseLeave={() => setSprinklerHovered(false)}
              className={`w-full py-2.5 px-1 transition-colors flex flex-col items-center gap-0.5 rounded-r-lg ${
                isSprinkler ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">Sprinkler</span>
              <span className="font-normal leading-tight" style={{ fontSize: 10, opacity: 0.8 }}>Add part-hour gap coverage</span>
            </button>
          </div>
        </div>
      </div>

      {sprinklerHovered && (
        <>
          <style>{saltKeyframes}</style>
          <div className="absolute pointer-events-none flex flex-col items-center" style={{ top: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
            <span style={{ fontSize: '2.2rem', transform: 'rotate(145deg)', display: 'inline-block' }}>🧂</span>
            <div className="relative" style={{ width: 30, height: 36 }}>
              {SALT_PARTICLES.map((p, i) => (
                <div key={i} style={{
                  position: 'absolute', left: '50%', top: 0,
                  width: 4, height: 4, borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                  animation: `salt${i} ${p.dur}s ease-in ${p.delay}s infinite`,
                  opacity: 0,
                }} />
              ))}
            </div>
          </div>
        </>
      )}

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
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-gray-600">Sprinkle Cutoff</label>
              <select
                value={params.sprinkleCutoffHour}
                onChange={(e) => onChange('sprinkleCutoffHour', Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                {[
                  { label: 'No cutoff',               value: 12 },
                  { label: 'Stop by 7:30 PM',         value: 11 },
                  { label: 'Stop by 6:30 PM',         value: 10 },
                  { label: 'Stop by 5:30 PM',         value:  9 },
                  { label: 'Stop by 4:30 PM',         value:  8 },
                  { label: 'Stop by 3:30 PM',         value:  7 },
                  { label: 'Stop by 2:30 PM',         value:  6 },
                  { label: 'Stop by 1:30 PM',         value:  5 },
                  { label: 'Stop by 12:30 PM',        value:  4 },
                  { label: 'Stop by 11:30 AM',        value:  3 },
                  { label: 'Stop by 10:30 AM',        value:  2 },
                  { label: 'Stop by 9:30 AM',         value:  1 },
                ].map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
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
