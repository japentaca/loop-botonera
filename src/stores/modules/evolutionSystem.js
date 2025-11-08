import { ref, computed } from 'vue'
import { useAudioStore } from '../audioStore'

/**
 * Sistema de evolución automática que modifica loops de forma inteligente
 * para crear variaciones musicales dinámicas
 */
export const useEvolutionSystem = () => {
  // Estado de evolución automática
  const autoEvolutionEnabled = ref(false)
  const evolutionInterval = ref(8) // intervalo en compases (4/4)
  const evolutionIntensity = ref(0.1) // intensidad de los cambios (0-1), valor por defecto 1 en interfaz
  const creativeModeEnabled = ref(false)
  const lastEvolutionTime = ref(0)
  
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

  // Generar variación de patrón rítmico
  const evolvePattern = (currentPattern, intensity = evolutionIntensity.value) => {
    if (!evolutionTypes.value.pattern) return currentPattern
    
    const newPattern = [...currentPattern]
    const changeCount = Math.floor(newPattern.length * intensity * 0.5)
    
    for (let i = 0; i < changeCount; i++) {
      const randomIndex = Math.floor(Math.random() * newPattern.length)
      
      if (Math.random() < mutationProbabilities.value.addNote && !newPattern[randomIndex]) {
        newPattern[randomIndex] = true
      } else if (Math.random() < mutationProbabilities.value.removeNote && newPattern[randomIndex]) {
        newPattern[randomIndex] = false
      }
    }
    
    // Asegurar que el patrón no quede completamente vacío
    if (!newPattern.some(Boolean)) {
      newPattern[0] = true
      newPattern[Math.floor(newPattern.length / 2)] = true
    }
    
    return newPattern
  }

  // Generar variación de notas/melodía
  const evolveNotes = (currentNotes, scale, intensity = evolutionIntensity.value) => {
    if (!evolutionTypes.value.notes || !scale || scale.length === 0) return currentNotes
    
    const newNotes = [...currentNotes]
    const changeCount = Math.floor(newNotes.length * intensity * 0.4)
    
    for (let i = 0; i < changeCount; i++) {
      const randomIndex = Math.floor(Math.random() * newNotes.length)
      
      if (Math.random() < mutationProbabilities.value.changeNote) {
        // Cambiar a una nota cercana en la escala
        const currentNote = newNotes[randomIndex]
        const currentScaleIndex = scale.indexOf(currentNote)
        
        if (currentScaleIndex !== -1) {
          const direction = Math.random() < 0.5 ? -1 : 1
          const steps = Math.floor(Math.random() * 3) + 1 // 1-3 pasos
          const newScaleIndex = Math.max(0, Math.min(scale.length - 1, currentScaleIndex + (direction * steps)))
          newNotes[randomIndex] = scale[newScaleIndex]
        } else {
          // Si la nota no está en la escala, usar una nota aleatoria de la escala
          newNotes[randomIndex] = scale[Math.floor(Math.random() * scale.length)]
        }
      }
    }
    
    return newNotes
  }



  // Aplicar evolución creativa más experimental
  const applyCreativeEvolution = (loop, availableScales) => {
    if (!creativeModeEnabled.value) return loop
    
    const evolvedLoop = { ...loop }
    
    // Cambio de escala ocasional en modo creativo - solo si no está bloqueada
    const audioStore = useAudioStore()
    if (Math.random() < 0.1 && availableScales && availableScales.length > 1 && !audioStore.scaleLocked) {
      const currentScaleIndex = availableScales.findIndex(s => s.name === loop.scale?.name)
      if (currentScaleIndex !== -1) {
        const newScaleIndex = (currentScaleIndex + 1) % availableScales.length
        evolvedLoop.scale = availableScales[newScaleIndex]
        
        // Reajustar notas a la nueva escala
        evolvedLoop.notes = evolvedLoop.notes.map(note => {
          const noteIndex = Math.floor(Math.random() * evolvedLoop.scale.notes.length)
          return evolvedLoop.scale.notes[noteIndex]
        })
      }
    }
    
    // Cambios de densidad más dramáticos
    if (Math.random() < 0.15) {
      const currentDensity = evolvedLoop.pattern.filter(Boolean).length / evolvedLoop.pattern.length
      const targetDensity = currentDensity < 0.3 ? 0.6 : 0.2
      
      evolvedLoop.pattern = evolvedLoop.pattern.map(() => Math.random() < targetDensity)
      
      // Asegurar al menos una nota
      if (!evolvedLoop.pattern.some(Boolean)) {
        evolvedLoop.pattern[0] = true
      }
    }
    
    return evolvedLoop
  }

  // Evolucionar un loop específico
  const evolveLoop = (loop, availableScales = null, options = {}) => {
    if (!loop || !loop.isActive) return loop
    
    let evolvedLoop = { ...loop }
    
    // Evolución de patrón
    if (evolutionTypes.value.pattern) {
      evolvedLoop.pattern = evolvePattern(evolvedLoop.pattern)
    }
    
    // Evolución de notas
    if (evolutionTypes.value.notes && evolvedLoop.scale?.notes) {
      evolvedLoop.notes = evolveNotes(evolvedLoop.notes, evolvedLoop.scale.notes)
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
      evolvedLoop = applyCreativeEvolution(evolvedLoop, availableScales)
    }
    
    return evolvedLoop
  }

  // Evolucionar múltiples loops de forma coordinada
  const evolveMultipleLoops = (loops, availableScales = null, options = {}) => {
    const activeLoops = loops.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return loops
    
    // Seleccionar loops para evolucionar basado en la intensidad
    const loopsToEvolve = Math.max(1, Math.floor(activeLoops.length * evolutionIntensity.value))
    const selectedLoops = activeLoops
      .sort(() => Math.random() - 0.5)
      .slice(0, loopsToEvolve)
    
    return loops.map(loop => {
      if (selectedLoops.includes(loop)) {
        return evolveLoop(loop, availableScales, options)
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
      evolutionInterval.value = Math.max(2, Math.min(32, settings.interval)) // límites en compases
    }
    if (settings.intensity !== undefined) {
      evolutionIntensity.value = Math.max(0.1, Math.min(1.0, settings.intensity))
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
  const forceEvolution = (loops, availableScales = null, options = {}) => {
    const evolvedLoops = evolveMultipleLoops(loops, availableScales, options)
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
    
    for (let i = 0; i < changeCount; i++) {
      const randomStep = Math.floor(Math.random() * loopNotes.length)
      
      if (Math.random() < mutationProbabilities.value.changeNote) {
        const currentNote = loopNotes[randomStep]
        
        if (currentNote !== null) {
          // Transponer la nota existente
          const transposition = Math.floor(Math.random() * 7) - 3 // -3 a +3 semitonos
          const newNote = Math.max(21, Math.min(108, currentNote + transposition))
          notesMatrix.setLoopNote(loopId, randomStep, newNote)
          hasChanges = true
        } else if (Math.random() < mutationProbabilities.value.addNote) {
          // Agregar una nueva nota
          const randomNote = Math.floor(Math.random() * 88) + 21 // C1 a C8
          notesMatrix.setLoopNote(loopId, randomStep, randomNote)
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