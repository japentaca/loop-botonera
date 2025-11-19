import { useAudioStore } from '../stores/audioStore.js'
import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { useScales } from '../composables/useMusic.js'

// Tonal cycles module - minimal implementation
const MODE_SEQUENCE = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian']

const cycles = new Map() // cycleId -> { config, timer, waitingTimeout, paused, lastStepTime }
let nextCycleId = 1
const _listeners = new Set()

function _emitChange() {
  try {
    const list = listCycles() || []
    _listeners.forEach(fn => {
      try { fn(list) } catch (e) { console.error('[tonalCycles] listener error', e) }
    })
  } catch (err) {
    console.error('[tonalCycles] _emitChange error', err)
  }
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => { }
  _listeners.add(fn)
  // send current state
  try { fn(listCycles()) } catch (e) { console.error('[tonalCycles] listener init error', e) }
  return () => _listeners.delete(fn)
}

function _rotateModeName(current) {
  const seq = MODE_SEQUENCE
  const idx = seq.indexOf(current)
  if (idx < 0) return seq[0]
  return seq[(idx + 1) % seq.length]
}

// compute ms to next measure to support 'snapToMeasure'
function _msToNextMeasure(tempoMsPerBeat) {
  try {
    const audioStore = useAudioStore()
    const currentPulse = Number(audioStore.currentPulse?.value || audioStore.currentPulse || 0)
    const pulsesPerMeasure = 16
    const msPerPulse = tempoMsPerBeat / 4
    const nextMeasurePulse = (Math.floor(currentPulse / pulsesPerMeasure) + 1) * pulsesPerMeasure
    const diffPulses = Math.max(0, nextMeasurePulse - currentPulse)
    const ms = Math.max(0, Math.round(diffPulses * msPerPulse))
    return ms
  } catch (err) {
    console.warn('[tonalCycles] _msToNextMeasure failed, defaulting to 0', err)
    return 0
  }
}

function _stepCycleImpl(cycle) {
  // Register last step time for UI countdown
  try { cycle.lastStepTime = Date.now() } catch (e) { }
  const { config } = cycle
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()
  const { getScale } = useScales()

  const scope = config.scope || 'global'
  const strategy = config.strategy || 'rotateMode'

  if (scope === 'global') {
    console.log(`${new Date().toISOString()} [tonalCycles] step: scope=${scope} strategy=${strategy} current=${audioStore.currentScale}`)
    // Determine next scale
    if (strategy === 'rotateMode') {
      const current = audioStore.currentScale || 'major'
      const next = _rotateModeName(current)
      audioStore.updateScale(next)
    } else if (strategy === 'shiftKey') {
      // shift root by semitone up
      // not changing mode, compute next root note as text if possible
      // This PoC: simply call getRelatedScale for variety
      const related = getScale(audioStore.currentScale)
      // fallback: use next mode as well
      const next = _rotateModeName(audioStore.currentScale || 'major')
      audioStore.updateScale(next)
    }
  } else if (scope === 'group') {
    const groupId = config.groupId
    if (!groupId) return
    const members = notesMatrix.getGroupMembers(groupId)
    members.forEach(id => {
      if (strategy === 'rotateMode') {
        // apply mode rotate per loop: just quantize and possibly regenerate
        // find current scale from loop metadata, or global
        const meta = notesMatrix.loopMetadata[id] || {}
        const currentScale = meta.scale || audioStore.currentScale
        const next = _rotateModeName(currentScale)
        notesMatrix.quantizeLoop(id, next)
        // regenerate pattern for voice
        notesMatrix.generateLoopNotes(id, { silent: true })
      }
    })
  } else if (scope === 'loop') {
    const loopId = config.loopId
    if (loopId == null) return
    const meta = notesMatrix.loopMetadata[loopId] || {}
    const currentScale = meta.scale || audioStore.currentScale
    const next = _rotateModeName(currentScale)
    notesMatrix.quantizeLoop(loopId, next)
    notesMatrix.generateLoopNotes(loopId, { silent: true })
  }
}

