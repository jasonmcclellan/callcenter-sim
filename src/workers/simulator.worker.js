// ── Time constants (seconds from 8:30 AM) ──────────────────────────────────
const SIM_END       = 43200   // 12 hours (8:30 PM)
const PEAK_TIME     = 19800   // 5.5 h → 2:00 PM
const PEAK_SPREAD   = 9000    // 2.5 h std dev
const NUM_INTERVALS = 24
const INTERVAL_SECS = 1800    // 30 min

// ── Shift constants ────────────────────────────────────────────────────────
const SHIFT_TOTAL    = 30600  // 8.5 h scheduled
const LUNCH_DURATION = 1800   // 30 min unpaid
const BREAK_DURATION = 900    // 15 min (×2, paid)
const EARLY_BAND_END = 7200   // 10:30 AM
const LATE_BAND_END  = 12600  // 12:00 PM

// ── Wait-time bucket definitions ────────────────────────────────────────────
const WAIT_BUCKETS = [
  { label: '0–30s',  min: 0,   max: 30 },
  { label: '30–60s', min: 30,  max: 60 },
  { label: '1–2min', min: 60,  max: 120 },
  { label: '2–5min', min: 120, max: 300 },
  { label: '5min+',  min: 300, max: Infinity },
]

// ── Random helpers ─────────────────────────────────────────────────────────
function expRandom(mean) {
  return -Math.log(Math.random()) * mean
}

function stdNormal() {
  return Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random())
}

function poissonApprox(lambda) {
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * stdNormal()))
}

// ── Call arrivals ──────────────────────────────────────────────────────────
function generateArrivals(n) {
  const arrivals = []
  while (arrivals.length < n) {
    const t = PEAK_TIME + PEAK_SPREAD * stdNormal()
    if (t >= 0 && t < SIM_END) arrivals.push(t)
  }
  return arrivals.sort((a, b) => a - b)
}

// ── Agent schedule builder ─────────────────────────────────────────────────
function buildSchedule(shiftStart) {
  const shiftEnd   = shiftStart + SHIFT_TOTAL
  const lunchStart = shiftStart + 15300 + (Math.random() - 0.5) * 3600
  const lunchEnd   = lunchStart + LUNCH_DURATION
  const b1Mid      = shiftStart + (lunchStart - shiftStart) / 2
  const break1S    = b1Mid - BREAK_DURATION / 2
  const break1E    = break1S + BREAK_DURATION
  const b2Mid      = lunchEnd + (shiftEnd - lunchEnd) / 2
  const break2S    = b2Mid - BREAK_DURATION / 2
  const break2E    = break2S + BREAK_DURATION
  return { shiftStart, shiftEnd, lunchStart, lunchEnd, break1S, break1E, break2S, break2E }
}

function generateSchedules(numAgents, earlyPct) {
  const numEarly = Math.round(numAgents * earlyPct / 100)
  const numLate  = numAgents - numEarly
  const schedules = []
  const place = (n, lo, hi) => {
    for (let i = 0; i < n; i++) {
      schedules.push(buildSchedule(n > 1 ? lo + (i / (n - 1)) * (hi - lo) : lo))
    }
  }
  place(numEarly, 0,             EARLY_BAND_END)
  place(numLate,  EARLY_BAND_END, LATE_BAND_END)
  return schedules
}

// ── Sprinkle agent (1-hour window, no breaks/lunch) ───────────────────────
function buildSprinkleSchedule(hourIdx) {
  return {
    shiftStart: hourIdx * 3600, shiftEnd: hourIdx * 3600 + 3600,
    lunchStart: Infinity, lunchEnd: Infinity,
    break1S:    Infinity, break1E:  Infinity,
    break2S:    Infinity, break2E:  Infinity,
  }
}

// ── Agent availability ─────────────────────────────────────────────────────
function isAvailable(ag, t) {
  if (t < ag.shiftStart || t >= ag.shiftEnd)  return false
  if (t >= ag.lunchStart && t < ag.lunchEnd)  return false
  if (t >= ag.break1S    && t < ag.break1E)   return false
  if (t >= ag.break2S    && t < ag.break2E)   return false
  return true
}

