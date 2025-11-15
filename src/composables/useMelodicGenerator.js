import { useScales } from './useMusic'
import { analyzeActiveLoops, avoidConflicts, isCounterpointEnabled } from '../services/counterpointService'
import { useAudioStore } from '../stores/audioStore'

/**
 * Melodic Generation Coordinator
 * Main composable that orchestrates pattern generation with counterpoint awareness
 */
export function useMelodicGenerator(notesMatrix) {
  const { getScale } = useScales()
  const audioStore = useAudioStore()

  const melLog = (...args) => {
    if (typeof window !== 'undefined' && window.__LOOP_DEBUG) {
      console.log('[MelGen]', ...args)
    }
  }

  /**
   * Generate a melody for a specific loop using melodic generation
   * @param {number} loopId - The loop ID to generate for
   * @param {Object} options - Generation options
   * @returns {Array<number|null>} Generated melody notes
   */
  const buildPatternOptions = (loopId, meta, options = {}) => {
    const so = (() => {
      const p = audioStore.currentPulse && typeof audioStore.currentPulse.value === 'number' ? audioStore.currentPulse.value : 0
      const len = typeof meta.length === 'number' ? meta.length : 0
      return len > 0 ? (p % len) : 0
    })()
    return {
      length: meta.length,
      scale: getScale(audioStore.currentScale),
      baseNote: meta.baseNote,
      noteRange: { min: meta.noteRangeMin, max: meta.noteRangeMax },
      density: typeof notesMatrix.getEffectiveDensity === 'function' ? notesMatrix.getEffectiveDensity(loopId) : (typeof meta.density === 'number' ? meta.density : 0.3),
      densityTiming: meta.densityTiming ?? 'random',
      positionMapping: meta.positionMapping ?? 'sequential',
      startOffset: (meta.startOffset ?? so),
      ...options
    }
  }

  const generateBasePattern = (patternType, patternOptions) => {
    switch (patternType) {
      case 'euclidean':
        return euclidFromOptions(patternOptions)
      case 'scale':
        return scaleFromOptions(patternOptions)
      case 'random':
      default:
        return randomFromOptions(patternOptions)
    }
  }

  const generateLoopMelody = (loopId, options = {}) => {
    const startTime = performance.now()

    if (loopId >= notesMatrix.MAX_LOOPS || !notesMatrix.loopMetadata[loopId]) {
      melLog(`generateLoopMelody invalid loopId=${loopId}`)
      return []
    }

    const meta = notesMatrix.loopMetadata[loopId]

    // Get current scale from audioStore (single source of truth)
    const scaleName = audioStore.currentScale
    if (!scaleName) {
      console.error('No current scale set in audioStore.currentScale')
      throw new Error('Current scale is undefined')
    }
    const scale = getScale(scaleName)
    const patternType = selectPatternType(loopId)
    const patternOptions = buildPatternOptions(loopId, meta, options)
    console.log('[MelGen] selected pattern', { loopId, patternType, density: Number(patternOptions.density).toFixed(3) })
    melLog('options', {
      loopId,
      patternType,
      baseNote: patternOptions.baseNote,
      length: patternOptions.length,
      range: { min: meta.noteRangeMin, max: meta.noteRangeMax },
      density: patternOptions.density
    })
    const notes = generateBasePattern(patternType, {
      ...patternOptions,
      loopId,
      log: (info) => {
        melLog('scaleGen', info)
      }
    })

    // Apply counterpoint only if enabled and there are active loops
    const activeLoops = getActiveLoops()
    if (activeLoops.length > 1 && isCounterpointEnabled()) {
      notes = applyCounterpoint(loopId, notes, activeLoops)
    }

    // Update metadata via notesMatrix to avoid readonly mutation warnings
    if (typeof notesMatrix.updateLoopMetadata === 'function') {
      notesMatrix.updateLoopMetadata(loopId, { lastPattern: patternType, lastModified: Date.now() })
    }

    const elapsed = performance.now() - startTime
    const minRange = typeof meta.noteRangeMin === 'number' ? meta.noteRangeMin : 24
    const maxRange = typeof meta.noteRangeMax === 'number' ? meta.noteRangeMax : 96
    const outOfRange = notes.filter(n => typeof n === 'number' && (n < minRange || n > maxRange)).length
    melLog(`generateLoopMelody loop=${loopId} pattern=${patternType} length=${notes.length} oob=${outOfRange} time=${elapsed.toFixed(1)}ms`)
    console.log('[MelGen] output', { loopId, patternType, length: notes.length, timeMs: Number(elapsed.toFixed(1)) })

    return notes
  }

  /**
   * Regenerate melody for a specific loop using existing metadata
   * @param {number} loopId - The loop ID to regenerate
   * @param {number} currentPulse - Current global pulse for step reset (optional)
   */
  const regenerateLoop = (loopId, currentPulse = null) => {
    if (loopId >= notesMatrix.MAX_LOOPS || !notesMatrix.loopMetadata[loopId]) {
      melLog(`regenerateLoop invalid loopId=${loopId}`)
      return
    }

    const meta = notesMatrix.loopMetadata[loopId]

    // Generate new melody
    const notes = generateLoopMelody(loopId)

    // Update the notes matrix
    // Use the composable setter so reactivity triggers correctly
    if (notesMatrix.setLoopNotes) {
      notesMatrix.setLoopNotes(loopId, notes)
    } else {
      for (let i = 0; i < notes.length && i < notesMatrix.MAX_STEPS; i++) {
        notesMatrix.notesMatrix[loopId][i] = notes[i]
      }
      // If the composable doesn't expose setLoopNotes, attempt to trigger reactivity
      if (typeof notesMatrix.triggerReactivityDebounced === 'function') {
        notesMatrix.triggerReactivityDebounced()
      }
    }

    // Reset step counter if currentPulse is provided
    if (currentPulse !== null && notesMatrix.updateLoopMetadata) {
      notesMatrix.updateLoopMetadata(loopId, {
        lastResetPulse: currentPulse,
        currentStep: 0
      })
    }

    melLog(`regenerateLoop loop=${loopId} completed`)
  }

  /**
   * Regenerate melodies for all active loops
   * @param {number} currentPulse - Current global pulse for step reset (optional)
   */
  const regenerateAllLoops = (currentPulse = null) => {
    const startTime = performance.now()
    let regeneratedCount = 0

    for (let loopId = 0; loopId < notesMatrix.MAX_LOOPS; loopId++) {
      const meta = notesMatrix.loopMetadata[loopId]
      if (meta && meta.isActive) {
        regenerateLoop(loopId, currentPulse)
        regeneratedCount++
      }
    }

    const elapsed = performance.now() - startTime
    melLog(`regenerateAllLoops completed loops=${regeneratedCount} time=${elapsed.toFixed(1)}ms`)
  }

  /**
   * Select pattern type based on loop's probability weights
   * @param {number} loopId - The loop ID
   * @returns {string} Selected pattern type ('euclidean'|'scale'|'random')
   */
  const selectPatternType = (loopId) => {
    const meta = notesMatrix.loopMetadata[loopId]
    if (!meta) {
      // Fallback if metadata is missing
      const pattern = ['euclidean', 'scale', 'random'][Math.floor(Math.random() * 3)]
      melLog(`selectPatternType loop=${loopId} missing metadata -> ${pattern} (fallback)`)
      return pattern
    }

    // Ensure patternProbabilities exists
    if (!meta.patternProbabilities) {
      notesMatrix.updateLoopMetadata(loopId, {
        patternProbabilities: { euclidean: 0.3, scale: 0.3, random: 0.4 },
        generationMode: 'auto',
        lastPattern: null,
        noteRangeMin: 24,
        noteRangeMax: 96
      })
      melLog(`selectPatternType loop=${loopId} initialized missing patternProbabilities`)
    }

    const normalize = (raw) => ({
      euclidean: Number((raw && raw.euclidean) || 0),
      scale: Number((raw && raw.scale) || 0),
      random: Number((raw && raw.random) || 0)
    })
    const { euclidean: eu, scale: sc, random: rnd } = normalize(meta.patternProbabilities)

    // Normalize probabilities
    const total = eu + sc + rnd
    if (total === 0) {
      // Fallback to equal distribution
      const pattern = ['euclidean', 'scale', 'random'][Math.floor(Math.random() * 3)]
      melLog(`selectPatternType loop=${loopId} probs={euclidean:0,scale:0,random:0} -> ${pattern} (fallback)`)
      return pattern
    }

    // Weighted random selection
    const rand = Math.random() * total
    let cumulative = 0

    if ((cumulative += eu) > rand) {
      melLog(`selectPatternType loop=${loopId} probs={euclidean:${eu},scale:${sc},random:${rnd}} -> euclidean`)
      return 'euclidean'
    }
    if ((cumulative += sc) > rand) {
      melLog(`selectPatternType loop=${loopId} probs={euclidean:${eu},scale:${sc},random:${rnd}} -> scale`)
      return 'scale'
    }

    melLog(`selectPatternType loop=${loopId} probs={euclidean:${eu},scale:${sc},random:${rnd}} -> random`)
    return 'random'
  }

  /**
   * Apply counterpoint logic to avoid note conflicts
   * @param {number} loopId - The loop ID being processed
   * @param {Array<number|null>} notes - Generated notes for this loop
   * @param {Array} activeLoops - Array of active loop objects
   * @returns {Array<number|null>} Notes with counterpoint applied
   */
  const applyCounterpoint = (loopId, notes, activeLoops) => {
    const adjustedNotes = [...notes]

    // Early exit when counterpoint is disabled
    if (!isCounterpointEnabled()) {
      return adjustedNotes
    }

    // Get other active loops (excluding this one)
    const otherLoops = activeLoops.filter(loop => loop.id !== loopId)
    if (otherLoops.length === 0) return adjustedNotes

    // Convert loop objects to note arrays for counterpoint analysis
    const otherLoopNotes = otherLoops.map(loop => {
      const loopId = loop.id
      const loopNotes = []
      for (let i = 0; i < notesMatrix.MAX_STEPS; i++) {
        loopNotes.push(notesMatrix.notesMatrix[loopId][i])
      }
      return loopNotes
    })

    // Get scale for conflict resolution
    const scaleName = audioStore.currentScale
    if (!scaleName) {
      console.error('No current scale set in audioStore.currentScale for counterpoint')
      throw new Error('Current scale is undefined for counterpoint')
    }
    const scale = getScale(scaleName)
    const meta = notesMatrix.loopMetadata[loopId]

    // Apply counterpoint to each step
    for (let step = 0; step < adjustedNotes.length; step++) {
      const note = adjustedNotes[step]
      if (note === null) continue

      // Analyze occupied notes at this step
      const occupiedNotes = analyzeActiveLoops(otherLoopNotes, step)

      // Avoid conflicts if necessary
      if (occupiedNotes.has(note)) {
        const adjustedNote = avoidConflicts(note, occupiedNotes, scale, {
          baseNote: meta.baseNote,
          noteRange: { min: meta.noteRangeMin, max: meta.noteRangeMax }
        })
        adjustedNotes[step] = adjustedNote
      }
    }

    melLog(`applyCounterpoint loop=${loopId} adjustments=${adjustedNotes.filter((note, i) => note !== notes[i]).length}`)
    return adjustedNotes
  }

  /**
   * Get array of currently active loops
   * @returns {Array} Array of active loop objects
   */
  const getActiveLoops = () => {
    // This would need access to the audioStore loops
    // For now, we'll use the metadata to determine active loops
    const activeLoops = []
    for (let i = 0; i < notesMatrix.MAX_LOOPS; i++) {
      const meta = notesMatrix.loopMetadata[i]
      if (meta && meta.isActive) {
        activeLoops.push({ id: i, ...meta })
      }
    }
    return activeLoops
  }

  return {
    generateLoopMelody,
    regenerateLoop,
    regenerateAllLoops,
    selectPatternType,
    applyCounterpoint,
    getActiveLoops
  }
}

