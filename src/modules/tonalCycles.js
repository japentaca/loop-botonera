import { useAudioStore } from '../stores/audioStore.js'
import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { useScales } from '../composables/useMusic.js'

// Tonal cycles module - minimal implementation
const MODE_SEQUENCE = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian']

const cycles = new Map() // cycleId -> { config, timer, waitingTimeout, paused, lastStepTime }
let nextCycleId = 1
const _listeners = new Set()
const pulsesPerBeat = 4
let _transportListenerRegistered = false
let _transportListenerFn = null

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

function _registerTransportListenerIfNeeded() {
  try {
    if (_transportListenerRegistered) return
    const audioStore = useAudioStore()
    if (!audioStore || typeof audioStore.registerTransportListener !== 'function') return
    _transportListenerFn = (time, pulse) => {
      try {
        // Check cycles on each pulse; step cycles when nextPulse reached
        for (const [id, c] of cycles.entries()) {
          if (!c) continue
          const cfg = c.config || {}
          if (c.paused) continue
          if (!c.nextPulse) continue
          if (pulse >= c.nextPulse) {
            try {
              _stepCycleImpl(c)
            } catch (e) { console.warn('[tonalCycles] step error', e) }
            // If we were waiting for a snapToMeasure start, clear the waiting flag
            if (c.waitingTimeout) c.waitingTimeout = null
            // schedule next
            const stepPulses = cfg.intervalPulses || (cfg.intervalBeats || 4) * pulsesPerBeat
            c.nextPulse = c.nextPulse + stepPulses
            cycles.set(id, c)
          }
        }
      } catch (err) { console.warn('[tonalCycles] transport listener error', err) }
    }
    audioStore.registerTransportListener(_transportListenerFn)
    _transportListenerRegistered = true
  } catch (err) {
    console.warn('[tonalCycles] registerTransportListener failed', err)
  }
}