function effectiveStart(ag, proposed) {
  let t = proposed
  if (t < ag.shiftStart) t = ag.shiftStart
  if (t >= ag.shiftEnd)  return Infinity
  const wins = [[ag.lunchStart, ag.lunchEnd], [ag.break1S, ag.break1E], [ag.break2S, ag.break2E]]
  let changed = true
  while (changed) {
    changed = false
    for (const [s, e] of wins) {
      if (t >= s && t < e) { t = e; changed = true }
    }
    if (t >= ag.shiftEnd) return Infinity
  }
  return t
}

// ── Interval label ─────────────────────────────────────────────────────────
function intervalLabel(i) {
  const totalMins = 8 * 60 + 30 + i * 30
  const h24 = Math.floor(totalMins / 60)
  const m   = totalMins % 60
  return `${h24 % 12 || 12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

// ── Core simulation (accepts pre-built agent list) ─────────────────────────
function runSimCore({ agents, agentWorkSecs, totalCallsPerDay, avgHandleTime, slThreshold }) {
  const n         = agents.length
  const agentFree = new Array(n).fill(0)
  const arrivals  = generateArrivals(poissonApprox(totalCallsPerDay))
  const intCalls    = new Array(NUM_INTERVALS).fill(0)
  const intAgents   = new Array(NUM_INTERVALS).fill(0)
  const intWithinSL = new Array(NUM_INTERVALS).fill(0)
  const intAnswered = new Array(NUM_INTERVALS).fill(0)

  for (let iv = 0; iv < NUM_INTERVALS; iv++) {
    const mid = iv * INTERVAL_SECS + INTERVAL_SECS / 2
    for (const ag of agents) if (isAvailable(ag, mid)) intAgents[iv]++
  }
  for (const t of arrivals) {
    intCalls[Math.min(Math.floor(t / INTERVAL_SECS), NUM_INTERVALS - 1)]++
  }

  let totalWait = 0, withinSL = 0, totalHT = 0, answered = 0
  const waitBuckets = new Array(WAIT_BUCKETS.length).fill(0)

  for (const arrival of arrivals) {
    let minStart = Infinity, bestIdx = -1
    for (let i = 0; i < n; i++) {
      const eff = effectiveStart(agents[i], Math.max(agentFree[i], arrival))
      if (eff < minStart) { minStart = eff; bestIdx = i }
    }
    if (bestIdx === -1 || minStart === Infinity) continue
    const wait = minStart - arrival
    const ht   = expRandom(avgHandleTime)
    agentFree[bestIdx] = minStart + ht
    totalWait += wait; totalHT += ht; answered++
    const iv = Math.min(Math.floor(arrival / INTERVAL_SECS), NUM_INTERVALS - 1)
    intAnswered[iv]++
    if (wait <= slThreshold) { withinSL++; intWithinSL[iv]++ }
    for (let b = 0; b < WAIT_BUCKETS.length; b++) {
      if (wait < WAIT_BUCKETS[b].max) { waitBuckets[b]++; break }
    }
  }
  return {
    sl:          answered > 0 ? (withinSL / answered) * 100 : 0,
    asa:         answered > 0 ? totalWait / answered : 0,
    utilization: agentWorkSecs > 0 ? Math.min((totalHT / agentWorkSecs) * 100, 100) : 0,
    waitBuckets, n: answered, intCalls, intAgents, intWithinSL, intAnswered,
  }
}

function runSingleSim({ numAgents, totalCallsPerDay, avgHandleTime, slThreshold, earlyPct }) {
  const agents = generateSchedules(numAgents, earlyPct)
  return runSimCore({
    agents, agentWorkSecs: numAgents * (SHIFT_TOTAL - LUNCH_DURATION),
    totalCallsPerDay, avgHandleTime, slThreshold,
  })
}

function runSingleSimSprinkler({ baselineAgents, sprinkles, earlyPct, totalCallsPerDay, avgHandleTime, slThreshold }) {
  const regular = generateSchedules(baselineAgents, earlyPct)
  let numSprinkle = 0
  const sprinkleList = []
  for (let h = 0; h < 12; h++) {
    for (let s = 0; s < sprinkles[h]; s++) {
      sprinkleList.push(buildSprinkleSchedule(h))
      numSprinkle++
    }
  }
  return runSimCore({
    agents: [...regular, ...sprinkleList],
    agentWorkSecs: baselineAgents * (SHIFT_TOTAL - LUNCH_DURATION) + numSprinkle * 3600,
    totalCallsPerDay, avgHandleTime, slThreshold,
  })
}

// ── Aggregate N simulation runs ────────────────────────────────────────────
function runAllSimulations({ numAgents, baselineAgents, sprinkles, totalCallsPerDay, avgHandleTime, slThreshold, patienceThreshold, earlyPct, numRuns }) {
  const isSprinkler = Array.isArray(sprinkles)
  const slVals = [], asaVals = [], utilVals = []
  const totWB         = new Array(WAIT_BUCKETS.length).fill(0)
  const totIntCalls   = new Array(NUM_INTERVALS).fill(0)
  const totIntAgents  = new Array(NUM_INTERVALS).fill(0)
  const totIntWithinSL = new Array(NUM_INTERVALS).fill(0)
  const totIntAnswered = new Array(NUM_INTERVALS).fill(0)
  let totalCalls = 0, totalAbandons = 0

  for (let r = 0; r < numRuns; r++) {
    const res = isSprinkler
      ? runSingleSimSprinkler({ baselineAgents, sprinkles, earlyPct, totalCallsPerDay, avgHandleTime, slThreshold })
      : runSingleSim({ numAgents, totalCallsPerDay, avgHandleTime, slThreshold, earlyPct })
    slVals.push(res.sl); asaVals.push(res.asa); utilVals.push(res.utilization)
    for (let b = 0; b < WAIT_BUCKETS.length; b++) totWB[b] += res.waitBuckets[b]
    for (let iv = 0; iv < NUM_INTERVALS; iv++) {
      totIntCalls[iv]    += res.intCalls[iv]
      totIntAgents[iv]   += res.intAgents[iv]
      totIntWithinSL[iv] += res.intWithinSL[iv]
      totIntAnswered[iv] += res.intAnswered[iv]
    }
    totalCalls += res.n
    for (let b = 0; b < WAIT_BUCKETS.length; b++) {
      if (WAIT_BUCKETS[b].min >= patienceThreshold) totalAbandons += res.waitBuckets[b]
    }
  }

  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

  const numBins = 20, binW = 5
  const histogram = Array.from({ length: numBins }, (_, i) => ({
    bin: `${i * binW}–${(i + 1) * binW}`, count: 0, midpoint: (i + 0.5) * binW,
  }))
  for (const sl of slVals) histogram[Math.min(Math.floor(sl / binW), numBins - 1)].count++

  const waitHistogram = WAIT_BUCKETS.map((b, i) => ({
    label: b.label, min: b.min, max: b.max,
    pct: totalCalls > 0 ? (totWB[i] / totalCalls) * 100 : 0,
  }))

  const intradayData = Array.from({ length: NUM_INTERVALS }, (_, i) => ({
    time:   intervalLabel(i),
    calls:  totIntCalls[i]  / numRuns,
    agents: totIntAgents[i] / numRuns,
    sl:     totIntAnswered[i] > 0 ? (totIntWithinSL[i] / totIntAnswered[i]) * 100 : null,
  }))

  return {
    meanSL:          mean(slVals),
    meanASA:         mean(asaVals),
    meanUtilization: mean(utilVals),
    slValues:        slVals,
    histogram,
    waitHistogram,
    intradayData,
    abandonRate: totalCalls > 0 ? (totalAbandons / totalCalls) * 100 : 0,
  }
}

// ── Erlang-C staffing model ────────────────────────────────────────────────
// Returns the fraction of calls answered within slThreshold seconds.
// Uses log-space intermediate values to avoid float overflow at high traffic.
function erlangCServiceLevel(lambda, aht, c, slThreshold) {
  const A = lambda * aht         // offered load (Erlangs)
  if (lambda <= 0) return 1.0
  if (c <= 0)      return 0.0
  if (A >= c)      return 0.0    // overloaded — infinite queue

  const logA = Math.log(A)
  let logTerm = 0                // log(A^0 / 0!)
  const logTerms = [0]
  for (let k = 1; k < c; k++) {
    logTerm += logA - Math.log(k)
    logTerms.push(logTerm)
  }
  const logAcCfact = logTerm + logA - Math.log(c)         // log(A^c / c!)
  const logNum     = logAcCfact + Math.log(c / (c - A))   // log of C(c,A) numerator

  const maxLog  = Math.max(logNum, ...logTerms)
  const sumNorm = logTerms.reduce((s, lt) => s + Math.exp(lt - maxLog), 0)
  const numNorm = Math.exp(logNum - maxLog)
  const C       = numNorm / (sumNorm + numNorm)            // Erlang-C: P(wait > 0)

  return Math.max(0, Math.min(1, 1 - C * Math.exp(-(c - A) * slThreshold / aht)))
}

// Returns minimum integer c such that Erlang-C SL >= slFraction (e.g. 0.80).
function minAgentsForSL(lambda, aht, slThreshold, slFraction) {
  if (lambda <= 0) return 0
  const A = lambda * aht
  for (let c = Math.max(1, Math.ceil(A)); c <= 200; c++) {
    if (erlangCServiceLevel(lambda, aht, c, slThreshold) >= slFraction) return c
  }
  return 200
}

// ── Message handler ────────────────────────────────────────────────────────
self.onmessage = function (e) {
  const { mode = 'manual' } = e.data

  if (mode === 'optimize') {
    const { minAgents, slTargetPct, numRuns, totalCallsPerDay, avgHandleTime,
            slThreshold, patienceThreshold, earlyPct } = e.data
    const simParams  = { totalCallsPerDay, avgHandleTime, slThreshold, patienceThreshold, earlyPct }
    const searchRuns = Math.min(numRuns, 80)   // quick probe per level
    const maxAgents  = minAgents + 100

    for (let n = minAgents; n <= maxAgents; n++) {
      const probe = runAllSimulations({ ...simParams, numAgents: n, numRuns: searchRuns })

      self.postMessage({ type: 'progress', agents: n, sl: probe.meanSL })

      if (probe.meanSL >= slTargetPct) {
        // Confirm with full runs for accurate stats
        const final = runAllSimulations({ ...simParams, numAgents: n, numRuns })
        self.postMessage({ type: 'result', recommendedAgents: n, targetMet: true, ...final })
        return
      }
    }

    // Exhausted without hitting target — report best found
    const final = runAllSimulations({ ...simParams, numAgents: maxAgents, numRuns })
    self.postMessage({ type: 'result', recommendedAgents: maxAgents, targetMet: false, ...final })

  } else if (mode === 'sprinkler') {
    const { baselineAgents, slTargetPct, numRuns, totalCallsPerDay, avgHandleTime,
            slThreshold, patienceThreshold, earlyPct, maxSprinklePerHour = 50 } = e.data
    const simParams  = { totalCallsPerDay, avgHandleTime, slThreshold, patienceThreshold, earlyPct }
    const searchRuns = Math.min(numRuns, 60)
    const zeroSprinkles = new Array(12).fill(0)

    // ── Step 1: Baseline probe — measure per-interval coverage & call volume ─
    const baselineProbe        = runAllSimulations({ ...simParams, baselineAgents, sprinkles: zeroSprinkles, numRuns: searchRuns })
    const baselineIntradayData = baselineProbe.intradayData

    // ── Step 2: Erlang-C gap analysis per 30-min interval ────────────────────
    const erlangNeeded = new Array(NUM_INTERVALS).fill(0)
    for (let iv = 0; iv < NUM_INTERVALS; iv++) {
      const lambdaIv    = baselineIntradayData[iv].calls / INTERVAL_SECS  // avg calls/sec
      erlangNeeded[iv]  = minAgentsForSL(lambdaIv, avgHandleTime, slThreshold, slTargetPct / 100)
    }

    // ── Step 3: Per-hour sprinkle = ceiling of worst-interval gap ─────────────
    const sprinkles = new Array(12).fill(0)
    for (let h = 0; h < 12; h++) {
      const avail0   = baselineIntradayData[h * 2].agents
      const avail1   = baselineIntradayData[h * 2 + 1].agents
      const gap0     = Math.max(0, erlangNeeded[h * 2]     - avail0)
      const gap1     = Math.max(0, erlangNeeded[h * 2 + 1] - avail1)
      sprinkles[h]   = Math.min(Math.ceil(Math.max(gap0, gap1)), maxSprinklePerHour)
    }

    const totalSprinkles = sprinkles.reduce((a, b) => a + b, 0)
    self.postMessage({ type: 'progress', totalSprinkles, currentSL: baselineProbe.meanSL })

    // ── Step 4: Full-run simulation with computed sprinkles ───────────────────
    const final = runAllSimulations({ ...simParams, baselineAgents, sprinkles, numRuns })
    self.postMessage({
      type: 'result',
      sprinkles: [...sprinkles],
      targetMet: final.meanSL >= slTargetPct,
      baselineIntradayData,
      erlangNeeded,
      ...final,
    })

  } else if (mode === 'sprinklerSensitivity') {
    // Run the final sprinkle schedule at baseline, baseline+1 … baseline+5 agents
    const { sprinkles, baselineAgents, numRuns, totalCallsPerDay, avgHandleTime,
            slThreshold, patienceThreshold, earlyPct } = e.data
    const simParams   = { totalCallsPerDay, avgHandleTime, slThreshold, patienceThreshold, earlyPct }
    const probeRuns   = Math.min(numRuns, 60)
    const agentCounts = Array.from({ length: 6 }, (_, i) => baselineAgents + i)

    function hourlySlFrom(intradayData) {
      return Array.from({ length: 12 }, (_, h) => {
        const a = intradayData[h * 2]
        const b = intradayData[h * 2 + 1]
        const total = a.calls + b.calls
        if (total === 0 || (a.sl === null && b.sl === null)) return null
        return ((a.sl ?? 0) * a.calls + (b.sl ?? 0) * b.calls) / total
      })
    }

    const firstSim = runAllSimulations({ ...simParams, baselineAgents, sprinkles, numRuns: probeRuns })
    const hours = Array.from({ length: 12 }, (_, h) => {
      const start = firstSim.intradayData[h * 2].time
      const end   = h < 11 ? firstSim.intradayData[(h + 1) * 2].time : '8:30 PM'
      return `${start}–${end}`
    })

    const grid = [hourlySlFrom(firstSim.intradayData)]
    for (let i = 1; i < agentCounts.length; i++) {
      const sim = runAllSimulations({ ...simParams, baselineAgents: agentCounts[i], sprinkles, numRuns: probeRuns })
      grid.push(hourlySlFrom(sim.intradayData))
    }

    const transposed = Array.from({ length: 12 }, (_, h) => grid.map((col) => col[h]))
    self.postMessage({ type: 'result', agentCounts, hours, grid: transposed })

  } else if (mode === 'sensitivity') {
    // Run simulation at base, base+1 … base+5 and return per-hour SL grid
    const { baseAgents, numRuns, totalCallsPerDay, avgHandleTime,
            slThreshold, patienceThreshold, earlyPct } = e.data
    const simParams   = { totalCallsPerDay, avgHandleTime, slThreshold, patienceThreshold, earlyPct }
    const probeRuns   = Math.min(numRuns, 60)
    const agentCounts = Array.from({ length: 6 }, (_, i) => Math.max(1, baseAgents + i))

    function hourlySlFrom(intradayData) {
      return Array.from({ length: 12 }, (_, h) => {
        const a = intradayData[h * 2]
        const b = intradayData[h * 2 + 1]
        const total = a.calls + b.calls
        if (total === 0 || (a.sl === null && b.sl === null)) return null
        return ((a.sl ?? 0) * a.calls + (b.sl ?? 0) * b.calls) / total
      })
    }

    // Build hour labels from the first run's intradayData
    const firstSim = runAllSimulations({ ...simParams, numAgents: agentCounts[0], numRuns: probeRuns })
    const hours = Array.from({ length: 12 }, (_, h) => {
      const start = firstSim.intradayData[h * 2].time
      const end   = h < 11 ? firstSim.intradayData[(h + 1) * 2].time : '8:30 PM'
      return `${start}–${end}`
    })

    const grid = [hourlySlFrom(firstSim.intradayData)]
    for (let i = 1; i < agentCounts.length; i++) {
      const sim = runAllSimulations({ ...simParams, numAgents: agentCounts[i], numRuns: probeRuns })
      grid.push(hourlySlFrom(sim.intradayData))
    }

    // Transpose: grid[hour][agentIdx] instead of grid[agentIdx][hour]
    const transposed = Array.from({ length: 12 }, (_, h) => grid.map((col) => col[h]))

    self.postMessage({ type: 'result', agentCounts, hours, grid: transposed })

  } else {
    // Manual mode
    const result = runAllSimulations(e.data)
    self.postMessage({ type: 'result', ...result })
  }
}
