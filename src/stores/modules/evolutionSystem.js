import { ref, computed } from 'vue'
import { useAudioStore } from '../audioStore'
import { useNoteUtils, useScales } from '../../composables/useMusic'

/**
 * Sistema de evolución automática que modifica loops de forma inteligente
 * para crear variaciones musicales dinámicas
 * Ahora integrado con la matriz centralizada de notas
 */
export const useEvolutionSystem = (notesMatrix = null) => {
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
    notes: true,        // evolucionar notas/melodías
    effects: false,     // evolución de efectos deshabilitada - solo aspectos musicales
    volume: false,      // evolucionar volúmenes (puede ser disruptivo)
    tempo: false        // evolucionar tempo (experimental)
  })

  // Probabilidades de diferentes tipos de mutación
  const mutationProbabilities = ref({
    addNote: 0.3,       // probabilidad de añadir una nota
    removeNote: 0.2,    // probabilidad de quitar una nota
    shiftPattern: 0.25, // probabilidad de desplazar el patrón
    changeNote: 0.4,    // probabilidad de cambiar una nota existente
    effectChange: 0.3   // probabilidad de cambiar efectos
  })

  const fallbackScale = [0, 2, 4, 5, 7, 9, 11]

  const pickScaleIntervals = (loop, globalScaleIntervals) => {
    // ALWAYS use the global scale intervals passed from audioStore
    // This ensures all loops use the current global scale
    return globalScaleIntervals

    // Fallback: get scale name from metadata and resolve it
    const metaScale = notesMatrix.loopMetadata[loop.id].scale
    const { getScale } = useScales()
    const resolved = getScale(metaScale)
    console.warn(`[pickScaleIntervals] Using metadata scale "${metaScale}" as fallback for loop ${loop.id}`)
    return resolved

    // Final fallback
    console.warn(`[pickScaleIntervals] Using hardcoded fallback scale for loop ${loop.id}`)
    return fallbackScale
  }

  const createRandomNoteForLoop = (loop, globalScaleIntervals) => {
    const intervals = pickScaleIntervals(loop, globalScaleIntervals)
    const baseNote = notesMatrix.loopMetadata[loop.id].baseNote
    const octaveRange = notesMatrix.loopMetadata[loop.id].octaveRange

    const interval = intervals[Math.floor(Math.random() * intervals.length)]
    const octave = Math.floor(Math.random() * octaveRange)
    let note = baseNote + interval + (octave * 12)

    while (note < 24) note += 12
    while (note > 96) note -= 12

    return note
  }

  const ensureLoopHasNotes = (loopId, globalScaleIntervals) => {
    const density = notesMatrix.getLoopNoteDensity(loopId)
    if (density > 0) return

    const loop = audioStore.loops[loopId]
    notesMatrix.setLoopNote(loopId, 0, createRandomNoteForLoop(loop, globalScaleIntervals))
  }

  const mutateLoopRhythm = (loop, globalScaleIntervals, intensity = evolutionIntensity.value) => {
    const loopNotes = notesMatrix.getLoopNotes(loop.id)
    if (loopNotes.length === 0) return false

    const changeCount = Math.max(1, Math.floor(loopNotes.length * intensity * 0.5))
    let mutated = false

    // Get positions of existing notes and empty positions
    const activePositions = []
    const emptyPositions = []
    loopNotes.forEach((note, idx) => {
      if (note === null || note === undefined) {
        emptyPositions.push(idx)
      } else {
        activePositions.push(idx)
      }
    })

    // Shuffle empty positions for better distribution
    for (let i = emptyPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[emptyPositions[i], emptyPositions[j]] = [emptyPositions[j], emptyPositions[i]]
    }

    for (let i = 0; i < changeCount; i++) {
      const action = Math.random()

      if (action < mutationProbabilities.value.addNote && emptyPositions.length > 0) {
        // Add note to a distributed empty position
        const stepIndex = emptyPositions.shift()
        const newNote = createRandomNoteForLoop(loop, globalScaleIntervals)
        notesMatrix.setLoopNote(loop.id, stepIndex, newNote)
        mutated = true
      } else if (action < mutationProbabilities.value.addNote + mutationProbabilities.value.removeNote && activePositions.length > 1) {
        // Remove note from random active position (keep at least 1)
        const randomIdx = Math.floor(Math.random() * activePositions.length)
        const stepIndex = activePositions.splice(randomIdx, 1)[0]
        notesMatrix.clearLoopNote(loop.id, stepIndex)
        emptyPositions.push(stepIndex)
        mutated = true
      }
    }

    ensureLoopHasNotes(loop.id, globalScaleIntervals)
    return mutated
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
    }

    // Add notes to distributed inactive positions
    while (activeIndices.length < desiredActive && inactiveIndices.length > 0) {
      const stepIndex = inactiveIndices.shift()
      const newNote = createRandomNoteForLoop(loop, globalScaleIntervals)
      notesMatrix.setLoopNote(loop.id, stepIndex, newNote)
      activeIndices.push(stepIndex)
    }

    ensureLoopHasNotes(loop.id, globalScaleIntervals)

    return true
  }

  // Generar variación de notas/melodía
  const evolveNotes = (currentNotes, scaleIntervals, intensity = evolutionIntensity.value) => {
    const newNotes = [...currentNotes]
    const changeCount = Math.floor(newNotes.length * intensity * 0.4)

    for (let i = 0; i < changeCount; i++) {
      const randomIndex = Math.floor(Math.random() * newNotes.length)
      const currentNote = newNotes[randomIndex]

      if (currentNote === null) continue // Skip silent notes

      if (Math.random() < mutationProbabilities.value.changeNote) {
        // Get the base note from the first octave of the current note
        const noteInFirstOctave = currentNote % 12
        const octave = Math.floor(currentNote / 12)

        // Find current position in scale
        let closestIntervalIndex = 0
        let minDistance = Math.abs(noteInFirstOctave - scaleIntervals[0])

        scaleIntervals.forEach((interval, idx) => {
          const distance = Math.abs(noteInFirstOctave - interval)
          if (distance < minDistance) {
            minDistance = distance
            closestIntervalIndex = idx
          }
        })

        // Move to adjacent scale degree
        const direction = Math.random() < 0.5 ? -1 : 1
        const steps = Math.floor(Math.random() * 2) + 1 // 1-2 steps
        let newDegree = closestIntervalIndex + (direction * steps)

        // Wrap around the scale if needed
        while (newDegree < 0) newDegree += scaleIntervals.length
        while (newDegree >= scaleIntervals.length) newDegree -= scaleIntervals.length

        const newInterval = scaleIntervals[newDegree]
        let newNote = (octave * 12) + newInterval

        // Ensure note stays in valid MIDI range
        while (newNote < 24) newNote += 12
        while (newNote > 96) newNote -= 12

        newNotes[randomIndex] = newNote
      }
    }

    return newNotes
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
      adjustLoopDensity(loop, targetDensity, globalScaleIntervals)
    }

    return evolvedLoop
  }

  // Evolucionar un loop específico
  const evolveLoop = (loop, globalScaleIntervals, options = {}) => {
    let evolvedLoop = { ...loop }

    // Evolución de patrón a través de la matriz centralizada
    if (evolutionTypes.value.pattern) {
      mutateLoopRhythm(loop, globalScaleIntervals)
    }

    // Evolución de notas usando la matriz centralizada
    if (evolutionTypes.value.notes) {
      // Obtener notas desde la matriz centralizada
      const currentNotes = notesMatrix.getLoopNotes(loop.id)

      // Evolucionar notas using global scale intervals
      const evolvedNotes = evolveNotes(currentNotes, globalScaleIntervals)

      // Guardar en la matriz centralizada
      notesMatrix.setLoopNotes(loop.id, evolvedNotes)
    }

    // Los efectos (delay y reverb) no se evolucionan automáticamente
    // Se mantienen estables para preservar la configuración del usuario

    // Evolución de volumen (si está habilitada)
    if (evolutionTypes.value.volume && Math.random() < 0.3) {
      const volumeChange = (Math.random() - 0.5) * 0.2 * evolutionIntensity.value
      evolvedLoop.volume = Math.max(0.1, Math.min(1.0, evolvedLoop.volume + volumeChange))
    }

    // Aplicar evolución creativa si está habilitada
    if (creativeModeEnabled.value) {
      evolvedLoop = applyCreativeEvolution(evolvedLoop, null, globalScaleIntervals)
    }

    return evolvedLoop
  }

  // Evolucionar múltiples loops de forma coordinada
  const evolveMultipleLoops = (loops, globalScaleIntervals, options = {}) => {
    const activeLoops = loops.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return loops

    // Seleccionar loops para evolucionar basado en la intensidad
    const loopsToEvolve = Math.max(1, Math.floor(activeLoops.length * evolutionIntensity.value))
    const selectedLoops = activeLoops
      .sort(() => Math.random() - 0.5)
      .slice(0, loopsToEvolve)

    return loops.map(loop => {
      if (selectedLoops.includes(loop)) {
        return evolveLoop(loop, globalScaleIntervals, options)
      }
      return loop
    })
  }

  // Verificar si es tiempo de evolucionar
  const shouldEvolve = () => {
    if (!autoEvolutionEnabled.value) return false

    const now = Date.now()
    return (now - lastEvolutionTime.value) >= evolutionInterval.value
  }

  // Marcar que se realizó una evolución
  const markEvolution = () => {
    lastEvolutionTime.value = Date.now()
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
    mutationProbabilities.value = { ...mutationProbabilities.value, ...probabilities }
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
    if (!evolutionTypes.value.notes) return false

    const loopNotes = notesMatrix.getLoopNotes(loopId)
    if (!loopNotes || loopNotes.length === 0) return false

    const changeCount = Math.floor(loopNotes.length * intensity * 0.4)
    let hasChanges = false

    // Get scale information - ensure we resolve scale name to intervals
    const meta = notesMatrix.loopMetadata?.[loopId]
    const scaleName = typeof meta?.scale === 'string' ? meta.scale : 'major'
    const baseNote = meta?.baseNote || 60
    const { getScale } = useScales()
    const scaleIntervals = getScale(scaleName)
    const { quantizeToScale } = useNoteUtils()

    for (let i = 0; i < changeCount; i++) {
      const randomStep = Math.floor(Math.random() * loopNotes.length)

      if (Math.random() < mutationProbabilities.value.changeNote) {
        const currentNote = loopNotes[randomStep]

        if (currentNote !== null) {
          // Transponer la nota existente respetando la escala
          const transposition = Math.floor(Math.random() * 7) - 3 // -3 a +3 semitonos
          const transposedNote = currentNote + transposition
          // Quantize to scale
          const quantizedNote = quantizeToScale(transposedNote, scaleIntervals, baseNote)
          notesMatrix.setLoopNote(loopId, randomStep, quantizedNote)
          hasChanges = true
        } else if (Math.random() < mutationProbabilities.value.addNote) {
          // Agregar una nueva nota dentro de la escala
          const scaleIndex = Math.floor(Math.random() * scaleIntervals.length)
          const octave = Math.floor(Math.random() * 3) // 0-2 octavas adicionales
          let newNote = baseNote + scaleIntervals[scaleIndex] + (octave * 12)
          // Clamp to valid MIDI range
          while (newNote < 24) newNote += 12
          while (newNote > 96) newNote -= 12
          notesMatrix.setLoopNote(loopId, randomStep, newNote)
          hasChanges = true
        }
      } else if (Math.random() < mutationProbabilities.value.removeNote && loopNotes[randomStep] !== null) {
        notesMatrix.clearLoopNote(loopId, randomStep)
        hasChanges = true
      }
    }

    return hasChanges
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
    mutationProbabilities,

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