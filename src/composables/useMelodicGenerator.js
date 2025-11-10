import { useScales } from './useMusic'
import { generateEuclideanPattern, generateArpeggioPattern, generateRandomPattern } from '../utils/patternGenerators'
import { analyzeActiveLoops, avoidConflicts } from '../services/counterpointService'

/**
 * Melodic Generation Coordinator
 * Main composable that orchestrates pattern generation with counterpoint awareness
 */
export function useMelodicGenerator(notesMatrix) {
  const { getScale } = useScales()

  const melLog = (...args) => console.log('[MelGen]', ...args)

  /**
   * Generate a melody for a specific loop using melodic generation
   * @param {number} loopId - The loop ID to generate for
   * @param {Object} options - Generation options
   * @returns {Array<number|null>} Generated melody notes
   */
  const generateLoopMelody = (loopId, options = {}) => {
    const startTime = performance.now()

    if (loopId >= notesMatrix.MAX_LOOPS || !notesMatrix.loopMetadata[loopId]) {
      melLog(`generateLoopMelody invalid loopId=${loopId}`)
      return []
    }

    const meta = notesMatrix.loopMetadata[loopId]

    // Get current scale
    const scaleName = notesMatrix.matrixState.currentScale || 'major'
    const scale = getScale(scaleName)

    // Select pattern type based on probabilities
    const patternType = selectPatternType(loopId)

    // Generate base pattern
    const patternOptions = {
      length: meta.length,
      scale,
      baseNote: meta.baseNote,
      noteRange: { min: meta.noteRangeMin, max: meta.noteRangeMax },
      density: meta.density,
      ...options
    }

    let notes
    switch (patternType) {
      case 'euclidean':
        notes = generateEuclideanPattern(patternOptions)
        break
      case 'arpeggio':
        notes = generateArpeggioPattern(patternOptions)
        break
      case 'random':
      default:
        notes = generateRandomPattern(patternOptions)
        break
    }

    // Apply counterpoint if there are active loops
    const activeLoops = getActiveLoops()
    if (activeLoops.length > 1) {
      notes = applyCounterpoint(loopId, notes, activeLoops)
    }

    // Update metadata
    meta.lastPattern = patternType
    meta.lastModified = Date.now()

    const elapsed = performance.now() - startTime
    melLog(`generateLoopMelody loop=${loopId} pattern=${patternType} length=${notes.length} time=${elapsed.toFixed(1)}ms`)

    return notes
  }

  /**
   * Regenerate melody for a specific loop using existing metadata
   * @param {number} loopId - The loop ID to regenerate
   */
  const regenerateLoop = (loopId) => {
    if (loopId >= notesMatrix.MAX_LOOPS || !notesMatrix.loopMetadata[loopId]) {
      melLog(`regenerateLoop invalid loopId=${loopId}`)
      return
    }

    const meta = notesMatrix.loopMetadata[loopId]

    // Skip if loop is locked
    if (meta.generationMode === 'locked') {
      melLog(`regenerateLoop loop=${loopId} skipped (locked)`)
      return
    }

    // Generate new melody
    const notes = generateLoopMelody(loopId)

    // Update the notes matrix
    for (let i = 0; i < notes.length && i < notesMatrix.MAX_STEPS; i++) {
      notesMatrix.notesMatrix[loopId][i] = notes[i]
    }

    melLog(`regenerateLoop loop=${loopId} completed`)
  }

  /**
   * Regenerate melodies for all unlocked loops
   */
  const regenerateAllLoops = () => {
    const startTime = performance.now()
    let regeneratedCount = 0

    for (let loopId = 0; loopId < notesMatrix.MAX_LOOPS; loopId++) {
      const meta = notesMatrix.loopMetadata[loopId]
      if (meta && meta.isActive && meta.generationMode !== 'locked') {
        regenerateLoop(loopId)
        regeneratedCount++
      }
    }

    const elapsed = performance.now() - startTime
    melLog(`regenerateAllLoops completed loops=${regeneratedCount} time=${elapsed.toFixed(1)}ms`)
  }

  /**
   * Select pattern type based on loop's probability weights
   * @param {number} loopId - The loop ID
   * @returns {string} Selected pattern type ('euclidean'|'arpeggio'|'random')
   */
  const selectPatternType = (loopId) => {
    const meta = notesMatrix.loopMetadata[loopId]
    const probs = meta.patternProbabilities

    // Normalize probabilities
    const total = probs.euclidean + probs.arpeggio + probs.random
    if (total === 0) {
      // Fallback to equal distribution
      const pattern = ['euclidean', 'arpeggio', 'random'][Math.floor(Math.random() * 3)]
      melLog(`selectPatternType loop=${loopId} probs={euclidean:0,arpeggio:0,random:0} -> ${pattern} (fallback)`)
      return pattern
    }

    // Weighted random selection
    const rand = Math.random() * total
    let cumulative = 0

    if ((cumulative += probs.euclidean) > rand) {
      melLog(`selectPatternType loop=${loopId} probs={euclidean:${probs.euclidean.toFixed(2)},arpeggio:${probs.arpeggio.toFixed(2)},random:${probs.random.toFixed(2)}} -> euclidean`)
      return 'euclidean'
    }
    if ((cumulative += probs.arpeggio) > rand) {
      melLog(`selectPatternType loop=${loopId} probs={euclidean:${probs.euclidean.toFixed(2)},arpeggio:${probs.arpeggio.toFixed(2)},random:${probs.random.toFixed(2)}} -> arpeggio`)
      return 'arpeggio'
    }

    melLog(`selectPatternType loop=${loopId} probs={euclidean:${probs.euclidean.toFixed(2)},arpeggio:${probs.arpeggio.toFixed(2)},random:${probs.random.toFixed(2)}} -> random`)
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
    const scaleName = notesMatrix.matrixState.currentScale || 'major'
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