function _unregisterTransportListener() {
  try {
    if (!_transportListenerRegistered) return
    const audioStore = useAudioStore()
    if (!audioStore || typeof audioStore.unregisterTransportListener !== 'function') return
    if (_transportListenerFn) audioStore.unregisterTransportListener(_transportListenerFn)
    _transportListenerRegistered = false
    _transportListenerFn = null
  } catch (err) {
    console.warn('[tonalCycles] unregisterTransportListener failed', err)
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

// compute pulses to next measure to support 'snapToMeasure'
// 16 pulses = 1 measure (16th notes); 4 pulses = 1 beat (quarter note)
function _pulsesToNextMeasure() {
  try {
    const audioStore = useAudioStore()
    const currentPulse = Number(audioStore.currentPulse?.value || audioStore.currentPulse || 0)
    const pulsesPerMeasure = 16
    const nextMeasurePulse = (Math.floor(currentPulse / pulsesPerMeasure) + 1) * pulsesPerMeasure
    const diffPulses = Math.max(0, nextMeasurePulse - currentPulse)
    return diffPulses
  } catch (err) {
    console.warn('[tonalCycles] _pulsesToNextMeasure failed, defaulting to 0', err)
    return 0
  }
}

function _getTempoFromStore() {
  try {
    const audioStore = useAudioStore()
    if (!audioStore) return 120
    // Handle both the case where tempo is a ref (tempo.value) or a plain number
    if (audioStore.tempo && typeof audioStore.tempo.value === 'number') return audioStore.tempo.value
    if (typeof audioStore.tempo === 'number') return audioStore.tempo
    return 120
  } catch (err) {
    return 120
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
    // If scaleLocked is active, cycles should not alter the global scale
    const isScaleLocked = Boolean(audioStore && audioStore.scaleLocked && (audioStore.scaleLocked.value !== undefined ? audioStore.scaleLocked.value : audioStore.scaleLocked))
    if (isScaleLocked) {
      console.log(`${new Date().toISOString()} [tonalCycles] step: scaleLocked, skipping global update`)
      return
    }

    if (strategy === 'rotateMode') {
      const current = audioStore.currentScale || 'major'
      const next = _rotateModeName(current)
      audioStore.updateScale(next)
    } else if (strategy === 'shiftKey') {
      // shift global root by semitone across active loops
      const loops = audioStore.loopManager?.loops?.value || []
      loops.forEach(loop => {
        if (!loop || !loop.isActive) return
        const id = loop.id
        try {
          notesMatrix.transposeLoop(id, 1)
          const meta = notesMatrix.loopMetadata[id] || {}
          const scaleName = meta.scale || audioStore.currentScale
          notesMatrix.quantizeLoop(id, scaleName)
          notesMatrix.generateLoopNotes(id, { silent: true })
        } catch (err) {
          // fallback: update metadata baseNote and quantize
          try { notesMatrix.updateLoopMetadata(id, { baseNote: (notesMatrix.loopMetadata[id]?.baseNote || 60) + 1 }) } catch (e) { }
        }
      })
    }
  } else if (scope === 'group') {
    const groupId = config.groupId
    if (!groupId) return
    const members = notesMatrix.getGroupMembers(groupId)
    if (strategy === 'shiftKey') {
      // Shift each member by semitone and quantize
      members.forEach(id => {
        notesMatrix.transposeLoop(id, 1)
        const meta = notesMatrix.loopMetadata[id] || {}
        const scaleName = meta.scale || audioStore.currentScale
        notesMatrix.quantizeLoop(id, scaleName)
        notesMatrix.generateLoopNotes(id, { silent: true })
      })
    }
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
    if (strategy === 'rotateMode') {
      notesMatrix.quantizeLoop(loopId, next)
      notesMatrix.generateLoopNotes(loopId, { silent: true })
    } else if (strategy === 'shiftKey') {
      // shift the loop root by one semitone and re-quantize
      notesMatrix.transposeLoop(loopId, 1)
      const scaleName = meta.scale || audioStore.currentScale
      notesMatrix.quantizeLoop(loopId, scaleName)
      notesMatrix.generateLoopNotes(loopId, { silent: true })
    }
  }
}

export function startCycle(cfg = {}) {
  // prevent duplicate cycles by default: only one active cycle per (scope,loopId,groupId,strategy)
  const allowMultiple = !!cfg.allowMultiple
  // pulses per beat basis: 4 pulses per beat (16 pulses per measure)

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
        newConfig.intervalPulses = Math.max(1, newConfig.intervalBeats * pulsesPerBeat)

        console.log(`${new Date().toISOString()} [tonalCycles] startCycle update config: id=${id} intervalBeats=${newConfig.intervalBeats} intervalPulses=${newConfig.intervalPulses} snapToMeasure=${newConfig.snapToMeasure}`)

        // apply new config
        c.config = newConfig

        // clear any existing timer or waitingTimeout; we are now pulse-driven
        c.waitingTimeout = null

        // If startImmediately explicitly false, leave timers stopped; else schedule
        const shouldStartImmediately = cfg.startImmediately !== false
        if (shouldStartImmediately && newConfig.snapToMeasure) {
          // schedule next pulse aligned to measure
          const pulsesToNext = _pulsesToNextMeasure()
          const audioStore = useAudioStore()
          const currentPulse = Number((audioStore.currentPulse?.value || audioStore.currentPulse || 0))
          c.nextPulse = currentPulse + pulsesToNext
          c.waitingTimeout = true
        } else if (shouldStartImmediately) {
          const audioStore = useAudioStore()
          const currentPulse = Number((audioStore.currentPulse?.value || audioStore.currentPulse || 0))
          c.nextPulse = currentPulse + newConfig.intervalPulses
          c.waitingTimeout = null
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
    intervalPulses: Math.max(1, (cfg.intervalBeats || 4) * pulsesPerBeat), // default: 4 beats -> 16 pulses
    strategy: cfg.strategy || 'rotateMode',
    loopId: cfg.loopId,
    groupId: cfg.groupId
  }
  config.snapToMeasure = !!cfg.snapToMeasure
  const step = () => _stepCycleImpl(cycles.get(cycleId))
  let timer = null
  let paused = false
  // use pulse-based scheduling via transport listener
  const audioStore = useAudioStore()
  _registerTransportListenerIfNeeded()
  if (cfg.startImmediately !== false) {
    const currentPulse = Number((audioStore.currentPulse?.value || audioStore.currentPulse || 0))
    if (cfg.snapToMeasure) {
      const pulsesToNext = _pulsesToNextMeasure()
      cycles.set(cycleId, { config, timer: null, waitingTimeout: true, paused: false, lastStepTime: null, nextPulse: currentPulse + pulsesToNext })
      console.log(`${new Date().toISOString()} [tonalCycles] startCycle id=${cycleId} scope=${config.scope} strategy=${config.strategy} snapToMeasure intervalBeats=${config.intervalBeats} intervalPulses=${config.intervalPulses} waitingPulses=${pulsesToNext}`)
    } else {
      cycles.set(cycleId, { config, timer: null, waitingTimeout: null, paused: false, lastStepTime: null, nextPulse: currentPulse + config.intervalPulses })
      console.log(`${new Date().toISOString()} [tonalCycles] startCycle id=${cycleId} scope=${config.scope} strategy=${config.strategy} intervalBeats=${config.intervalBeats} intervalPulses=${config.intervalPulses}`)
    }
    paused = false
  } else {
    cycles.set(cycleId, { config, timer: null, waitingTimeout: null, paused: true, lastStepTime: null, nextPulse: null })
  }
  _emitChange()
  return { id: cycleId, stop: () => stopCycle(cycleId), step: () => _stepCycleImpl(cycles.get(cycleId)), pause: () => pauseCycle(cycleId), resume: () => resumeCycle(cycleId) }
}

// Recompute intervals for all active cycles according to the new tempo
export function updateCyclesForTempo(newTempo) {
  try {
    // With pulse-based scheduling, tempo changes don't affect interval in beats
    for (const [id, c] of cycles.entries()) {
      const cfg = c.config || {}
      c.config.intervalPulses = Math.max(1, (cfg.intervalBeats || 4) * pulsesPerBeat)
      // If cycle has a nextPulse scheduled, we keep it; otherwise compute from current pulse
      if (!c.nextPulse) {
        const audioStore = useAudioStore()
        const currentPulse = Number((audioStore.currentPulse?.value || audioStore.currentPulse || 0))
        c.nextPulse = currentPulse + c.config.intervalPulses
      }
      cycles.set(id, c)
    }
    _emitChange()
    return true
  } catch (err) {
    console.warn('[tonalCycles] updateCyclesForTempo failed', err)
    return false
  }
}

export function stopCycle(cycleId) {
  const cycle = cycles.get(cycleId)
  if (!cycle) return false
  // Clear any scheduled fields and remove cycle
  cycles.delete(cycleId)
  // If no cycles remain, unregister transport listener
  if (cycles.size === 0) _unregisterTransportListener()
  _emitChange()
  return true
}

export function pauseCycle(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return false
  c.paused = true
  cycles.set(cycleId, c)
  console.log(`${new Date().toISOString()} [tonalCycles] pauseCycle id=${cycleId}`)
  _emitChange()
  return true
}

export function resumeCycle(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return false
  // Recompute the nextPulse from the current transport pulse depending on snapToMeasure
  const shouldSnap = !!c.config.snapToMeasure
  const audioStore = useAudioStore()
  const currentPulse = Number((audioStore.currentPulse?.value || audioStore.currentPulse || 0))
  if (shouldSnap) {
    const pulsesToNext = _pulsesToNextMeasure()
    c.nextPulse = currentPulse + pulsesToNext
    // indicate that we are waiting for a snap-to-measure start
    c.waitingTimeout = true
  } else {
    const intervalPulses = c.config.intervalPulses || (c.config.intervalBeats || 4) * pulsesPerBeat
    c.nextPulse = currentPulse + intervalPulses
  }
  c.paused = false
  cycles.set(cycleId, c)
  console.log(`${new Date().toISOString()} [tonalCycles] resumeCycle id=${cycleId} intervalBeats=${c.config.intervalBeats} intervalPulses=${c.config.intervalPulses}`)
  _emitChange()
  return true
}

export function getCycleInfo(cycleId) {
  const c = cycles.get(cycleId)
  if (!c) return null
  return { id: cycleId, config: c.config, paused: !!c.paused, waiting: !!c.waitingTimeout, lastStepTime: c.lastStepTime || null, nextPulse: c.nextPulse || null }
}

export function stepCycle(cycleId) {
  const cycle = cycles.get(cycleId)
  if (!cycle) return false
  _stepCycleImpl(cycle)
  return true
}

export function listCycles() { return Array.from(cycles.keys()).map(id => getCycleInfo(id)) }

export default { startCycle, stopCycle, stepCycle, listCycles }
