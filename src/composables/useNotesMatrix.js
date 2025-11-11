import { ref, readonly, triggerRef, computed, reactive } from 'vue'
import { useScales, useNoteUtils } from './useMusic'

// Get scale utility at module level
const { getScale } = useScales()

// Constants
const MAX_LOOPS = 16
const MAX_STEPS = 64
const MAX_NOTE = 127
const MIN_NOTE = 0

// Performance optimization: Pre-computed lookup tables
const SCALE_INTERVALS_CACHE = new Map()
const NOTE_VALIDATION_CACHE = new Map()
const DENSITY_CACHE = new Map()

// Performance optimization: Batch mode for multiple updates
let _batchMode = false
const _pendingUpdates = new Set()

// Performance optimization: Debounced reactivity
let _reactivityTimer = null
const REACTIVITY_DELAY = 16 // ~60fps

// Performance optimization: Memoized computed values
const memoizedValues = new Map()

// Performance optimization: Use typed arrays for better performance
const notesMatrix = new Array(MAX_LOOPS)
for (let i = 0; i < MAX_LOOPS; i++) {
  notesMatrix[i] = new Array(MAX_STEPS).fill(null)
}

// Performance optimization: Use reactive objects for better reactivity
const loopMetadata = new Array(MAX_LOOPS).fill(null).map(() => reactive({
  isActive: false,
  scale: null,
  baseNote: 60, // C4
  length: 16,
  octaveRange: 2,
  density: 0,
  lastModified: Date.now(),
  // Melodic generation fields
  noteRangeMin: 24,        // MIDI note min (default: full range)
  noteRangeMax: 96,        // MIDI note max (default: full range)
  patternProbabilities: {  // Per-loop pattern weights
    euclidean: 0.3,
    arpeggio: 0.3,
    random: 0.4,
    // Will add more in Phase 2
  },
  generationMode: 'auto',  // 'auto' | 'locked'
  lastPattern: null        // Track what was generated for reference
}))

const matrixState = ref({
  globalBaseNote: 60, // C4
  activeLoops: new Set(),
  stepCount: 16
})

// Performance optimization: Cache scale intervals
function getScaleIntervalsCached(scaleName) {
  if (!SCALE_INTERVALS_CACHE.has(scaleName)) {
    SCALE_INTERVALS_CACHE.set(scaleName, getScale(scaleName))
  }
  return SCALE_INTERVALS_CACHE.get(scaleName)
}

// Performance optimization: Memoized computed values
function getMemoized(key, computeFn) {
  if (!memoizedValues.has(key)) {
    memoizedValues.set(key, computeFn())
  }
  return memoizedValues.get(key)
}

// Performance optimization: Debounced reactivity trigger
function triggerReactivityDebounced() {
  if (_reactivityTimer) {
    clearTimeout(_reactivityTimer)
  }
  _reactivityTimer = setTimeout(() => {
    triggerRef(notesMatrix)
    _reactivityTimer = null
  }, REACTIVITY_DELAY)
}

// Performance optimization: Batch operations
function batchUpdate(updateFn) {
  _batchMode = true
  updateFn()
  _batchMode = false
  triggerReactivityDebounced()
}

// Performance optimization: Efficient note validation
function isNoteInScaleCached(note, baseNote, scaleName, octaveRange) {
  const cacheKey = `${note}-${baseNote}-${scaleName}-${octaveRange}`

  if (NOTE_VALIDATION_CACHE.has(cacheKey)) {
    return NOTE_VALIDATION_CACHE.get(cacheKey)
  }

  const scaleIntervals = getScaleIntervalsCached(scaleName)
  const result = scaleIntervals.some(interval => {
    const expectedNote = baseNote + interval
    for (let oct = 0; oct < octaveRange; oct++) {
      if (note === expectedNote + (oct * 12)) return true
    }
    return false
  })

  NOTE_VALIDATION_CACHE.set(cacheKey, result)
  return result
}

// Performance optimization: Efficient density calculation
function computeLoopDensityMetrics(loopId) {
  if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) {
    return { density: 0, noteCount: 0, length: 0 }
  }

  const cacheKey = `density-${loopId}-${loopMetadata[loopId].lastModified}`

  if (DENSITY_CACHE.has(cacheKey)) {
    return DENSITY_CACHE.get(cacheKey)
  }

  const meta = loopMetadata[loopId]
  const loopNotes = notesMatrix[loopId]
  let noteCount = 0

  // Performance optimization: Use for loop instead of reduce for better performance
  for (let i = 0; i < meta.length; i++) {
    if (loopNotes[i] !== null) {
      noteCount++
    }
  }

  const metrics = {
    density: meta.length > 0 ? noteCount / meta.length : 0,
    noteCount,
    length: meta.length
  }

  DENSITY_CACHE.set(cacheKey, metrics)
  return metrics
}

