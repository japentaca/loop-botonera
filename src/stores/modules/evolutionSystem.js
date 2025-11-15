import { ref, computed } from 'vue'
import { useAudioStore } from '../audioStore'
import { useNoteUtils, useScales } from '../../composables/useMusic'

/**
 * Sistema de evolución automática que modifica loops de forma inteligente
 * para crear variaciones musicales dinámicas
 * Ahora integrado con la matriz centralizada de notas
 */

// Helper: clamp a note into a given [min,max] by adjusting octaves
const clampToNoteRange = (note, min, max) => {
  const OCTAVE = 12

  // Guard against invalid ranges
  if (min > max) {
    const tmp = min
    min = max
    max = tmp
  }

  if (note < min) {
    const octavesBelow = Math.ceil((min - note) / OCTAVE)
    return note + (octavesBelow * OCTAVE)
  }
  if (note > max) {
    const octavesAbove = Math.ceil((note - max) / OCTAVE)
    return note - (octavesAbove * OCTAVE)
  }
  return note
}

const wrapScaleDegree = (degree, scaleLength) => {
  return ((degree % scaleLength) + scaleLength) % scaleLength
}

export const useEvolutionSystem = (notesMatrix = null, melodicGenerator = null) => {
  // Estado de evolución automática
  const autoEvolutionEnabled = ref(false)
  const evolutionInterval = ref(8) // intervalo en compases (4/4)
  const evolutionIntensity = ref(0.1) // intensidad de los cambios (0-1), valor por defecto 1 en interfaz
  const creativeModeEnabled = ref(false)
  const lastEvolutionTime = ref(0)
  const audioStore = useAudioStore()

  // Configuración de tipos de evolución
  const evolutionTypes = ref({
    pattern: true,      // evolucionar patrones rítmicos
    notes: true         // evolucionar notas/melodías
  })

  // NOTE: Delegation-only mode: evolution orchestration delegates
  // responsibility for pattern/note regeneration to `melodicGenerator`.
  // Mutation probabilities have been removed to keep single responsibility.


  const pickScaleIntervals = (loop, globalScaleIntervals) => {
    // ALWAYS use the global scale intervals passed from audioStore
    // This ensures all loops use the current global scale
    return globalScaleIntervals

  }



  const ensureLoopHasNotes = (loopId, globalScaleIntervals) => {
    const density = notesMatrix.getLoopNoteDensity(loopId)
    if (density > 0) return

    const loop = audioStore.loops[loopId]
    const intervals = pickScaleIntervals(loop, globalScaleIntervals)
    const meta = notesMatrix.loopMetadata[loopId] || {}
    const baseNote = meta.baseNote
    const octaveRange = meta.octaveRange
    const rangeMin = meta.noteRangeMin ?? 24
    const rangeMax = meta.noteRangeMax ?? 96
    const interval = intervals[Math.floor(Math.random() * intervals.length)]
    const octave = Math.floor(Math.random() * octaveRange)
    const rawNote = baseNote + interval + (octave * 12)
    const note = clampToNoteRange(rawNote, rangeMin, rangeMax)
    notesMatrix.setLoopNote(loopId, 0, note)
    console.log(`[Evolution] ensureLoopHasNotes: loop=${loopId} set note=${note}`)
  }

  const createRegenerateIntent = (loopId, options = {}) => ({ type: 'regenerate', loopId, options })
  const createMetadataUpdateIntent = (loopId, updates = {}) => ({ type: 'metadataUpdate', loopId, updates })
  const createQuantizeIntent = (loopId) => ({ type: 'quantize', loopId })

  const mutateLoopRhythm = (loop, globalScaleIntervals, intensity = evolutionIntensity.value) => {
    const intents = []
    intents.push(createRegenerateIntent(loop.id, { intensity }))
    intents.push(createMetadataUpdateIntent(loop.id, { ensureNotes: true, globalScaleIntervals }))
    return intents
  }

  const adjustLoopDensity = (loop, targetDensity, globalScaleIntervals) => {
    const loopNotes = notesMatrix.getLoopNotes(loop.id)
    if (loopNotes.length === 0) return false

    const desiredActive = Math.max(1, Math.round(loopNotes.length * targetDensity))
    const activeIndices = []
    const inactiveIndices = []

    loopNotes.forEach((note, index) => {
      activeIndices.push(index)
      inactiveIndices.push(index)
    })

    // Shuffle inactive indices for better distribution
    for (let i = inactiveIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[inactiveIndices[i], inactiveIndices[j]] = [inactiveIndices[j], inactiveIndices[i]]
    }

    // Remove excess notes randomly from active positions
    while (activeIndices.length > desiredActive) {
      const removalIndex = Math.floor(Math.random() * activeIndices.length)
      const stepIndex = activeIndices.splice(removalIndex, 1)[0]
      notesMatrix.clearLoopNote(loop.id, stepIndex)
      console.log(`[Evolution] adjustLoopDensity: loop=${loop.id} removed note at step=${stepIndex}`)
    }

    // Add notes to distributed inactive positions
    while (activeIndices.length < desiredActive && inactiveIndices.length > 0) {
      const stepIndex = inactiveIndices.shift()
      const intervals = pickScaleIntervals(loop, globalScaleIntervals)
      const meta = notesMatrix.loopMetadata[loop.id] || {}
      const baseNote = meta.baseNote
      const octaveRange = meta.octaveRange
      const rangeMin = meta.noteRangeMin ?? 24
      const rangeMax = meta.noteRangeMax ?? 96
      const interval = intervals[Math.floor(Math.random() * intervals.length)]
      const octave = Math.floor(Math.random() * octaveRange)
      const rawNote = baseNote + interval + (octave * 12)
      const newNote = clampToNoteRange(rawNote, rangeMin, rangeMax)
      notesMatrix.setLoopNote(loop.id, stepIndex, newNote)
      activeIndices.push(stepIndex)
      console.log(`[Evolution] adjustLoopDensity: loop=${loop.id} added note=${newNote} at step=${stepIndex}`)
    }

    ensureLoopHasNotes(loop.id, globalScaleIntervals)

    return true
  }

  // Generar variación de notas/melodía
  const evolveNotes = (loopId, currentNotes, scaleIntervals, intensity = evolutionIntensity.value) => {
    const intents = []
    intents.push(createRegenerateIntent(loopId, { intensity }))
    intents.push(createQuantizeIntent(loopId))
    return intents
  }



  // Aplicar evolución creativa más experimental
  const applyCreativeEvolution = (loop, availableScales, globalScaleIntervals) => {
    if (!creativeModeEnabled.value) return loop

    const evolvedLoop = { ...loop }

    // Cambio de escala ocasional en modo creativo - DISABLED
    // Scale changes should only happen at the global level via audioStore
    // Individual loops no longer have their own scales

    // Cambios de densidad más dramáticos
    if (Math.random() < 0.15 && notesMatrix) {
      const currentDensity = notesMatrix.getLoopNoteDensity(loop.id)
      const targetDensity = currentDensity < 0.3 ? 0.6 : 0.2
      console.log(`[Evolution] applyCreativeEvolution: loop=${loop.id} changing density ${currentDensity}->${targetDensity}`)
      adjustLoopDensity(loop, targetDensity, globalScaleIntervals)
    }

    return evolvedLoop
  }

  // Evolucionar un loop específico
  const evolveLoop = (loop, globalScaleIntervals, options = {}) => {
    const intents = []
    const meta = notesMatrix.loopMetadata?.[loop.id]
    if (meta && meta.generationMode !== 'locked') {
      intents.push(createRegenerateIntent(loop.id, { intensity: evolutionIntensity.value, types: evolutionTypes.value, options }))
      intents.push(createMetadataUpdateIntent(loop.id, { ensureNotes: true, globalScaleIntervals }))
      return intents
    }
    intents.push(createRegenerateIntent(loop.id, { intensity: evolutionIntensity.value, types: evolutionTypes.value, options }))
    intents.push(createQuantizeIntent(loop.id))
    if (creativeModeEnabled.value) {
      intents.push(createMetadataUpdateIntent(loop.id, { creative: true }))
    }
    return intents
  }

  // Evolucionar múltiples loops de forma coordinada
  const evolveMultipleLoops = (loops, globalScaleIntervals, options = {}) => {
    const activeLoops = loops.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return []
    const loopsToEvolve = Math.max(1, Math.floor(activeLoops.length * evolutionIntensity.value))
    const selectedLoops = activeLoops
      .sort(() => Math.random() - 0.5)
      .slice(0, loopsToEvolve)
    const intents = []
    selectedLoops.forEach(loop => {
      const loopIntents = evolveLoop(loop, globalScaleIntervals, options)
      loopIntents.forEach(i => intents.push(i))
    })
    return intents
  }

  // Verificar si es tiempo de evolucionar
  const shouldEvolve = () => {
    if (!autoEvolutionEnabled.value) return false

    const now = Date.now()
    const ready = (now - lastEvolutionTime.value) >= evolutionInterval.value
    if (ready) console.log('[Evolution] shouldEvolve: true')
    return ready
  }

  // Marcar que se realizó una evolución
  const markEvolution = () => {
    lastEvolutionTime.value = Date.now()
    console.log('[Evolution] markEvolution: evolution marked at', lastEvolutionTime.value)
  }

  // Configuración de evolución
  const updateEvolutionSettings = (settings) => {
    if (settings.enabled !== undefined) {
      autoEvolutionEnabled.value = settings.enabled
    }
    if (settings.interval !== undefined) {
      evolutionInterval.value = settings.interval // límites en compases
    }
    if (settings.intensity !== undefined) {
      evolutionIntensity.value = settings.intensity
    }
    if (settings.creativeMode !== undefined) {
      creativeModeEnabled.value = settings.creativeMode
    }
  }

  // Configurar tipos de evolución
  const updateEvolutionTypes = (types) => {
    evolutionTypes.value = { ...evolutionTypes.value, ...types }
  }

  // Configurar probabilidades de mutación
  const updateMutationProbabilities = (probabilities) => {
    console.warn('updateMutationProbabilities is deprecated when evolution system delegates to melodicGenerator')
    return false
  }

  // Obtener estadísticas de evolución
  const getEvolutionStats = () => {
    const timeSinceLastEvolution = Date.now() - lastEvolutionTime.value
    const timeUntilNextEvolution = Math.max(0, evolutionInterval.value - timeSinceLastEvolution)

    return {
      enabled: autoEvolutionEnabled.value,
      intensity: evolutionIntensity.value,
      interval: evolutionInterval.value,
      timeSinceLastEvolution,
      timeUntilNextEvolution,
      creativeMode: creativeModeEnabled.value,
      activeTypes: Object.entries(evolutionTypes.value)
        .filter(([_, enabled]) => enabled)
        .map(([type, _]) => type)
    }
  }

  // Forzar evolución inmediata
  const forceEvolution = (loops, globalScaleIntervals, options = {}) => {
    const evolvedLoops = evolveMultipleLoops(loops, globalScaleIntervals, options)
    markEvolution()
    return evolvedLoops
  }

  // Generar variación específica para un tipo de instrumento
  const evolveByInstrumentType = (loop, instrumentType) => {
    const typeSpecificSettings = {
      kick: { pattern: true, notes: false, effects: false },
      snare: { pattern: true, notes: false, effects: true },
      hihat: { pattern: true, notes: false, effects: true },
      bass: { pattern: false, notes: true, effects: true },
      lead: { pattern: false, notes: true, effects: true },
      pad: { pattern: false, notes: true, effects: true }
    }

    const settings = typeSpecificSettings[instrumentType] || evolutionTypes.value
    const originalTypes = { ...evolutionTypes.value }

    // Aplicar configuración específica temporalmente
    evolutionTypes.value = settings
    const evolved = evolveLoop(loop)

    // Restaurar configuración original
    evolutionTypes.value = originalTypes

    return evolved
  }

  // Nuevas funciones para trabajar con la matriz de notas
  const evolveMatrixLoop = (loopId, notesMatrix, intensity = evolutionIntensity.value) => {
    // Delegated matrix evolution: let melodicGenerator or notesMatrix handle mutations.
    if (!evolutionTypes.value.notes) return false
    if (melodicGenerator && typeof melodicGenerator.regenerateLoop === 'function') {
      console.log(`[Evolution] evolveMatrixLoop: delegating regenerateLoop for loop=${loopId} intensity=${intensity}`)
      melodicGenerator.regenerateLoop(loopId, { intensity })
      return true
    }

    // Fallback: if notesMatrix exposes a mutateLoop API, call that deterministically.
    if (notesMatrix && typeof notesMatrix.mutateLoop === 'function') {
      console.log(`[Evolution] evolveMatrixLoop: falling back to notesMatrix.mutateLoop for loop=${loopId} probability=${intensity}`)
      return notesMatrix.mutateLoop(loopId, { probability: intensity })
    }

    return false
  }

  const evolveMultipleMatrixLoops = (loopIds, notesMatrix, intensity = evolutionIntensity.value) => {
    const results = {}

    loopIds.forEach(loopId => {
      results[loopId] = evolveMatrixLoop(loopId, notesMatrix, intensity)
    })

    return results
  }

  const applyMatrixMutation = (loopId, notesMatrix, mutationType, params = {}) => {
    switch (mutationType) {
      case 'transpose':
        return notesMatrix.transposeLoop(loopId, params.semitones || 0)
      case 'rotate':
        return notesMatrix.rotateLoop(loopId, params.steps || 1)
      case 'inverse':
        return notesMatrix.inverseLoop(loopId, params.centerNote || 60)
      case 'mutate':
        return notesMatrix.mutateLoop(loopId, params.probability || 0.3)
      case 'quantize':
        return notesMatrix.quantizeLoopToScale(loopId, params.scale || [], params.baseNote || 60)
      default:
        return false
    }
  }

  const evolveMatrixWithStrategy = (loopIds, notesMatrix, strategy = 'balanced') => {
    const strategies = {
      conservative: { intensity: 0.1, mutations: ['transpose', 'rotate'] },
      balanced: { intensity: 0.3, mutations: ['transpose', 'rotate', 'mutate'] },
      aggressive: { intensity: 0.6, mutations: ['transpose', 'rotate', 'inverse', 'mutate'] },
      experimental: { intensity: 0.8, mutations: ['transpose', 'rotate', 'inverse', 'mutate', 'quantize'] }
    }

    const config = strategies[strategy] || strategies.balanced
    const results = {}

    loopIds.forEach(loopId => {
      if (Math.random() < config.intensity) {
        const mutation = config.mutations[Math.floor(Math.random() * config.mutations.length)]
        const params = {}

        // Configurar parámetros según el tipo de mutación
        switch (mutation) {
          case 'transpose':
            params.semitones = Math.floor(Math.random() * 13) - 6 // -6 a +6
            break
          case 'rotate':
            params.steps = Math.floor(Math.random() * 8) + 1 // 1 a 8
            break
          case 'inverse':
            params.centerNote = 60 + Math.floor(Math.random() * 25) - 12 // C4 ± 1 octava
            break
          case 'mutate':
            params.probability = 0.2 + Math.random() * 0.4 // 0.2 a 0.6
            break
        }

        results[loopId] = {
          mutation,
          success: applyMatrixMutation(loopId, notesMatrix, mutation, params),
          params
        }
      }
    })

    return results
  }

  return {
    // Estado
    autoEvolutionEnabled,
    evolutionInterval,
    evolutionIntensity,
    creativeModeEnabled,
    evolutionTypes,


    // Funciones de evolución tradicionales
    evolveLoop,
    evolveMultipleLoops,
    evolveByInstrumentType,
    forceEvolution,

    // Nuevas funciones para matriz de notas
    evolveMatrixLoop,
    evolveMultipleMatrixLoops,
    applyMatrixMutation,
    evolveMatrixWithStrategy,

    // Control de tiempo
    shouldEvolve,
    markEvolution,

    // Configuración
    updateEvolutionSettings,
    updateEvolutionTypes,
    updateMutationProbabilities,

    // Utilidades
    getEvolutionStats
  }
}