export function startCycle(cfg = {}) {
  // prevent duplicate cycles by default: only one active cycle per (scope,loopId,groupId,strategy)
  const allowMultiple = !!cfg.allowMultiple
  const audioStore = useAudioStore()
  const tempo = (audioStore && audioStore.tempo && typeof audioStore.tempo.value === 'number') ? audioStore.tempo.value : 120
  const tempoMsPerBeat = 60000 / Math.max(1, tempo) // ms per quarter note

  if (!allowMultiple) {
    // Match by scope + target (loopId or groupId if applicable). If found, update the cycle's config
    for (const [id, c] of cycles.entries()) {
      const existing = c.config || {}
      const sameScope = existing.scope === (cfg.scope || 'global')
      // For global scope, there's no target; for group/loop, match target
      const sameLoop = existing.loopId === cfg.loopId
      const sameGroup = existing.groupId === cfg.groupId
      const sameTarget = (existing.scope === 'global' && cfg.scope === 'global') || (sameLoop && cfg.scope === 'loop') || (sameGroup && cfg.scope === 'group')
      if (sameScope && sameTarget) {
        // Update config properties (strategy, interval, snapToMeasure) and restart scheduling
        const newConfig = { ...existing }
        newConfig.strategy = cfg.strategy || newConfig.strategy
        newConfig.loopId = cfg.loopId != null ? cfg.loopId : newConfig.loopId
        newConfig.groupId = cfg.groupId != null ? cfg.groupId : newConfig.groupId
        newConfig.snapToMeasure = !!cfg.snapToMeasure
        newConfig.intervalBeats = cfg.intervalBeats || newConfig.intervalBeats || 4
        newConfig.intervalMs = Math.max(50, newConfig.intervalBeats * tempoMsPerBeat)

        console.log(`${new Date().toISOString()} [tonalCycles] startCycle update config: id=${id} newIntervalMs=${newConfig.intervalMs} snapToMeasure=${newConfig.snapToMeasure}`)

        // apply new config
        c.config = newConfig

        // clear any existing timer or waitingTimeout and re-schedule according to new config
        if (c.timer) {
          clearInterval(c.timer)
          c.timer = null
        }
        if (c.waitingTimeout) {
          clearTimeout(c.waitingTimeout)
          c.waitingTimeout = null
        }

        // If startImmediately explicitly false, leave timers stopped; else schedule
        const shouldStartImmediately = cfg.startImmediately !== false
        if (shouldStartImmediately && newConfig.snapToMeasure) {
          // If snapToMeasure, we need to schedule to the next measure
          const msToNextMeasure = _msToNextMeasure(tempoMsPerBeat)
          c.waitingTimeout = setTimeout(() => {
            _stepCycleImpl(c)
            // set interval for subsequent steps
            const step = () => _stepCycleImpl(c)
            c.timer = setInterval(step, newConfig.intervalMs)
            c.waitingTimeout = null
            // update lastStepTime for UI
            c.lastStepTime = Date.now()
          }, msToNextMeasure)
        } else if (shouldStartImmediately) {
          const step = () => _stepCycleImpl(c)
          c.timer = setInterval(step, newConfig.intervalMs)
          c.lastStepTime = Date.now()
        }

        cycles.set(id, c)
        _emitChange()
        return { id, stop: () => stopCycle(id), step: () => _stepCycleImpl(cycles.get(id)), pause: () => pauseCycle(id), resume: () => resumeCycle(id) }
      }
    }
  }
  const cycleId = nextCycleId++

  const config = {
    scope: cfg.scope || 'global',
    intervalBeats: cfg.intervalBeats || 4,
    intervalMs: Math.max(50, (cfg.intervalBeats || 4) * tempoMsPerBeat), // default: 4 beats at tempo
    strategy: cfg.strategy || 'rotateMode',
    loopId: cfg.loopId,
    groupId: cfg.groupId
  }
  config.snapToMeasure = !!cfg.snapToMeasure
  const step = () => _stepCycleImpl(cycles.get(cycleId))
  let timer = null
  let paused = false
  if (typeof setInterval === 'function' && cfg.startImmediately !== false) {
    if (cfg.snapToMeasure) {
      // schedule to next measure and then set interval
      const msToNext = _msToNextMeasure(tempoMsPerBeat)
      const waiting = setTimeout(() => {
        _stepCycleImpl(cycles.get(cycleId))
        timer = setInterval(step, config.intervalMs)
        // record lastStepTime
        try { cycles.get(cycleId).lastStepTime = Date.now() } catch (e) { }
      }, msToNext)
      cycles.set(cycleId, { config, timer: null, waitingTimeout: waiting, paused: false })
      console.log(`${new Date().toISOString()} [tonalCycles] startCycle id=${cycleId} scope=${config.scope} strategy=${config.strategy} snapToMeasure intervalMs=${config.intervalMs} waitingMs=${msToNext}`)
    } else {
      timer = setInterval(step, config.intervalMs)
      try { cycles.get(cycleId).lastStepTime = Date.now() } catch (e) { }
      paused = false
      console.log(`${new Date().toISOString()} [tonalCycles] startCycle id=${cycleId} scope=${config.scope} strategy=${config.strategy} intervalMs=${config.intervalMs}`)
    }
  }
  cycles.set(cycleId, { config, timer, waitingTimeout: null, paused, lastStepTime: timer ? Date.now() : null })
  _emitChange()
  return { id: cycleId, stop: () => stopCycle(cycleId), step: () => _stepCycleImpl(cycles.get(cycleId)), pause: () => pauseCycle(cycleId), resume: () => resumeCycle(cycleId) }
}