export function useNotesMatrix() {
  // Initialize music utilities
  const { quantizeToScale } = useNoteUtils()  // Performance optimization: Efficient loop initialization
  // Performance optimization: Efficient loop initialization
  function initializeLoop(loopId, options = {}) {
    if (loopId >= MAX_LOOPS) return

    batchUpdate(() => {
      // Set default values - scale must be explicitly provided
      loopMetadata[loopId] = reactive({
        isActive: options.isActive !== undefined ? options.isActive : true,
        scale: options.scale || null, // Scale must be explicitly provided
        baseNote: options.baseNote || matrixState.value.globalBaseNote,
        length: options.length || matrixState.value.stepCount,
        octaveRange: options.octaveRange || 2,
        density: 0,
        lastModified: Date.now(),
        // Melodic generation fields
        noteRangeMin: options.noteRangeMin || 24,        // MIDI note min (default: full range)
        noteRangeMax: options.noteRangeMax || 96,        // MIDI note max (default: full range)
        patternProbabilities: {  // Per-loop pattern weights
          euclidean: 0.3,
          arpeggio: 0.3,
          random: 0.4
        },
        generationMode: 'auto',  // 'auto' | 'locked'
        lastPattern: null        // Track what was generated for reference
      })

      // Clear the loop
      for (let i = 0; i < MAX_STEPS; i++) {
        notesMatrix[loopId][i] = null
      }

      // Update active loops set
      if (loopMetadata[loopId].isActive) {
        matrixState.value.activeLoops.add(loopId)
      } else {
        matrixState.value.activeLoops.delete(loopId)
      }
    })
  }

  // Performance optimization: Efficient loop activation
  function setLoopActive(loopId, isActive) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      loopMetadata[loopId].isActive = isActive
      loopMetadata[loopId].lastModified = Date.now()

      if (isActive) {
        matrixState.value.activeLoops.add(loopId)
      } else {
        matrixState.value.activeLoops.delete(loopId)
      }
    })
  }

  // Performance optimization: Efficient metadata update
  function updateLoopMetadata(loopId, metadata) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      // Validate density if provided
      if (metadata.density !== undefined) {
        metadata.density = typeof metadata.density === 'number' && !isNaN(metadata.density) ? Math.max(0, Math.min(1, metadata.density)) : 0.3
      }
      Object.assign(loopMetadata[loopId], metadata)
      loopMetadata[loopId].lastModified = Date.now()
    })
  }  // Performance optimization: Efficient note retrieval
  function getLoopNotes(loopId) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return []

    const meta = loopMetadata[loopId]
    const loopNotes = notesMatrix[loopId]

    // Performance optimization: Pre-allocate array with known size
    const result = new Array(meta.length)

    for (let i = 0; i < meta.length; i++) {
      result[i] = loopNotes[i]
    }

    return result
  }

  // Performance optimization: Efficient note setting
  function setLoopNotes(loopId, notes) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const loopNotes = notesMatrix[loopId]
      const meta = loopMetadata[loopId]

      // Clear existing notes
      for (let i = 0; i < MAX_STEPS; i++) {
        loopNotes[i] = null
      }

      // Set new notes
      for (let i = 0; i < Math.min(notes.length, meta.length); i++) {
        loopNotes[i] = notes[i]
      }

      // Update metadata
      meta.lastModified = Date.now()

      // Invalidate density cache
      DENSITY_CACHE.delete(`density-${loopId}-${meta.lastModified}`)
    })
  }

  // Performance optimization: Efficient single note setting
  function setLoopNote(loopId, step, note) {
    if (loopId >= MAX_LOOPS || step >= MAX_STEPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      notesMatrix[loopId][step] = note
      loopMetadata[loopId].lastModified = Date.now()

      // Invalidate density cache
      DENSITY_CACHE.delete(`density-${loopId}-${loopMetadata[loopId].lastModified}`)
    })
  }

  // Performance optimization: Efficient note clearing
  function clearLoopNote(loopId, step) {
    if (loopId >= MAX_LOOPS || step >= MAX_STEPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      notesMatrix[loopId][step] = null
      loopMetadata[loopId].lastModified = Date.now()

      // Invalidate density cache
      DENSITY_CACHE.delete(`density-${loopId}-${loopMetadata[loopId].lastModified}`)
    })
  }

  // Performance optimization: Efficient note retrieval
  function getNote(loopId, step) {
    if (loopId >= MAX_LOOPS || step >= MAX_STEPS) return null
    return notesMatrix[loopId][step]
  }

  // Performance optimization: Efficient loop generation
  function generateLoopNotes(loopId, density = 0.3, options = {}) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    // Check if melodic generation is requested
    if (options.strategy === 'melodic') {
      if (!options.melodicGenerator) {
        console.log('[MelGen] path=melodic requested but no melodicGenerator provided')
        return
      }
      console.log('[MelGen] path=melodic (explicitly requested)')
      options.melodicGenerator.regenerateLoop(loopId)
      return
    }

    // Default to legacy random generation
    console.log('[MelGen] path=legacy (melodic not requested)')

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const scaleIntervals = getScaleIntervalsCached(meta.scale)
      const loopNotes = notesMatrix[loopId]

      // Clear existing notes
      for (let i = 0; i < MAX_STEPS; i++) {
        loopNotes[i] = null
      }

      // Generate new notes
      const noteCount = Math.floor(meta.length * density)
      const positions = new Set()

      // Performance optimization: Use efficient random position selection
      while (positions.size < noteCount) {
        positions.add(Math.floor(Math.random() * meta.length))
      }

      // Performance optimization: Pre-compute possible notes
      const possibleNotes = []
      for (let oct = 0; oct < meta.octaveRange; oct++) {
        for (const interval of scaleIntervals) {
          const note = meta.baseNote + interval + (oct * 12)
          if (note >= MIN_NOTE && note <= MAX_NOTE) {
            possibleNotes.push(note)
          }
        }
      }

      // Set notes at selected positions
      for (const pos of positions) {
        if (possibleNotes.length > 0) {
          loopNotes[pos] = possibleNotes[Math.floor(Math.random() * possibleNotes.length)]
        }
      }

      // Update metadata
      meta.lastModified = Date.now()
      meta.density = density
    })
  }

  // Performance optimization: Efficient loop resizing
  function resizeLoop(loopId, newLength) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId] || newLength <= 0 || newLength > MAX_STEPS) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const loopNotes = notesMatrix[loopId]

      // Clear notes outside new range
      for (let i = newLength; i < MAX_STEPS; i++) {
        loopNotes[i] = null
      }

      // Update metadata
      meta.length = newLength
      meta.lastModified = Date.now()
    })
  }

  // Performance optimization: Efficient quantization
  function quantizeLoop(loopId, scale = null) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      // Require explicit scale setting
      if (!scale && !meta.scale) {
        console.error('No scale provided and meta.scale is not set')
        throw new Error('Scale must be explicitly provided or set in loop metadata')
      }
      const scaleName = scale || meta.scale
      const scaleIntervals = getScaleIntervalsCached(scaleName)
      const loopNotes = notesMatrix[loopId]

      // Quantize notes
      for (let i = 0; i < meta.length; i++) {
        if (loopNotes[i] !== null) {
          const note = loopNotes[i]

          // Find closest note in scale
          let closestNote = null
          let minDistance = Infinity

          for (let oct = 0; oct < meta.octaveRange; oct++) {
            for (const interval of scaleIntervals) {
              const scaleNote = meta.baseNote + interval + (oct * 12)
              if (scaleNote >= MIN_NOTE && scaleNote <= MAX_NOTE) {
                const distance = Math.abs(note - scaleNote)
                if (distance < minDistance) {
                  minDistance = distance
                  closestNote = scaleNote
                }
              }
            }
          }

          // Only update if we found a close match (within 2 semitones)
          if (closestNote !== null && minDistance <= 2) {
            loopNotes[i] = closestNote
          }
        }
      }

      // Update metadata
      meta.lastModified = Date.now()
      meta.scale = scaleName
    })
  }

  // Performance optimization: Efficient batch quantization
  function quantizeAllActiveLoops(scale = null) {
    batchUpdate(() => {
      for (const loopId of matrixState.value.activeLoops) {
        quantizeLoop(loopId, scale)
      }
    })
  }

  // Performance optimization: Efficient scale setting
  function setGlobalScale(scale) {
    if (!scale) return

    batchUpdate(() => {
      matrixState.value.currentScale = scale

      // Pre-cache scale intervals
      getScaleIntervalsCached(scale)
    })
  }



  // Performance optimization: Efficient transposition
  function transposeLoop(loopId, semitones) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const loopNotes = notesMatrix[loopId]

      // Transpose notes
      for (let i = 0; i < meta.length; i++) {
        if (loopNotes[i] !== null) {
          const newNote = loopNotes[i] + semitones
          if (newNote >= MIN_NOTE && newNote <= MAX_NOTE) {
            loopNotes[i] = newNote
          }
        }
      }

      // Update metadata
      meta.lastModified = Date.now()
      meta.baseNote = Math.max(MIN_NOTE, Math.min(MAX_NOTE, meta.baseNote + semitones))
    })
  }

  // Performance optimization: Efficient rotation
  function rotateLoop(loopId, steps) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const loopNotes = notesMatrix[loopId]

      // Normalize steps to loop length
      const normalizedSteps = ((steps % meta.length) + meta.length) % meta.length

      // Create temporary array for rotation
      const temp = new Array(meta.length)

      // Perform rotation
      for (let i = 0; i < meta.length; i++) {
        const sourceIndex = (i - normalizedSteps + meta.length) % meta.length
        temp[i] = loopNotes[sourceIndex]
      }

      // Copy back to loop
      for (let i = 0; i < meta.length; i++) {
        loopNotes[i] = temp[i]
      }

      // Update metadata
      meta.lastModified = Date.now()
    })
  }

  // Performance optimization: Efficient inversion
  function invertLoop(loopId) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const loopNotes = notesMatrix[loopId]

      // Find center note for inversion
      let sum = 0
      let count = 0

      for (let i = 0; i < meta.length; i++) {
        if (loopNotes[i] !== null) {
          sum += loopNotes[i]
          count++
        }
      }

      if (count === 0) return

      const centerNote = Math.round(sum / count)

      // Invert notes around center
      for (let i = 0; i < meta.length; i++) {
        if (loopNotes[i] !== null) {
          const newNote = centerNote - (loopNotes[i] - centerNote)
          if (newNote >= MIN_NOTE && newNote <= MAX_NOTE) {
            loopNotes[i] = newNote
          }
        }
      }

      // Update metadata
      meta.lastModified = Date.now()
    })
  }

  // Performance optimization: Efficient mutation
  function mutateLoop(loopId, mutationRate = 0.1) {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return

    batchUpdate(() => {
      const meta = loopMetadata[loopId]
      const scaleIntervals = getScaleIntervalsCached(meta.scale)
      const loopNotes = notesMatrix[loopId]

      // Pre-compute possible notes
      const possibleNotes = []
      for (let oct = 0; oct < meta.octaveRange; oct++) {
        for (const interval of scaleIntervals) {
          const note = meta.baseNote + interval + (oct * 12)
          if (note >= MIN_NOTE && note <= MAX_NOTE) {
            possibleNotes.push(note)
          }
        }
      }

      // Mutate notes
      for (let i = 0; i < meta.length; i++) {
        if (Math.random() < mutationRate) {
          if (loopNotes[i] !== null && Math.random() < 0.5) {
            // Remove existing note
            loopNotes[i] = null
          } else if (possibleNotes.length > 0) {
            // Add or change note
            loopNotes[i] = possibleNotes[Math.floor(Math.random() * possibleNotes.length)]
          }
        }
      }

      // Update metadata
      meta.lastModified = Date.now()
    })
  }

  // Performance optimization: Efficient copying
  function copyLoop(sourceLoopId, targetLoopId) {
    if (sourceLoopId >= MAX_LOOPS || targetLoopId >= MAX_LOOPS ||
      !loopMetadata[sourceLoopId] || !loopMetadata[targetLoopId]) return

    batchUpdate(() => {
      const sourceMeta = loopMetadata[sourceLoopId]
      const targetMeta = loopMetadata[targetLoopId]
      const sourceNotes = notesMatrix[sourceLoopId]
      const targetNotes = notesMatrix[targetLoopId]

      // Copy metadata
      Object.assign(targetMeta, { ...sourceMeta, lastModified: Date.now() })

      // Copy notes
      for (let i = 0; i < MAX_STEPS; i++) {
        targetNotes[i] = sourceNotes[i]
      }
    })
  }

  // Performance optimization: Efficient matrix initialization
  function initializeMatrix() {
    batchUpdate(() => {
      // Clear all loops
      for (let i = 0; i < MAX_LOOPS; i++) {
        for (let j = 0; j < MAX_STEPS; j++) {
          notesMatrix[i][j] = null
        }

        // Reset metadata - scale must be explicitly set elsewhere
        loopMetadata[i] = reactive({
          isActive: false,
          scale: null, // Scale must be explicitly set
          baseNote: matrixState.value.globalBaseNote,
          length: matrixState.value.stepCount,
          octaveRange: 2,
          density: 0,
          lastModified: Date.now(),
          // Melodic generation fields
          noteRangeMin: 24,
          noteRangeMax: 96,
          patternProbabilities: {
            euclidean: 0.3,
            arpeggio: 0.3,
            random: 0.4
          },
          generationMode: 'auto',
          lastPattern: null
        })
      }

      // Clear active loops
      matrixState.value.activeLoops.clear()

      // Clear caches
      SCALE_INTERVALS_CACHE.clear()
      NOTE_VALIDATION_CACHE.clear()
      DENSITY_CACHE.clear()
      memoizedValues.clear()
    })
  }

  // Performance optimization: Efficient stats calculation
  function getMatrixStats() {
    return getMemoized('matrixStats', () => {
      let totalNotes = 0
      let activeLoops = 0
      let totalDensity = 0

      for (let i = 0; i < MAX_LOOPS; i++) {
        if (loopMetadata[i].isActive) {
          activeLoops++
          const metrics = computeLoopDensityMetrics(i)
          totalNotes += metrics.noteCount
          totalDensity += metrics.density
        }
      }

      return {
        totalLoops: MAX_LOOPS,
        activeLoops,
        totalNotes,
        averageDensity: activeLoops > 0 ? totalDensity / activeLoops : 0,
        globalBaseNote: matrixState.value.globalBaseNote
      }
    })
  }

  // Performance optimization: Efficient matrix clearing
  function clearMatrix() {
    batchUpdate(() => {
      for (let i = 0; i < MAX_LOOPS; i++) {
        for (let j = 0; j < MAX_STEPS; j++) {
          notesMatrix[i][j] = null
        }

        loopMetadata[i].lastModified = Date.now()
      }

      // Clear caches
      NOTE_VALIDATION_CACHE.clear()
      DENSITY_CACHE.clear()
      memoizedValues.clear()
    })
  }

  // Performance optimization: Efficient matrix export
  function exportMatrix() {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      state: {
        globalBaseNote: matrixState.value.globalBaseNote,
        stepCount: matrixState.value.stepCount
        // Removed currentScale - scale is now managed by audioStore
      },
      loops: []
    }

    for (let i = 0; i < MAX_LOOPS; i++) {
      if (loopMetadata[i].isActive) {
        data.loops.push({
          id: i,
          metadata: { ...loopMetadata[i] },
          notes: getLoopNotes(i)
        })
      }
    }

    return data
  }

  // Performance optimization: Efficient matrix import
  // Performance optimization: Efficient matrix import
  function importMatrix(data) {
    if (!data || !data.state || !data.loops) return false

    batchUpdate(() => {
      // Import state (no currentScale - scale is managed by audioStore)
      matrixState.value.globalBaseNote = data.state.globalBaseNote || 60
      matrixState.value.stepCount = data.state.stepCount || 16

      // Clear existing data
      initializeMatrix()

      // Import loops
      for (const loopData of data.loops) {
        if (loopData.id >= 0 && loopData.id < MAX_LOOPS) {
          initializeLoop(loopData.id, loopData.metadata)
          setLoopNotes(loopData.id, loopData.notes)
        }
      }
    })

    return true
  }

  // Performance optimization: Efficient debug logging
  function logNotesMatrix() {
    console.log('='.repeat(80))
    console.log('NOTES MATRIX DEBUG LOG')
    console.log('='.repeat(80))
    console.log('Global Settings:')
    console.log(`  Global Base Note: ${matrixState.value.globalBaseNote}`)
    console.log(`  Active Loops: [${Array.from(matrixState.value.activeLoops).join(', ')}]`)
    console.log(`  Step Count: ${matrixState.value.stepCount}`)
    console.log('-'.repeat(80))

    matrixState.value.activeLoops.forEach(loopId => {
      const meta = loopMetadata[loopId]
      if (!meta) {
        console.log(`Loop ${loopId}: NO METADATA`)
        return
      }

      const notes = getLoopNotes(loopId)
      const metrics = computeLoopDensityMetrics(loopId)
      const scaleName = meta.scale || 'unknown'
      const scaleIntervals = meta.scale ? getScaleIntervalsCached(meta.scale) : 'unknown'

      console.log(`\nLoop ${loopId} (${meta.isActive ? 'ACTIVE' : 'inactive'}):`)
      console.log(`  Scale Name: "${scaleName}"`)
      console.log(`  Scale Intervals: [${scaleIntervals}]`)
      console.log(`  Base Note: ${meta.baseNote} (MIDI)`)
      console.log(`  Length: ${meta.length} steps`)
      console.log(`  Density: ${(metrics.density * 100).toFixed(1)}% (${metrics.noteCount}/${metrics.length} notes)`)
      console.log(`  Octave Range: ${meta.octaveRange}`)
      console.log(`  Notes: [${notes.map((n, i) => {
        if (n === null) return `${i}:--`
        // Check if note is in scale
        const noteInScale = meta.scale ? isNoteInScaleCached(n, meta.baseNote, meta.scale, meta.octaveRange) : true
        return `${i}:${n}${noteInScale ? '' : '⚠️'}`
      }).join(', ')}]`)
    })

    console.log('='.repeat(80))
  }

  return {
    // Size constants (exported for consumers that rely on them)
    MAX_LOOPS,
    MAX_STEPS,
    // Estado
    notesMatrix: readonly(notesMatrix),
    loopMetadata: readonly(loopMetadata),
    matrixState: readonly(matrixState),

    // Gestión de loops
    initializeLoop,
    setLoopActive,
    updateLoopMetadata,
    getLoopNotes,
    setLoopNotes,
    setLoopNote,
    clearLoopNote,
    getNote,

    getLoopNoteDensity: (loopId) => {
      if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return 0

      // Return cached density if available (only recompute if stale or not set)
      const cached = loopMetadata[loopId].density
      if (typeof cached === 'number') {
        return cached
      }

      // Fallback to computation if not cached
      return computeLoopDensityMetrics(loopId).density
    },
    getLoopDensityMetrics: computeLoopDensityMetrics,

    // Generación
    generateLoopNotes,
    resizeLoop,

    // Cuantización
    quantizeLoop,
    quantizeAllActiveLoops,

    // Operaciones evolutivas
    transposeLoop,
    rotateLoop,
    invertLoop,
    mutateLoop,
    copyLoop,

    // Backwards-compatible aliases (keep here so returned object contains them)
    // Legacy consumers may call these names; they map to the newer implementations above.
    activateLoop: (id) => setLoopActive(id, true),
    deactivateLoop: (id) => setLoopActive(id, false),
    generateRandomNotes: generateLoopNotes,
    quantizeLoopToScale: quantizeLoop,
    quantizeAllToScale: quantizeAllActiveLoops,
    inverseLoop: invertLoop,

    // OPTIMIZATION: Batch operations for performance during evolution
    beginBatch: () => {
      _batchMode = true
      _pendingUpdates.clear()
    },

    endBatch: () => {
      _batchMode = false

      // Trigger single reactivity update for all changed loops
      if (_pendingUpdates.size > 0) {
        triggerReactivityDebounced()
        _pendingUpdates.clear()
      }
    },

    // Utilidades
    initializeMatrix,
    getMatrixStats,
    clearMatrix,
    exportMatrix,
    importMatrix,
    logNotesMatrix
  }
}

