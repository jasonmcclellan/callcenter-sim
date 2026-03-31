import { useState, useRef, useCallback } from 'react'
import SimulatorForm from './components/SimulatorForm'
import StatCard from './components/StatCard'
import IntradayChart from './components/IntradayChart'
import SLHistogram from './components/SLHistogram'
import WaitTimeHistogram from './components/WaitTimeHistogram'
import StaffingTable from './components/StaffingTable'
import SensitivityGrid from './components/SensitivityGrid'
import SprinklerResult from './components/SprinklerResult'

const DEFAULTS = {
  numAgents:         12,
  minAgents:         5,
  baselineAgents:    8,
  maxSprinklePerHour: 5,
  totalCallsPerDay:  1500,
  avgHandleTime:     600,
  slThreshold:       120,
  slTargetPct:       80,
  earlyPct:          60,
  patienceThreshold: 300,
  numRuns:           200,
}

function fmt(n, d = 1) { return n.toFixed(d) }

function fmtTime(s) {
  if (s < 60)   return `${fmt(s)}s`
  if (s < 3600) return `${fmt(s / 60)}m`
  return `${fmt(s / 3600)}h`
}

export default function App() {
  const [mode, setMode]                   = useState('manual')
  const [params, setParams]               = useState(DEFAULTS)
  const [results, setResults]             = useState(null)
  const [progress, setProgress]           = useState(null)
  const [running, setRunning]             = useState(false)
  const [error, setError]                 = useState(null)
  const [sensitivityData, setSensitivity] = useState(null)
  const [sensitivityLoading, setSensitivityLoading] = useState(false)
  const workerRef            = useRef(null)
  const sensitivityWorkerRef = useRef(null)

  const stopWorker = () => {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
    if (sensitivityWorkerRef.current) { sensitivityWorkerRef.current.terminate(); sensitivityWorkerRef.current = null }
  }

  const handleModeChange = useCallback((newMode) => {
    stopWorker()
    setMode(newMode)
    setResults(null)
    setProgress(null)
    setRunning(false)
    setError(null)
    setSensitivity(null)
    setSensitivityLoading(false)
  }, [])

  const handleChange = useCallback((key, value) => {
    setParams((p) => ({ ...p, [key]: value }))
  }, [])

  const handleRun = useCallback(() => {
    if (running) return
    stopWorker()
    setRunning(true)
    setError(null)
    setResults(null)
    setProgress(null)
    setSensitivity(null)
    setSensitivityLoading(false)

    const worker = new Worker(
      new URL('./workers/simulator.worker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    // Snapshot params + mode used for this run (for sensitivity worker)
    const snap = { ...params, mode }

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProgress({ agents: msg.agents, sl: msg.sl, totalSprinkles: msg.totalSprinkles, currentSL: msg.currentSL })
        return
      }
      // type === 'result'
      setResults({
        ...msg,
        slTargetPct:       snap.slTargetPct,
        numRuns:           snap.numRuns,
        slThreshold:       snap.slThreshold,
        patienceThreshold: snap.patienceThreshold,
      })
      setProgress(null)
      setRunning(false)
      worker.terminate()

      // Auto-trigger sensitivity grid
      setSensitivityLoading(true)
      setSensitivity(null)
      const sw = new Worker(
        new URL('./workers/simulator.worker.js', import.meta.url),
        { type: 'module' }
      )
      sensitivityWorkerRef.current = sw
      sw.onmessage = (ev) => {
        if (ev.data.type === 'result') {
          setSensitivity(ev.data)
          setSensitivityLoading(false)
          sw.terminate()
        }
      }
      sw.onerror = () => { setSensitivityLoading(false); sw.terminate() }
      if (snap.mode === 'sprinkler') {
        sw.postMessage({ ...snap, mode: 'sprinklerSensitivity', sprinkles: msg.sprinkles, baselineAgents: snap.baselineAgents })
      } else {
        const baseAgents = msg.recommendedAgents ?? snap.numAgents
        sw.postMessage({ mode: 'sensitivity', baseAgents, ...snap })
      }
    }

    worker.onerror = (e) => {
      setError(`Simulation error: ${e.message}`)
      setProgress(null)
      setRunning(false)
      worker.terminate()
    }

    worker.postMessage({ ...params, mode })
  }, [params, mode, running])

  const metTarget   = results ? results.meanSL >= results.slTargetPct : null
  const isOptimize  = mode === 'optimize'
  const isSprinkler = mode === 'sprinkler'

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            CC
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Call Center Simulator</h1>
            <p className="text-xs text-gray-400">
              Monte Carlo · Single Queue · M/M/c · 8:30 AM–8:30 PM · Peak 2:00 PM
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <SimulatorForm
              mode={mode}
              onModeChange={handleModeChange}
              params={params}
              onChange={handleChange}
              onRun={handleRun}
              running={running}
            />
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Running states */}
            {running && !isOptimize && !isSprinkler && (
              <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center justify-center gap-3 text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Running {params.numRuns.toLocaleString()} simulations…</p>
              </div>
            )}

            {running && isSprinkler && (
              <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center gap-4 text-gray-500">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {progress
                      ? `Schedule computed: ${progress.totalSprinkles} sprinkle agent${progress.totalSprinkles !== 1 ? 's' : ''} — verifying…`
                      : 'Analyzing baseline coverage…'}
                  </p>
                  {progress && (
                    <p className="text-xs text-gray-400 mt-1">
                      Baseline SL: <span className="font-semibold text-gray-600">{progress.currentSL.toFixed(1)}%</span>
                      {' '}· Target: {params.slTargetPct}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {running && isOptimize && (
              <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center justify-center gap-4 text-gray-500">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {progress
                      ? `Testing ${progress.agents} agents…`
                      : 'Starting optimizer…'}
                  </p>
                  {progress && (
                    <p className="text-xs text-gray-400 mt-1">
                      Current SL: <span className="font-semibold text-gray-600">{progress.sl.toFixed(1)}%</span>
                      {' '}· Target: {params.slTargetPct}%
                    </p>
                  )}
                </div>
                {/* Progress bar — agents from minAgents toward target (unknown), soft fill */}
                {progress && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-400 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          ((progress.agents - params.minAgents) / Math.max(progress.agents - params.minAgents + 5, 10)) * 100,
                          90
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!running && !results && !error && (
              <div className="bg-white rounded-2xl shadow-md p-10 flex flex-col items-center justify-center text-gray-400 gap-2">
                <p className="text-3xl">📊</p>
                <p className="text-sm">
                  Configure parameters and click{' '}
                  <strong>{isOptimize ? 'Run Optimizer' : isSprinkler ? 'Run Sprinkler' : 'Run Simulation'}</strong>
                </p>
              </div>
            )}

            {/* Results */}
            {!running && results && (
              <>
                {/* Banner */}
                {isOptimize ? (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                      results.targetMet
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}
                  >
                    <span>{results.targetMet ? '✓' : '⚠'}</span>
                    <span>
                      {results.targetMet
                        ? `Optimal staffing: ${results.recommendedAgents} agents achieves ${fmt(results.meanSL)}% service level.`
                        : `Search exhausted at ${results.recommendedAgents} agents — SL ${fmt(results.meanSL)}% below ${results.slTargetPct}% target.`}
                    </span>
                  </div>
                ) : isSprinkler ? (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                      results.targetMet
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}
                  >
                    <span>{results.targetMet ? '✓' : '⚠'}</span>
                    <span>
                      {results.targetMet
                        ? `Sprinkler target met: ${results.meanSL.toFixed(1)}% SL with ${results.sprinkles.reduce((a, b) => a + b, 0)} sprinkle agent${results.sprinkles.reduce((a, b) => a + b, 0) !== 1 ? 's' : ''}.`
                        : `Target not reached — SL ${fmt(results.meanSL)}% below ${results.slTargetPct}% target.`}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                      metTarget
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    <span>{metTarget ? '✓' : '✗'}</span>
                    <span>
                      Mean service level {fmt(results.meanSL)}% is{' '}
                      {metTarget ? 'above' : 'below'} the {results.slTargetPct}% target.
                    </span>
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Service Level"
                    value={`${fmt(results.meanSL)}%`}
                    sub={`Target: ${results.slTargetPct}%`}
                    highlight={results.meanSL >= results.slTargetPct}
                  />
                  <StatCard
                    label="Avg Speed of Answer"
                    value={fmtTime(results.meanASA)}
                    sub="mean wait time"
                  />
                  <StatCard
                    label="Utilization"
                    value={`${fmt(results.meanUtilization)}%`}
                    sub="agent occupancy"
                  />
                  <StatCard
                    label="Est. Abandon Rate"
                    value={`${fmt(results.abandonRate)}%`}
                    sub={`patience > ${fmtTime(results.patienceThreshold)}`}
                    danger={results.abandonRate > 5}
                  />
                </div>

                {/* Optimizer staffing table (optimizer mode only) */}
                {isOptimize && (
                  <StaffingTable
                    intradayData={results.intradayData}
                    recommendedAgents={results.recommendedAgents}
                    targetMet={results.targetMet}
                    slTargetPct={results.slTargetPct}
                  />
                )}

                {/* Sprinkler schedule (sprinkler mode only) */}
                {isSprinkler && results.sprinkles && (
                  <SprinklerResult
                    sprinkles={results.sprinkles}
                    intradayData={results.intradayData}
                    baselineIntradayData={results.baselineIntradayData}
                    erlangNeeded={results.erlangNeeded}
                    targetMet={results.targetMet}
                    slTargetPct={results.slTargetPct}
                  />
                )}

                {/* Intraday chart */}
                <IntradayChart intradayData={results.intradayData} />

                {/* SL distribution histogram */}
                <SLHistogram
                  histogram={results.histogram}
                  slTargetPct={results.slTargetPct}
                  numRuns={results.numRuns}
                />

                {/* Wait time histogram */}
                <WaitTimeHistogram
                  waitHistogram={results.waitHistogram}
                  slThreshold={results.slThreshold}
                />

                {/* Sensitivity grid — shown once available */}
                {(sensitivityLoading || sensitivityData) && (
                  <SensitivityGrid
                    data={sensitivityData}
                    baseAgents={isSprinkler ? params.baselineAgents : (results.recommendedAgents ?? params.numAgents)}
                    slTargetPct={results.slTargetPct}
                    loading={sensitivityLoading}
                    label={isSprinkler ? 'Baseline Agent Sensitivity (with sprinkle schedule held fixed)' : undefined}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