export function stopCycle(cycleId) {
  const cycle = cycles.get(cycleId)
  if (!cycle) return false
  if (cycle.timer) clearInterval(cycle.timer)
  if (cycle.waitingTimeout) clearTimeout(cycle.waitingTimeout)
  cycles.delete(cycleId)
  _emitChange()
  return true
}

export function pauseCycle(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return false
  if (c.timer) clearInterval(c.timer)
  if (c.waitingTimeout) clearTimeout(c.waitingTimeout)
  c.timer = null
  c.paused = true
  cycles.set(cycleId, c)
  console.log(`${new Date().toISOString()} [tonalCycles] pauseCycle id=${cycleId}`)
  _emitChange()
  return true
}

export function resumeCycle(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return false
  if (c.timer) {
    // already running
    return true
  }
  const shouldSnap = !!c.config.snapToMeasure
  if (shouldSnap) {
    const audioStore = useAudioStore()
    const tempo = (audioStore && audioStore.tempo && typeof audioStore.tempo.value === 'number') ? audioStore.tempo.value : 120
    const tempoMsPerBeat = 60000 / Math.max(1, tempo)
    const msToNextMeasure = _msToNextMeasure(tempoMsPerBeat)
    // schedule a one-time step aligned to measure, then set up periodic interval
    c.waitingTimeout = setTimeout(() => {
      _stepCycleImpl(c)
      const step = () => _stepCycleImpl(c)
      c.timer = setInterval(step, c.config.intervalMs)
      c.waitingTimeout = null
      cycles.set(cycleId, c)
      _emitChange()
    }, msToNextMeasure)
  } else {
    // restart timer
    const step = () => _stepCycleImpl(c)
    c.timer = setInterval(step, c.config.intervalMs)
  }
  c.paused = false
  cycles.set(cycleId, c)
  console.log(`${new Date().toISOString()} [tonalCycles] resumeCycle id=${cycleId} interval=${c.config.intervalMs}ms`)
  _emitChange()
  return true
}

export function getCycleInfo(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return null
  return { id: cycleId, config: c.config, paused: !!c.paused, waiting: !!c.waitingTimeout, lastStepTime: c.lastStepTime || null }
}

export function stepCycle(cycleId) {
  const cycle = cycles.get(cycleId)
  if (!cycle) return false
  _stepCycleImpl(cycle)
  return true
}

export function listCycles() { return Array.from(cycles.keys()).map(id => getCycleInfo(id)) }

export default { startCycle, stopCycle, stepCycle, listCycles }