function generatePossibleNotes(scale, baseNote, noteRange) {
  const possibleNotes = []
  const minOctave = Math.floor((noteRange.min - baseNote) / 12)
  const maxOctave = Math.floor((noteRange.max - baseNote) / 12)
  for (let oct = minOctave; oct <= maxOctave; oct++) {
    for (const interval of scale) {
      const note = baseNote + interval + (oct * 12)
      if (note >= noteRange.min && note <= noteRange.max) {
        possibleNotes.push(note)
      }
    }
  }
  return possibleNotes
}

function euclideanRhythm(pulses, steps) {
  if (pulses <= 0) return []
  if (pulses >= steps) {
    return Array.from({ length: steps }, (_, i) => i)
  }
  const positions = []
  for (let i = 0; i < steps; i++) {
    if ((i * pulses) % steps < pulses) {
      positions.push(i)
    }
  }
  return positions
}

function computePositions({ length, density, mode = 'euclidean', startOffset = 0, allowZero = false }) {
  const positions = []
  const d = Math.max(0, Math.min(1, typeof density === 'number' && !isNaN(density) ? density : 0))
  if (mode === 'fillAll') {
    let pos = startOffset % length
    let dir = 1
    const min = 0
    const max = length - 1
    for (let i = 0; i < length; i++) {
      positions.push(pos)
      let next = pos + dir
      if (next > max || next < min) {
        dir = -dir
        next = pos + dir
        if (next > max) next = max
        if (next < min) next = min
      }
      pos = next
    }
    return positions
  }
  let count = Math.round(length * d)
  if (!allowZero) count = Math.max(1, count)
  if (count <= 0) return []
  if (mode === 'even') {
    for (let i = 0; i < count; i++) {
      positions.push(Math.floor((i * length) / count))
    }
    return positions.map(p => (p + startOffset) % length)
  }
  if (mode === 'random') {
    const set = new Set()
    while (set.size < count) set.add(Math.floor(Math.random() * length))
    return Array.from(set).map(p => (p + startOffset) % length)
  }
  const raw = euclideanRhythm(count, length)
  return raw.map(p => (p + startOffset) % length)
}

