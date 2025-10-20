import { ref, computed } from 'vue'

/**
 * Sistema de evolución automática que modifica loops de forma inteligente
 * para crear variaciones musicales dinámicas
 */
export const useEvolutionSystem = () => {
  // Estado de evolución automática
  const autoEvolutionEnabled = ref(false)
  const evolutionInterval = ref(8000) // intervalo en milisegundos
  const evolutionIntensity = ref(0.3) // intensidad de los cambios (0-1)
  const creativeModeEnabled = ref(false)
  const lastEvolutionTime = ref(0)
  
  // Configuración de tipos de evolución
  const evolutionTypes = ref({
    pattern: true,      // evolucionar patrones rítmicos
    notes: true,        // evolucionar notas/melodías
    effects: true,      // evolucionar efectos
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

  // Generar variación de efectos
  const evolveEffects = (currentEffects, intensity = evolutionIntensity.value) => {
    if (!evolutionTypes.value.effects) return currentEffects
    
    const newEffects = { ...currentEffects }
    
    if (Math.random() < mutationProbabilities.value.effectChange * intensity) {
      // Evolucionar delay
      if (newEffects.delayAmount !== undefined) {
        const change = (Math.random() - 0.5) * 0.3 * intensity
        newEffects.delayAmount = Math.max(0, Math.min(1, newEffects.delayAmount + change))
      }
      
      // Evolucionar reverb
      if (newEffects.reverbAmount !== undefined) {
        const change = (Math.random() - 0.5) * 0.4 * intensity
        newEffects.reverbAmount = Math.max(0, Math.min(1, newEffects.reverbAmount + change))
      }
    }
    
    return newEffects
  }

  // Aplicar evolución creativa más experimental
  const applyCreativeEvolution = (loop, availableScales) => {
    if (!creativeModeEnabled.value) return loop
    
    const evolvedLoop = { ...loop }
    
    // Cambio de escala ocasional en modo creativo
    if (Math.random() < 0.1 && availableScales && availableScales.length > 1) {
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
  const evolveLoop = (loop, availableScales = null) => {
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
    
    // Evolución de efectos
    if (evolutionTypes.value.effects) {
      const effects = {
        delayAmount: evolvedLoop.delayAmount,
        reverbAmount: evolvedLoop.reverbAmount
      }
      const evolvedEffects = evolveEffects(effects)
      evolvedLoop.delayAmount = evolvedEffects.delayAmount
      evolvedLoop.reverbAmount = evolvedEffects.reverbAmount
    }
    
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
  const evolveMultipleLoops = (loops, availableScales = null) => {
    const activeLoops = loops.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return loops
    
    // Seleccionar loops para evolucionar basado en la intensidad
    const loopsToEvolve = Math.max(1, Math.floor(activeLoops.length * evolutionIntensity.value))
    const selectedLoops = activeLoops
      .sort(() => Math.random() - 0.5)
      .slice(0, loopsToEvolve)
    
    return loops.map(loop => {
      if (selectedLoops.includes(loop)) {
        return evolveLoop(loop, availableScales)
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
      evolutionInterval.value = Math.max(1000, Math.min(60000, settings.interval))
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
  const forceEvolution = (loops, availableScales = null) => {
    const evolvedLoops = evolveMultipleLoops(loops, availableScales)
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

  return {
    // Estado
    autoEvolutionEnabled,
    evolutionInterval,
    evolutionIntensity,
    creativeModeEnabled,
    evolutionTypes,
    mutationProbabilities,
    
    // Funciones de evolución
    evolveLoop,
    evolveMultipleLoops,
    evolveByInstrumentType,
    forceEvolution,
    
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