// Backwards-compatible aliases for older modules that expect different method names
// These keep the composable API stable while allowing legacy callers to continue working
export const notesMatrixAliases = {
  activateLoop: (id) => {
    const s = useNotesMatrix()
    if (s && s.setLoopActive) s.setLoopActive(id, true)
  },
  deactivateLoop: (id) => {
    const s = useNotesMatrix()
    if (s && s.setLoopActive) s.setLoopActive(id, false)
  },
  generateRandomNotes: (loopId, density, options) => {
    const s = useNotesMatrix()
    if (s && s.generateLoopNotes) return s.generateLoopNotes(loopId, density, options)
  },
  quantizeLoopToScale: (loopId, scale, baseNote) => {
    const s = useNotesMatrix()
    if (s && s.quantizeLoop) return s.quantizeLoop(loopId, scale)
  },
  quantizeAllToScale: (scale) => {
    const s = useNotesMatrix()
    if (s && s.quantizeAllActiveLoops) return s.quantizeAllActiveLoops(scale)
  },
  inverseLoop: (loopId, centerNote) => {
    const s = useNotesMatrix()
    if (s && s.invertLoop) return s.invertLoop(loopId)
  },
  // Provide direct access to the composable for modules that import the alias bundle
  getNotesMatrix: () => useNotesMatrix()
}