function euclidFromOptions({ length, scale, baseNote, noteRange, density, timing = 'euclidean', startOffset = 0 }) {
  const positions = computePositions({ length, density, mode: timing, startOffset, allowZero: true })
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  possibleNotes.sort((a, b) => a - b)
  const pattern = new Array(length).fill(null)
  if (possibleNotes.length > 0 && positions.length > 0) {
    let currentIndex = Math.floor(Math.random() * possibleNotes.length)
    positions.forEach(pos => {
      pattern[pos] = possibleNotes[currentIndex]
      currentIndex = (currentIndex + Math.floor(Math.random() * 3) + 1) % possibleNotes.length
    })
  }
  return pattern
}

function scaleFromOptions({ length, scale, baseNote, noteRange, density, densityTiming = 'even', startOffset = 0 }) {
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    return new Array(length).fill(null)
  }
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const positions = computePositions({ length, density, mode: densityTiming, startOffset, allowZero: true })
  const placements = positions.length
  if (placements === 0) return new Array(length).fill(null)
  const pattern = new Array(length).fill(null)
  const notesToPlace = []
  if (placements <= sortedNotes.length) {
    for (let i = 0; i < placements; i++) {
      const index = Math.floor(i * sortedNotes.length / Math.max(1, placements))
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    for (let i = 0; i < placements; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = notesToPlace[i]
  }
  return pattern
}

function randomFromOptions({ length, scale, baseNote, noteRange, density, timing = 'random', startOffset = 0 }) {
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    return new Array(length).fill(null)
  }
  const positions = computePositions({ length, density, mode: timing, startOffset, allowZero: true })
  const noteCount = positions.length
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const notesToPlace = []
  if (noteCount <= sortedNotes.length) {
    for (let i = 0; i < noteCount; i++) {
      const index = Math.floor(i * sortedNotes.length / Math.max(1, noteCount))
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    for (let i = 0; i < noteCount; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }
  const pattern = new Array(length).fill(null)
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = notesToPlace[i]
  }
  return pattern
}
