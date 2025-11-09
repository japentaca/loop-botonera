import { ref, computed, reactive, readonly, shallowRef, triggerRef } from 'vue'
import { useScales, useNoteUtils } from './useMusic'

// Helper function for efficient MIDI note clamping
const clampToMidiRange = (note) => {
  const MIN_MIDI = 24
  const MAX_MIDI = 96
  const OCTAVE = 12

  if (note < MIN_MIDI) {
    const octavesBelow = Math.ceil((MIN_MIDI - note) / OCTAVE)
    return note + (octavesBelow * OCTAVE)
  }
  if (note > MAX_MIDI) {
    const octavesAbove = Math.ceil((note - MAX_MIDI) / OCTAVE)
    return note - (octavesAbove * OCTAVE)
  }
  return note
}

export function useNotesMatrix() {
  // Configuración de la matriz
  const MAX_LOOPS = 16
  const MAX_STEPS = 32

  // Matriz principal de notas [loopId][stepIndex] = midiNote | null
  // Using shallowRef for performance as this matrix changes frequently during playback
  const notesMatrix = shallowRef(Array(MAX_LOOPS).fill(null).map(() => Array(MAX_STEPS).fill(null)))

  // Metadatos por loop
  const loopMetadata = reactive({})

  // Estado global de la matriz
  const matrixState = reactive({
    currentScale: 'major',
    globalBaseNote: 60,
    activeLoops: new Set(),
    stepCount: 16, // Pasos activos por defecto
    syncMode: 'all' // 'all', 'selected', 'none'
  })

  const { getScale } = useScales()
  const { quantizeToScale } = useNoteUtils()

  const isDebugEnabled = () => typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
  const debugLog = (label, payload = {}) => {
    if (isDebugEnabled()) {
      // console.log(`[NotesMatrix] ${label}`, payload)
    }
  }

  const refreshMatrixStepCount = () => {
    let maxLength = 0
    matrixState.activeLoops.forEach(loopId => {
      const meta = loopMetadata[loopId]
      if (meta && typeof meta.length === 'number') {
        maxLength = Math.max(maxLength, meta.length)
      }
    })
    matrixState.stepCount = maxLength || 16
  }

  const computeLoopDensityMetrics = (loopId) => {
    const meta = loopMetadata[loopId]
    if (!meta) {
      return { noteCount: 0, length: 0, density: 0 }
    }

    const length = Math.max(0, Math.min(MAX_STEPS, meta.length || 0))
    if (length === 0) {
      return { noteCount: 0, length: 0, density: 0 }
    }

    const notes = notesMatrix.value[loopId]?.slice(0, length) || []
    const noteCount = notes.filter(note => note !== null && note !== undefined).length
    const density = length > 0 ? noteCount / length : 0
    return { noteCount, length, density }
  }

  const updateDensityCache = (loopId) => {
    const metrics = computeLoopDensityMetrics(loopId)
    if (loopMetadata[loopId]) {
      loopMetadata[loopId].density = metrics.density
      loopMetadata[loopId].lastModified = Date.now()
    }
    return metrics
  }

  const generateRandomNoteForLoop = (loopId) => {
    const meta = loopMetadata[loopId]
    if (!meta) return null

    // Always resolve scale from the scale NAME stored in metadata (or use global)
    const scaleName = meta.scale || matrixState.currentScale
    const scaleIntervals = getScale(scaleName)
    const baseNote = meta.baseNote || matrixState.globalBaseNote
    const octaveRange = Math.max(1, meta.octaveRange || 1)

    const scaleIndex = Math.floor(Math.random() * scaleIntervals.length)
    const octave = Math.floor(Math.random() * octaveRange)
    const note = clampToMidiRange(baseNote + scaleIntervals[scaleIndex] + (octave * 12))

    return note
  }

  const ensureAtLeastOneNote = (loopId) => {
    const metrics = computeLoopDensityMetrics(loopId)
    if (metrics.length === 0 || metrics.noteCount > 0) return

    const fallbackNote = generateRandomNoteForLoop(loopId)
    notesMatrix.value[loopId][0] = fallbackNote
    updateDensityCache(loopId)
    debugLog('fallback note injected', { loopId, fallbackNote })
  }

  // Computed para obtener la escala actual
  const currentScaleNotes = computed(() => {
    return getScale(matrixState.currentScale)
  })

  // Inicializar metadatos de un loop
  const initializeLoop = (loopId, config = {}) => {
    if (loopId >= MAX_LOOPS) return false

    // CRITICAL: Always store scale NAME, never intervals
    const scaleName = typeof config.scale === 'string' ? config.scale : matrixState.currentScale

    loopMetadata[loopId] = {
      isActive: false,
      length: Math.max(1, Math.min(MAX_STEPS, config.length || 16)),
      scale: scaleName, // Store scale NAME not intervals
      baseNote: config.baseNote || matrixState.globalBaseNote,
      density: typeof config.density === 'number' ? config.density : 0.4,
      octaveRange: config.octaveRange || 2,
      lastModified: Date.now(),
      ...config,
      scale: scaleName // Ensure scale is always overwritten with the name
    }

    debugLog('initialize loop', { loopId, metadata: { ...loopMetadata[loopId] } })
    return true
  }

  // Activar/desactivar loop
  const setLoopActive = (loopId, active) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId)

    loopMetadata[loopId].isActive = active
    if (active) {
      matrixState.activeLoops.add(loopId)
    } else {
      matrixState.activeLoops.delete(loopId)
    }
    refreshMatrixStepCount()
    debugLog('set loop active', { loopId, active })
  }

  // Actualizar metadatos de un loop
  const updateLoopMetadata = (loopId, updates) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId)

    const sanitizedUpdates = { ...updates }

    // Ensure scale is always a string name, never an array
    if (sanitizedUpdates.scale !== undefined && typeof sanitizedUpdates.scale !== 'string') {
      sanitizedUpdates.scale = matrixState.currentScale || 'major'
    }

    if (sanitizedUpdates.length !== undefined) {
      loopMetadata[loopId].length = Math.max(1, Math.min(MAX_STEPS, sanitizedUpdates.length))
      delete sanitizedUpdates.length
      refreshMatrixStepCount()
    }

    Object.assign(loopMetadata[loopId], sanitizedUpdates)
    loopMetadata[loopId].lastModified = Date.now()
    if (sanitizedUpdates.baseNote !== undefined || sanitizedUpdates.density !== undefined) {
      updateDensityCache(loopId)
    }
    debugLog('update metadata', { loopId, updates: sanitizedUpdates })
    return true
  }

  // Obtener notas de un loop específico
  const getLoopNotes = (loopId) => {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return []
    const length = loopMetadata[loopId].length
    return notesMatrix.value[loopId].slice(0, length)
  }

  // Establecer notas de un loop
  const setLoopNotes = (loopId, notes) => {
    if (loopId >= MAX_LOOPS || !Array.isArray(notes)) return false

    if (!loopMetadata[loopId]) initializeLoop(loopId)

    const targetLength = Math.max(1, Math.min(MAX_STEPS, notes.length || loopMetadata[loopId].length || 16))
    loopMetadata[loopId].length = targetLength

    notesMatrix.value[loopId].fill(null)

    notes.forEach((note, index) => {
      if (index < MAX_STEPS) {
        notesMatrix.value[loopId][index] = note
      }
    })

    const metrics = updateDensityCache(loopId)
    ensureAtLeastOneNote(loopId)
    refreshMatrixStepCount()
    debugLog('set loop notes', { loopId, metrics })
    return true
  }

  // Establecer una nota específica
  const setLoopNote = (loopId, stepIndex, note) => {
    if (loopId >= MAX_LOOPS || stepIndex >= MAX_STEPS) return false

    notesMatrix.value[loopId][stepIndex] = note
    const metrics = updateDensityCache(loopId)
    ensureAtLeastOneNote(loopId)
    debugLog('set loop note', { loopId, stepIndex, note, metrics })
    return true
  }

  const clearLoopNote = (loopId, stepIndex) => {
    const success = setLoopNote(loopId, stepIndex, null)
    if (success) {
      debugLog('clear loop note', { loopId, stepIndex })
    }
    return success
  }

  // Obtener una nota específica
  const getNote = (loopId, stepIndex) => {
    if (loopId >= MAX_LOOPS || stepIndex >= MAX_STEPS) return null
    return notesMatrix.value[loopId][stepIndex]
  }

  // Generar notas aleatorias para un loop
  const generateLoopNotes = (loopId, config = {}) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId, config)

    const meta = loopMetadata[loopId]

    // Always use scale NAME and resolve to intervals
    const scaleName = typeof config.scale === 'string' ? config.scale : meta.scale
    const scale = getScale(scaleName)
    const baseNote = config.baseNote || meta.baseNote
    const length = Math.max(1, Math.min(MAX_STEPS, config.length || meta.length || 16))
    const density = typeof config.density === 'number' ? config.density : (meta.density ?? 0.4)
    const octaveRange = config.octaveRange || meta.octaveRange

    // Calculate how many notes should be placed
    const targetNoteCount = Math.max(1, Math.round(length * density))

    // Create array of available positions
    const availablePositions = Array.from({ length }, (_, i) => i)

    // Shuffle positions to distribute notes randomly but evenly
    for (let i = availablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]]
    }

    // Select the first targetNoteCount positions
    const notePositions = new Set(availablePositions.slice(0, targetNoteCount))

    // Generate the notes array with distributed positions
    const newNotes = Array(length).fill(null).map((_, idx) => {
      if (!notePositions.has(idx)) return null

      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * octaveRange)
      const note = baseNote + scale[scaleIndex] + (octave * 12)

      // Asegurar rango MIDI válido manteniendo la nota en escala
      const finalNote = clampToMidiRange(note)

      return finalNote
    })

    // Ensure metadata stores scale NAME
    meta.scale = scaleName
    meta.length = length
    meta.density = density
    setLoopNotes(loopId, newNotes)
    debugLog('generate loop notes', { loopId, length, density })
    return newNotes
  }

  const resizeLoop = (loopId, newLength, options = {}) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId)

    const meta = loopMetadata[loopId]
    const targetLength = Math.max(1, Math.min(MAX_STEPS, Math.round(newLength)))
    const currentNotes = getLoopNotes(loopId)
    const density = options.density ?? computeLoopDensityMetrics(loopId).density ?? meta.density ?? 0.4

    let nextNotes
    if (targetLength <= currentNotes.length) {
      nextNotes = currentNotes.slice(0, targetLength)
    } else {
      nextNotes = [...currentNotes]
      const extraSteps = targetLength - currentNotes.length
      for (let i = 0; i < extraSteps; i++) {
        nextNotes.push(Math.random() < density ? generateRandomNoteForLoop(loopId) : null)
      }
    }

    meta.length = targetLength
    meta.density = density
    setLoopNotes(loopId, nextNotes)
    debugLog('resize loop', { loopId, newLength: targetLength, density })
    return nextNotes
  }

  // Cuantizar un loop a una nueva escala
  const quantizeLoop = (loopId, newScale = null) => {
    if (!loopMetadata[loopId]) return false

    // newScale should be a scale NAME (string), not intervals
    const targetScaleName = newScale || matrixState.currentScale
    const scale = getScale(targetScaleName)
    const baseNote = loopMetadata[loopId].baseNote
    const length = loopMetadata[loopId].length

    let quantizedCount = 0
    for (let i = 0; i < length; i++) {
      const currentNote = notesMatrix.value[loopId][i]
      if (currentNote !== null) {
        const quantized = quantizeToScale(currentNote, scale, baseNote)
        notesMatrix.value[loopId][i] = quantized
        if (currentNote !== quantized) quantizedCount++
      }
    }

    // CRITICAL: Store scale NAME in metadata
    loopMetadata[loopId].scale = targetScaleName
    updateDensityCache(loopId)
    return true
  }

  // Cuantizar todos los loops activos
  const quantizeAllActiveLoops = (newScale) => {
    // Update global scale (should be a scale NAME)
    matrixState.currentScale = newScale

    matrixState.activeLoops.forEach(loopId => {
      quantizeLoop(loopId, newScale)
    })
  }

  // Setter for global scale
  const setGlobalScale = (scaleName) => {
    if (typeof scaleName !== 'string') {
      console.error('[setGlobalScale] Scale name must be a string, got:', typeof scaleName)
      return false
    }
    matrixState.currentScale = scaleName
    return true
  }

  // Operaciones de matriz eficientes para evolución

  // Transponer un loop
  const transposeLoop = (loopId, semitones) => {
    if (!loopMetadata[loopId]) return false

    const meta = loopMetadata[loopId]
    // Resolve scale from NAME stored in metadata
    const scaleName = meta.scale || matrixState.currentScale
    const scale = getScale(scaleName)
    const baseNote = meta.baseNote
    const length = meta.length

    for (let i = 0; i < length; i++) {
      const note = notesMatrix.value[loopId][i]
      if (note !== null) {
        const newNote = note + semitones
        const clampedNote = Math.max(24, Math.min(96, newNote))
        // Quantize to scale after transposition
        const quantizedNote = quantizeToScale(clampedNote, scale, baseNote)
        notesMatrix.value[loopId][i] = quantizedNote
      }
    }

    updateDensityCache(loopId)
    ensureAtLeastOneNote(loopId)
    debugLog('transpose loop', { loopId, semitones })
    return true
  }

  // Rotar notas de un loop
  const rotateLoop = (loopId, steps) => {
    if (!loopMetadata[loopId]) return false

    const length = loopMetadata[loopId].length
    if (length === 0) return false

    const notes = getLoopNotes(loopId)
    if (notes.length === 0) return false

    const rotated = Array.from({ length }, (_, index) => {
      const originalIndex = (index - steps) % length
      const safeIndex = originalIndex < 0 ? originalIndex + length : originalIndex
      return notes[safeIndex]
    })

    setLoopNotes(loopId, rotated)
    debugLog('rotate loop', { loopId, steps })
    return true
  }

  // Invertir notas de un loop
  const invertLoop = (loopId) => {
    if (!loopMetadata[loopId]) return false

    const notes = getLoopNotes(loopId)
    const reversedNotes = [...notes].reverse()
    setLoopNotes(loopId, reversedNotes)
    debugLog('invert loop', { loopId })
    return true
  }

  // Mutar notas aleatoriamente
  const mutateLoop = (loopId, intensity = 0.3) => {
    if (!loopMetadata[loopId]) return false

    const meta = loopMetadata[loopId]
    // Resolve scale from NAME
    const scaleName = meta.scale || matrixState.currentScale
    const scale = getScale(scaleName)
    const length = meta.length
    const changeCount = Math.max(1, Math.floor(length * intensity))

    for (let i = 0; i < changeCount; i++) {
      const randomIndex = Math.floor(Math.random() * length)
      const currentNote = notesMatrix.value[loopId][randomIndex]

      if (currentNote !== null) {
        // Cambiar a una nota cercana en la escala
        const scaleIndex = Math.floor(Math.random() * scale.length)
        const octave = Math.floor(Math.random() * meta.octaveRange)
        const newNote = meta.baseNote + scale[scaleIndex] + (octave * 12)
        const clampedNote = Math.max(24, Math.min(96, newNote))
        notesMatrix.value[loopId][randomIndex] = clampedNote
      }
    }

    updateDensityCache(loopId)
    ensureAtLeastOneNote(loopId)
    debugLog('mutate loop', { loopId, intensity })
    return true
  }

  // Copiar notas entre loops
  const copyLoop = (sourceLoopId, targetLoopId) => {
    if (sourceLoopId >= MAX_LOOPS || targetLoopId >= MAX_LOOPS) return false
    if (!loopMetadata[sourceLoopId]) return false

    const sourceNotes = getLoopNotes(sourceLoopId)
    setLoopNotes(targetLoopId, sourceNotes)

    // Copiar metadatos también
    if (!loopMetadata[targetLoopId]) initializeLoop(targetLoopId)
    Object.assign(loopMetadata[targetLoopId], {
      ...loopMetadata[sourceLoopId],
      lastModified: Date.now()
    })
    updateDensityCache(targetLoopId)
    refreshMatrixStepCount()
    debugLog('copy loop', { sourceLoopId, targetLoopId })
    return true
  }

  // Obtener estadísticas de la matriz
  const getMatrixStats = () => {
    const stats = {
      activeLoops: matrixState.activeLoops.size,
      totalNotes: 0,
      notesPerLoop: {},
      averageDensity: 0
    }

    matrixState.activeLoops.forEach(loopId => {
      const metrics = computeLoopDensityMetrics(loopId)
      stats.totalNotes += metrics.noteCount
      stats.notesPerLoop[loopId] = metrics
    })

    if (matrixState.activeLoops.size > 0 && matrixState.stepCount > 0) {
      const totalSteps = matrixState.activeLoops.size * matrixState.stepCount
      stats.averageDensity = totalSteps ? stats.totalNotes / totalSteps : 0
    }

    return stats
  }

  // Inicializar matriz
  const initializeMatrix = () => {
    // Inicializar la matriz con arrays vacíos
    for (let i = 0; i < MAX_LOOPS; i++) {
      notesMatrix.value[i] = new Array(MAX_STEPS).fill(null)
    }

    // Inicializar metadata vacío
    Object.keys(loopMetadata).forEach(key => {
      delete loopMetadata[key]
    })

    // Inicializar estado por defecto
    matrixState.activeLoops.clear()
    matrixState.currentScale = 'major'
    matrixState.globalBaseNote = 60
    matrixState.stepCount = 16
    matrixState.syncMode = 'all'
    debugLog('initialize matrix')
  }

  // Limpiar matriz completa
  const clearMatrix = () => {
    notesMatrix.value.forEach(loop => loop.fill(null))
    Object.keys(loopMetadata).forEach(key => delete loopMetadata[key])
    matrixState.activeLoops.clear()
    matrixState.stepCount = 16
    debugLog('clear matrix')
  }

  // Exportar/importar matriz
  const exportMatrix = () => {
    return {
      notes: notesMatrix.value,
      metadata: { ...loopMetadata },
      state: { ...matrixState, activeLoops: Array.from(matrixState.activeLoops) }
    }
  }

  const importMatrix = (data) => {
    if (!data || !data.notes || !data.metadata) return false

    try {
      notesMatrix.value = data.notes
      Object.keys(loopMetadata).forEach(key => delete loopMetadata[key])

      // Apply metadata with fallback to ensure scale is always a string name
      Object.entries(data.metadata).forEach(([loopId, meta]) => {
        const cleanMeta = { ...meta }

        // If scale is not a string, default to 'major'
        if (typeof cleanMeta.scale !== 'string') {
          cleanMeta.scale = 'major'
        }

        loopMetadata[loopId] = cleanMeta
      })

      // Handle activeLoops - fix for old presets where Set was serialized as {}
      const activeLoopsData = data.state?.activeLoops
      if (Array.isArray(activeLoopsData)) {
        matrixState.activeLoops = new Set(activeLoopsData)
      } else {
        // Old preset with broken Set serialization - reconstruct from metadata
        matrixState.activeLoops = new Set()
        console.warn('[importMatrix] Reconstructing activeLoops from metadata due to corrupted preset data')
      }

      matrixState.currentScale = data.state?.currentScale || 'major'
      matrixState.globalBaseNote = data.state?.globalBaseNote || 60
      matrixState.stepCount = data.state?.stepCount || 16
      matrixState.syncMode = data.state?.syncMode || 'all'

      Object.keys(loopMetadata).forEach(loopId => updateDensityCache(Number(loopId)))
      refreshMatrixStepCount()
      debugLog('import matrix', { activeLoops: Array.from(matrixState.activeLoops) })
      return true
    } catch (error) {
      console.error('Error importing matrix:', error)
      return false
    }
  }

  // Debug logging method
  const logNotesMatrix = () => {
    console.log('='.repeat(80))
    console.log('NOTES MATRIX DEBUG LOG')
    console.log('='.repeat(80))
    console.log('Global Settings:')
    console.log(`  Current Scale: "${matrixState.currentScale}"`)
    console.log(`  Scale Intervals: [${getScale(matrixState.currentScale)}]`)
    console.log(`  Global Base Note: ${matrixState.globalBaseNote}`)
    console.log(`  Active Loops: [${Array.from(matrixState.activeLoops).join(', ')}]`)
    console.log(`  Step Count: ${matrixState.stepCount}`)
    console.log('-'.repeat(80))

    matrixState.activeLoops.forEach(loopId => {
      const meta = loopMetadata[loopId]
      if (!meta) {
        console.log(`Loop ${loopId}: NO METADATA`)
        return
      }

      const notes = getLoopNotes(loopId)
      const metrics = computeLoopDensityMetrics(loopId)
      const scaleName = meta.scale || matrixState.currentScale
      const scaleIntervals = getScale(scaleName)

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
        const noteInScale = scaleIntervals.some(interval => {
          const expectedNote = meta.baseNote + interval
          // Check within octave range
          for (let oct = 0; oct < meta.octaveRange; oct++) {
            if (n === expectedNote + (oct * 12)) return true
          }
          return false
        })
        return `${i}:${n}${noteInScale ? '' : '⚠️'}`
      }).join(', ')}]`)
    })

    console.log('='.repeat(80))
  }

  return {
    // Estado
    notesMatrix: readonly(notesMatrix),
    loopMetadata: readonly(loopMetadata),
    matrixState: readonly(matrixState),
    currentScaleNotes,

    // Gestión de loops
    initializeLoop,
    setLoopActive,
    updateLoopMetadata,
    getLoopNotes,
    setLoopNotes,
    setLoopNote,
    clearLoopNote,
    getNote,

    getLoopNoteDensity: (loopId) => computeLoopDensityMetrics(loopId).density,
    getLoopDensityMetrics: computeLoopDensityMetrics,

    // Generación
    generateLoopNotes,
    resizeLoop,

    // Cuantización
    quantizeLoop,
    quantizeAllActiveLoops,
    setGlobalScale,

    // Operaciones evolutivas
    transposeLoop,
    rotateLoop,
    invertLoop,
    mutateLoop,
    copyLoop,

    // Utilidades
    initializeMatrix,
    getMatrixStats,
    clearMatrix,
    exportMatrix,
    importMatrix,
    logNotesMatrix
  }
}