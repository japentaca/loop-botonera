import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useScales, useMusic } from '../composables/useMusic'
import { useNotesMatrix } from '../composables/useNotesMatrix'
import { useMelodicGenerator } from '../composables/useMelodicGenerator'

// Importar los nuevos módulos especializados
import { useAudioEngine } from './modules/audioEngine'
import { useLoopManager } from './modules/loopManager'
import { useEnergyManager } from './modules/energyManager'
import { useEvolutionSystem } from './modules/evolutionSystem'

// Debounce utility function for performance optimization
const debounce = (fn, delay) => {
  let timeoutId = null
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Importar presetStore para disparar auto-guardado cuando hay cambios
// Se importa aquí para evitar dependencias circulares, se usa solo cuando es necesario
let presetStoreInstance = null
const getPresetStore = async () => {
  if (!presetStoreInstance) {
    // Importación dinámica para evitar problemas de ciclo de dependencias
    const { usePresetStore } = await import('./presetStore')
    presetStoreInstance = usePresetStore()
  }
  return presetStoreInstance
}

// Función centralizada para notificar cambios al presetStore
// Debounced to avoid excessive calls during rapid parameter changes
const notifyPresetChanges = debounce(() => {
  // Ejecutar de forma asíncrona pero sin bloquear
  Promise.resolve().then(async () => {
    const presetStore = await getPresetStore()
    presetStore.handleChange()
  })
}, 300) // 300ms debounce delay

export const useAudioStore = defineStore('audio', () => {
  // Inicializar matriz de notas centralizada primero
  const notesMatrix = useNotesMatrix()

  // Inicializar módulos especializados con acceso a la matriz
  const audioEngine = useAudioEngine()
  const loopManager = useLoopManager(notesMatrix)
  const energyManager = useEnergyManager(notesMatrix)
  // Ensure energy manager knows the configured number of loops from loopManager
  if (typeof energyManager.updateNumLoops === 'function') {
    energyManager.updateNumLoops(loopManager.NUM_LOOPS)
  }

  // Inicializar generador melódico con acceso a la matriz
  const melodicGenerator = useMelodicGenerator(notesMatrix)

  const evolutionSystem = useEvolutionSystem(notesMatrix, melodicGenerator)

  // Performance optimization: maintain cache of active loop IDs
  // Updated whenever a loop's active state changes
  let cachedActiveLoopIndices = new Set()

  const updateActiveLoopsCache = () => {
    cachedActiveLoopIndices.clear()
    loopManager.loops.value.forEach((loop, idx) => {
      if (loop.isActive) {
        cachedActiveLoopIndices.add(idx)
      }
    })
  }

  const addActiveLoopToCache = (loopId) => {
    cachedActiveLoopIndices.add(loopId)
  }

  const removeActiveLoopFromCache = (loopId) => {
    cachedActiveLoopIndices.delete(loopId)
  }

  // Debounced energy balance check to avoid excessive calculations during rapid param changes
  // OPTIMIZED: Increased debounce delay to reduce main thread blocking
  const debouncedEnergyCheck = debounce((loops) => {
    energyManager.checkAndBalanceEnergy(loops)
  }, 750) // OPTIMIZED: increased from 500ms to 750ms to reduce 140ms blocking tasks

  // Dynamic density application (debounced to avoid thrash)
  const DENSITY_DEBOUNCE_MS = 250
  const applyDynamicDensities = debounce(() => {
    try {
      const loops = loopManager.loops.value
      const density = energyManager.computeDynamicDensity(loops)

      // Update each active, unlocked loop
      for (let i = 0; i < loops.length; i++) {
        const loop = loops[i]
        if (!loop || !loop.isActive) continue

        const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loop.id]
        if (meta && meta.generationMode === 'locked') continue

        // Persist density in metadata only (no regeneration here)
        if (notesMatrix.updateLoopMetadata) {
          notesMatrix.updateLoopMetadata(loop.id, { density })
        }
      }
    } catch (err) {
      console.error('[applyDynamicDensities] error', err)
    }
  }, DENSITY_DEBOUNCE_MS)

  // Estado específico del store principal (coordinación entre módulos)
  const currentScale = ref('major') // Default scale - must be set before loop initialization

  // Estado de evolución automática (coordinación entre módulos)
  const autoEvolve = ref(false)
  const measuresSinceEvolve = ref(0)
  const nextEvolveMeasure = ref(0)
  const scaleLocked = ref(false)
  const recentScales = ref([])
  const isTensionPhase = ref(false)
  const lastResponderId = ref(null)
  const lastCallerId = ref(null)
  const evolveStartTime = ref(0)
  const momentumLevel = ref(0)
  const momentumMaxLevel = ref(5)
  let evolveIntervalId = null

  // Configuración de modos creativos
  const evolveMode = ref('classic')
  const momentumEnabled = ref(false)
  const callResponseEnabled = ref(false)
  const tensionReleaseMode = ref(false)

  // Computed properties que combinan datos de múltiples módulos
  const scales = computed(() => {
    const { scales: scalesList } = useScales()
    return scalesList
  })

  const synthTypes = computed(() => ['sine', 'square', 'sawtooth', 'triangle'])

  // Funciones principales que coordinan entre módulos

  // Función para reproducir loops activos en cada pulso
  // Optimized to use cached active loop indices instead of filtering
  const playActiveLoops = (time, pulse) => {
    const loops = loopManager.loops.value

    // Use cached indices instead of filtering (called 16x/second)
    cachedActiveLoopIndices.forEach(loopId => {
      const loop = loops[loopId]
      if (loop && loop.isActive) { // Safety check
        const step = (pulse - 1) % loop.length
        loopManager.playLoopNote(loop, audioEngine, step, time)
      }
    })
  }

  // Inicialización de audio
  let audioStoreInitializing = false
  const initAudio = async () => {

    // Prevent multiple concurrent initializations
    if (audioStoreInitializing) {
      return
    }

    audioStoreInitializing = true

    // Step 1: Initialize only Tone.js audio engine
    await audioEngine.initAudio()

    // Step 2: Setup transport callback (but don't initialize loops yet)
    audioEngine.setupTransportCallback(playActiveLoops)

    audioStoreInitializing = false
    return true
  }

  // Initialize music components after preset is loaded
  const initMusicComponents = async () => {
    // Initialize loops with the current scale
    loopManager.initializeLoops(currentScale.value, audioEngine)

    // Initialize active loops cache
    updateActiveLoopsCache()
  }

  // Control de reproducción
  const togglePlay = () => {
    audioEngine.togglePlay()

    if (audioEngine.isPlaying.value && autoEvolve.value) {
      startAutoEvolve()
    } else if (!audioEngine.isPlaying.value) {
      stopAutoEvolve()
    }
  }

  // Resetear contadores de loops para re-sincronizar
  const resetLoopCounters = () => {
    audioEngine.resetCounters()
  }

  // Control de loops
  const toggleLoop = (id) => {
    loopManager.toggleLoop(id)

    // Update active loops cache
    const loop = loopManager.loops.value[id]
    if (loop.isActive) {
      addActiveLoopToCache(id)
    } else {
      removeActiveLoopFromCache(id)
    }

    // Aplicar gestión de energía después de cambios
    if (energyManager.energyManagementEnabled.value) {
      energyManager.adjustAllLoopVolumes(loopManager.loops.value)
    }

    // Apply dynamic densities (debounced)
    applyDynamicDensities()

    // Notificar cambios para auto-guardado
    notifyPresetChanges()
  }

  // Establecer explícitamente el estado activo de un loop (idempotente)
  const setLoopActive = (id, active) => {
    const loop = loopManager.loops.value[id]
    const desired = Boolean(active)
    if (loop.isActive === desired) return

    // Usar la misma ruta que toggle para mantener sincronización con la matriz
    loopManager.toggleLoop(id)

    // Update active loops cache
    if (desired) {
      addActiveLoopToCache(id)
    } else {
      removeActiveLoopFromCache(id)
    }

    // Ajustar energía tras el cambio
    if (energyManager.energyManagementEnabled.value) {
      energyManager.adjustAllLoopVolumes(loopManager.loops.value)
    }

    // Apply dynamic densities (debounced)
    applyDynamicDensities()

    // Notificar cambios (será ignorado si el presetStore está cargando)
    notifyPresetChanges()
  }

  // Actualizar parámetros de loop
  const updateLoopParam = (id, param, value) => {
    const loop = loopManager.loops.value[id]
    const oldValue = loop[param]

    loopManager.updateLoopParam(id, param, value)

    // Only trigger energy check if volume changed meaningfully (>1% instead of 5%)
    // This reduces unnecessary debounce calls when sliders are dragged
    // OPTIMIZED: Reduced threshold to 1% for smoother response but still batched
    if (param === 'volume' && oldValue !== undefined && Math.abs(oldValue - value) > 0.01) {
      debouncedEnergyCheck(loopManager.loops.value)
    }

    // Disparar notificación de cambios para activar auto-guardado en el preset
    notifyPresetChanges()
  }

  // Actualizar configuración del sintetizador
  const updateLoopSynth = (loopId, synthConfig) => {
    loopManager.updateLoopSynth(loopId, synthConfig, audioEngine)

    // Disparar notificación de cambios para activar auto-guardado en el preset
    notifyPresetChanges()
  }

  // Actualizar metadata del loop (patrones, rangos de notas, etc.)
  const updateLoopMetadata = (loopId, metadata) => {
    notesMatrix.updateLoopMetadata(loopId, metadata)

    // Disparar notificación de cambios para activar auto-guardado en el preset
    notifyPresetChanges()
  }

  // Regenerar loop individual
  const regenerateLoop = (id) => {
    if (!audioEngine.audioInitialized.value) return

    const scale = useScales().getScale(currentScale.value)
    const adaptiveDensity = energyManager.getAdaptiveDensity(loopManager.loops.value)
    const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, id)

    // Pass both scale intervals and scale name, plus current pulse for step reset
    loopManager.regenerateLoop(id, scale, currentScale.value, adaptiveDensity, adaptiveVolume, audioEngine.currentPulse.value)
  }

  // Regenerar todos los loops
  const regenerateAllLoops = () => {
    if (!audioEngine.audioInitialized.value) return

    const scale = useScales().getScale(currentScale.value)
    const currentPulse = audioEngine.currentPulse.value

    for (let i = 0; i < loopManager.NUM_LOOPS; i++) {
      const adaptiveDensity = energyManager.getAdaptiveDensity(loopManager.loops.value)
      const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, i)
      // Pass both scale intervals and scale name, plus current pulse for step reset
      loopManager.regenerateLoop(i, scale, currentScale.value, adaptiveDensity, adaptiveVolume, currentPulse)
    }

    // Ajustar volúmenes después de regenerar todos
    energyManager.adjustAllLoopVolumes(loopManager.loops.value)
  }

  // Regenerar loop individual con generación melódica
  const regenerateLoopMelody = (loopId) => {
    if (!audioEngine.audioInitialized.value) return
    if (loopId >= loopManager.NUM_LOOPS) return

    melodicGenerator.regenerateLoop(loopId, audioEngine.currentPulse.value)
  }

  // Regenerar todas las melodías
  const regenerateAllMelodies = () => {
    if (!audioEngine.audioInitialized.value) {
      console.warn('[regenerateAllMelodies] Audio not initialized')
      return
    }

    console.log('[regenerateAllMelodies] Starting regeneration of all active loops')
    melodicGenerator.regenerateAllLoops(audioEngine.currentPulse.value)
  }

  const logNotesMatrix = () => {
    const activeIds = loopManager.loops.value.filter(l => l && l.isActive).map(l => l.id)
    const payload = activeIds.map(id => ({ id, notes: notesMatrix.getLoopNotes(id) }))
    console.log('[NotesMatrix]', payload)
  }

  // Distribución panorámica
  const applySparseDistribution = () => {
    if (!audioEngine.audioInitialized.value) return
    loopManager.applySparseDistribution()
  }

  // Control de tempo
  const updateTempo = (newTempo) => {
    audioEngine.updateTempo(newTempo)
    notifyPresetChanges()
  }

  // Control de volumen maestro
  const updateMasterVolume = (volume) => {
    audioEngine.updateMasterVolume(volume)
    notifyPresetChanges()
  }

  // Actualizar escala musical
  const updateScale = (newScale) => {
    const scale = useScales().getScale(newScale)
    if (!scale) {
      console.error(`[updateScale] Invalid scale name: "${newScale}"`)
      return
    }

    console.log(`[updateScale] Changing global scale from "${currentScale.value}" to "${newScale}", intervals: [${scale}]`)
    currentScale.value = newScale

    // Scale is now managed by audioStore only - removed setGlobalScale call

    if (!audioEngine.audioInitialized.value) {
      console.log('[updateScale] Audio not initialized, only updating scale reference')
      return
    }

    // Cuantizar notas existentes manteniendo patrón y baseNote
    // Pass both scale intervals and scale name to loopManager
    console.log(`[updateScale] Quantizing ${loopManager.loops.value.length} loops to new scale`)
    loopManager.loops.value.forEach(loop => {
      loopManager.quantizeLoopNotes(loop, scale, newScale)
    })

    console.log(`[updateScale] Scale update complete, all loops now using "${newScale}"`)
    notifyPresetChanges()
  }

  if (typeof window !== 'undefined') {
    window.__LOOP_DEBUG = true
    window.__DBG = {
      getMeta: (id) => notesMatrix.loopMetadata[id],
      getNotes: (id) => notesMatrix.getLoopNotes(id),
      setMeta: (id, updates) => notesMatrix.updateLoopMetadata(id, updates),
      loops: loopManager.loops,
      selectPatternType: (id) => melodicGenerator.selectPatternType ? melodicGenerator.selectPatternType(id) : null,
      regenerate: (id) => melodicGenerator.regenerateLoop(id, audioEngine.currentPulse.value)
    }
  }

  // Actualizar división del delay
  const updateDelayDivision = (division) => {
    audioEngine.updateDelayDivision(division)
    notifyPresetChanges()
  }

  // Sistema de evolución automática

  const getRandomScale = (excludeScale = null) => {
    const { scales: scalesList } = useScales()
    const availableScales = Object.keys(scalesList).filter(scale =>
      scale !== excludeScale && !recentScales.value.includes(scale)
    )
    if (availableScales.length === 0) {
      return Object.keys(scalesList).find(scale => scale !== excludeScale) || 'major'
    }
    return availableScales[Math.floor(Math.random() * availableScales.length)]
  }

  const getRelatedScale = (currentScale) => {
    const { getRelatedScale: getMusicRelatedScale } = useMusic()
    return getMusicRelatedScale(currentScale) || getRandomScale(currentScale)
  }

  const selectRandomLoops = (count) => {
    const activeLoops = loopManager.loops.value.filter(loop => loop.isActive)
    if (activeLoops.length === 0) return []

    const selected = []
    const available = [...activeLoops]
    const numToSelect = Math.min(count, available.length)

    for (let i = 0; i < numToSelect; i++) {
      const randomIndex = Math.floor(Math.random() * available.length)
      selected.push(available[randomIndex])
      available.splice(randomIndex, 1)
    }

    return selected
  }

  // Aplicar momentum usando el sistema de evolución
  const applyMomentum = () => {
    if (!momentumEnabled.value) return
    const elapsedSec = (Date.now() - evolveStartTime.value) / 1000
    const targetLevel = (evolutionSystem.evolutionIntensity.value * 10) < Math.floor(elapsedSec / 10) ? evolutionSystem.evolutionIntensity.value * 10 : Math.floor(elapsedSec / 10)
    if (targetLevel > momentumLevel.value) {
      momentumLevel.value = targetLevel
      // Eliminado: modificación automática del intervalo de evolución
      // Eliminado: modificación automática de la intensidad de evolución
      // El momentum solo debe actualizar su propio nivel, no los parámetros de evolución
    }
  }

  // Tensión/Release usando el sistema de evolución
  const applyTensionRelease = () => {
    const { getConsonantScale, getDissonantScale } = useMusic()
    isTensionPhase.value = !isTensionPhase.value
    const recent = [...recentScales.value]
    if (isTensionPhase.value) {
      return getDissonantScale(currentScale.value, recent)
    } else {
      return getConsonantScale(currentScale.value, recent)
    }
  }

  // Call & Response usando el sistema de evolución
  const applyCallResponse = (loopsToReharmonize) => {
    if (!Array.isArray(loopsToReharmonize) || loopsToReharmonize.length === 0) return loopsToReharmonize

    // Elegir respondedor distinto al anterior
    const candidates = loopsToReharmonize.filter(l => l.id !== lastResponderId.value)
    const responder = (candidates.length ? candidates : loopsToReharmonize)[0]
    lastResponderId.value = responder?.id ?? null

    // Elegir caller entre loops activos distintos del respondedor y del último caller
    const activeLoops = loopManager.loops.value.filter(loop => loop.isActive && loop.id !== responder?.id)
    const callerCandidates = activeLoops.filter(l => l.id !== lastCallerId.value)
    const pickCaller = (list) => {
      if (!list.length) return null

      const densityForLoop = (loop) => {
        if (!loop) return 0
        try {
          return notesMatrix.getLoopNoteDensity(loop.id) || 0
        } catch (error) {
          console.warn('No se pudo obtener densidad del loop', loop.id, error)
          return 0
        }
      }

      return list.reduce((best, loop) => {
        const candidateDensity = densityForLoop(loop)
        const bestDensity = densityForLoop(best)
        return candidateDensity > bestDensity ? loop : best
      }, null) || list[0]
    }
    const caller = pickCaller(callerCandidates.length ? callerCandidates : activeLoops)
    lastCallerId.value = caller?.id ?? null

    const scale = useScales().getScale(currentScale.value)
    if (!scale) {
      console.error(`No scale found for currentScale: "${currentScale.value}"`)
      throw new Error(`Invalid current scale: "${currentScale.value}"`)
    }

    // Fijar base del respondedor cercana a la del caller si existe, con pequeña variación de octava
    const baseNotes = [36, 48, 60, 72]
    const baseFromCaller = (caller?.baseNote ?? null)
    const octaveShift = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 12 : -12)
    const chosenBase = baseFromCaller ? (baseFromCaller + octaveShift)
      : baseNotes[Math.floor(Math.random() * baseNotes.length)]
    responder.baseNote = chosenBase

    // Generar respuesta derivada del caller si existe; en su defecto, generar notas en rango
    let responseNotes
    if (caller) {
      responseNotes = loopManager.generateResponseFromCall(caller, responder, scale, responder.baseNote)
    } else {
      responseNotes = loopManager.generateLoopMelodyFor(responder.id, {})
    }

    // Guardar las notas en la matriz centralizada
    notesMatrix.setLoopNotes(responder.id, responseNotes)

    return loopsToReharmonize
  }

  // Evolución musical principal
  const evolveMusic = async () => {
    if (!audioEngine.audioInitialized.value) return

    // Iniciar modo batch para evitar múltiples autosaves durante evolución
    const presetStore = await getPresetStore()
    if (presetStore && presetStore.startBatchMode) {
      presetStore.startBatchMode()
    }

    try {
      // Aplicar momentum si está activado
      applyMomentum()

      let newScale = currentScale.value
      let oldScale = currentScale.value

      // Seleccionar nueva escala según el modo solo si no está bloqueada
      if (!scaleLocked.value) {
        switch (evolveMode.value) {
          case 'momentum':
            newScale = getRandomScale(currentScale.value)
            break
          case 'callResponse':
            newScale = getRelatedScale(currentScale.value)
            break
          case 'tensionRelease':
            const tensionScale = applyTensionRelease()
            newScale = tensionScale || getRandomScale(currentScale.value)
            break
          default: // classic
            // Si Call & Response está activado, usar una escala relacionada para mantener coherencia
            newScale = callResponseEnabled.value
              ? getRelatedScale(currentScale.value)
              : getRandomScale(currentScale.value)
        }

        // Actualizar historial de escalas solo si cambió
        if (newScale !== oldScale) {
          recentScales.value.push(newScale)
          if (recentScales.value.length > 3) {
            recentScales.value.shift()
          }
          updateScale(newScale)
        }
      }

      // Usar el sistema de evolución para evolucionar loops
      // Pass the global scale intervals instead of availableScales
      const currentScaleIntervals = useScales().getScale(currentScale.value)

      // Excluir reverb y delay de la evolución cuando se están aplicando cambios de estilo
      const isStyleChange = momentumEnabled.value || callResponseEnabled.value || tensionReleaseMode.value
      const evolutionOptions = isStyleChange ? { excludeReverb: true, excludeDelay: true } : {}

      const evolvedLoops = evolutionSystem.evolveMultipleLoops(loopManager.loops.value, currentScaleIntervals, evolutionOptions)

      // Aplicar call & response si está activado
      if (evolveMode.value === 'callResponse' || callResponseEnabled.value) {
        const loopsToReharmonize = selectRandomLoops(Math.ceil(evolutionSystem.evolutionIntensity.value * 5))
        applyCallResponse(loopsToReharmonize)
      }

      // Actualizar loops con las evoluciones
      evolvedLoops.forEach((evolvedLoop, index) => {
        if (evolvedLoop !== loopManager.loops.value[index]) {
          Object.assign(loopManager.loops.value[index], evolvedLoop)
        }
      })

      // Aplicar gestión de energía después de la evolución
      energyManager.checkAndBalanceEnergy(loopManager.loops.value)

      // Resetear contador
      measuresSinceEvolve.value = 0
      nextEvolveMeasure.value = audioEngine.currentPulse.value + (evolutionSystem.evolutionInterval.value * 16)

      const modeInfo = evolveMode.value !== 'classic' ? ` [${evolveMode.value}]` : ''
      const tensionInfo = tensionReleaseMode.value ? (isTensionPhase.value ? ' (tensión)' : ' (release)') : ''
    } finally {
      // Finalizar modo batch y guardar una sola vez si no está en autoEvolve
      if (presetStore && presetStore.endBatchMode) {
        // Solo autosave si no está en modo autoEvolve continuo
        presetStore.endBatchMode(!autoEvolve.value)
      }
    }
  }

  const checkEvolve = () => {
    if (!autoEvolve.value || !audioEngine.isPlaying.value) return

    // Verificar evolución basada en compases musicales
    const currentMeasure = Math.floor(audioEngine.currentPulse.value / 16)
    const targetMeasure = Math.floor(nextEvolveMeasure.value / 16)

    if (currentMeasure >= targetMeasure) {
      evolveMusic()
      // Calcular próxima evolución: simplemente sumar el intervalo en compases
      const measuresInterval = evolutionSystem.evolutionInterval.value
      nextEvolveMeasure.value = audioEngine.currentPulse.value + (measuresInterval * 16)
      measuresSinceEvolve.value = 0
    }
  }

  const startAutoEvolve = () => {
    if (evolveIntervalId) return

    autoEvolve.value = true
    evolutionSystem.updateEvolutionSettings({ enabled: true })
    measuresSinceEvolve.value = 0

    // Calcular próxima evolución: simplemente sumar el intervalo en compases
    const measuresInterval = evolutionSystem.evolutionInterval.value
    nextEvolveMeasure.value = audioEngine.currentPulse.value + (evolutionSystem.evolutionInterval.value * 16)

    evolveStartTime.value = Date.now()
    momentumLevel.value = 0

    evolveIntervalId = setInterval(() => {
      if (audioEngine.isPlaying.value) {
        checkEvolve()
      }
    }, 100)
  }

  const stopAutoEvolve = async () => {
    autoEvolve.value = false
    evolutionSystem.updateEvolutionSettings({ enabled: false })
    if (evolveIntervalId) {
      clearInterval(evolveIntervalId)
      evolveIntervalId = null
    }

    // Finalizar modo batch y guardar cuando se detiene la evolución automática
    const presetStore = await getPresetStore()
    if (presetStore && presetStore.endBatchMode) {
      await presetStore.endBatchMode(true) // Forzar guardado al detener
    } else {
      // Fallback si no hay batch mode
      notifyPresetChanges()
    }
  }

  const updateEvolveInterval = (interval) => {
    //console.log('🔄 updateEvolveInterval called:', interval)
    const measuresInterval = Math.max(2, Math.min(32, Number(interval))) // límites en compases
    evolutionSystem.updateEvolutionSettings({ interval: measuresInterval })
    if (autoEvolve.value) {
      // Recalcular próxima evolución: simplemente sumar el nuevo intervalo en compases
      nextEvolveMeasure.value = audioEngine.currentPulse.value + (measuresInterval * 16)
    }
    notifyPresetChanges()
  }

  const updateEvolveIntensity = (intensity) => {
    //console.log('🔄 updateEvolveIntensity called:', intensity)
    const normalizedIntensity = Number(intensity) / 10
    evolutionSystem.updateEvolutionSettings({ intensity: normalizedIntensity })
    notifyPresetChanges()
  }

  const updateMomentumMaxLevel = (level) => {
    //console.log('🔄 updateMomentumMaxLevel called:', level)
    momentumMaxLevel.value = Number(level)
    notifyPresetChanges()
  }

  // Control de modos creativos
  const setEvolveMode = (mode) => {
    const validModes = ['classic', 'momentum', 'callResponse', 'tensionRelease']
    if (validModes.includes(mode)) {
      evolveMode.value = mode
    }
  }

  const setMomentumEnabled = (enabled) => {
    momentumEnabled.value = Boolean(enabled)
    if (enabled) {
      evolveStartTime.value = Date.now()
      momentumLevel.value = 0
    }
    notifyPresetChanges()
  }

  const setCallResponseEnabled = (enabled) => {
    callResponseEnabled.value = Boolean(enabled)
    if (!enabled) {
      lastResponderId.value = null
      lastCallerId.value = null
    }
    notifyPresetChanges()
  }

  const setTensionReleaseMode = (enabled) => {
    tensionReleaseMode.value = Boolean(enabled)
    if (enabled) {
      isTensionPhase.value = false
    }
    notifyPresetChanges()
  }

  const toggleScaleLock = () => {
    scaleLocked.value = !scaleLocked.value
    notifyPresetChanges()
  }

  // Wrappers for energy management functions to notify preset changes
  const updateEnergyManagementWrapper = (enabled) => {
    energyManager.updateEnergyManagement(enabled)
    notifyPresetChanges()
  }

  const updateMaxSonicEnergyWrapper = (value) => {
    //console.log('🔄 updateMaxSonicEnergy called:', value)
    energyManager.updateMaxSonicEnergy(value)
    notifyPresetChanges()
  }

  const updateEnergyReductionFactorWrapper = (value) => {
    //console.log('🔄 updateEnergyReductionFactor called:', value)
    energyManager.updateEnergyReductionFactor(value)
    notifyPresetChanges()
  }

  return {
    // Estado del motor de audio
    audioInitialized: audioEngine.audioInitialized,
    isPlaying: audioEngine.isPlaying,
    currentPulse: audioEngine.currentPulse,
    currentBeat: audioEngine.currentBeat,
    beatFlash: audioEngine.beatFlash,
    tempo: audioEngine.tempo,
    masterVol: audioEngine.masterVol,
    masterVolume: audioEngine.masterVolume,
    delayDivision: audioEngine.delayDivision,

    // Estado de loops
    loops: loopManager.loops,

    // Estado de escalas
    currentScale,
    scales,
    scaleNames: computed(() => {
      const { scaleNames } = useScales()
      return scaleNames.value
    }),
    synthTypes,
    getScale: (scaleName) => useScales().getScale(scaleName),

    // Estado de evolución automática
    autoEvolve,
    evolveInterval: computed(() => evolutionSystem.evolutionInterval.value), // intervalo en compases
    evolveIntensity: computed(() => evolutionSystem.evolutionIntensity.value * 10), // convertir para compatibilidad
    measuresSinceEvolve,
    nextEvolveMeasure,
    scaleLocked,
    momentumMaxLevel,
    momentumEnabled,
    callResponseEnabled,
    tensionReleaseMode,

    // Estado de gestión de energía
    energyManagementEnabled: energyManager.energyManagementEnabled,
    maxSonicEnergy: energyManager.maxSonicEnergy,
    energyReductionFactor: energyManager.energyReductionFactor,

    // Funciones principales
    initAudio,
    initMusicComponents,
    togglePlay,
    toggleLoop,
    setLoopActive,
    updateLoopParam,
    updateLoopSynth,
    regenerateLoop,
    regenerateAllLoops,
    regenerateLoopMelody,
    regenerateAllMelodies,
    logNotesMatrix,
    applySparseDistribution,
    updateTempo,
    updateMasterVolume,
    updateScale,
    updateDelayDivision,
    // Sincronización
    resetLoopCounters,

    // Funciones de evolución automática
    startAutoEvolve,
    stopAutoEvolve,
    updateEvolveInterval,
    updateEvolveIntensity,
    updateMomentumMaxLevel,
    evolveMusic,

    // Funciones de evolución con matriz
    evolveMatrixLoop: evolutionSystem.evolveMatrixLoop,
    evolveMultipleMatrixLoops: evolutionSystem.evolveMultipleMatrixLoops,
    applyMatrixMutation: evolutionSystem.applyMatrixMutation,
    evolveMatrixWithStrategy: evolutionSystem.evolveMatrixWithStrategy,

    // Funciones auxiliares para modos creativos
    setEvolveMode,
    setMomentumEnabled,
    setCallResponseEnabled,
    setTensionReleaseMode,
    toggleScaleLock,

    // Funciones de gestión de energía sonora
    calculateSonicEnergy: energyManager.calculateSonicEnergy,
    getAdaptiveDensity: energyManager.getAdaptiveDensity,
    getAdaptiveVolume: energyManager.getAdaptiveVolume,
    adjustAllLoopVolumes: () => energyManager.adjustAllLoopVolumes(loopManager.loops.value),

    // Expose loopManager for preset operations
    loopManager,

    // Cache management
    updateActiveLoopsCache,

    // Configuración de energía sonora
    updateEnergyManagement: updateEnergyManagementWrapper,
    updateMaxSonicEnergy: updateMaxSonicEnergyWrapper,
    updateEnergyReductionFactor: updateEnergyReductionFactorWrapper,

    // Central notes matrix (composable) — expose the composable object itself
    notesMatrix,
    // Keep convenient accessors for metadata/state where useful
    loopMetadata: notesMatrix.loopMetadata,
    matrixState: notesMatrix.matrixState,
    initializeMatrix: notesMatrix.initializeMatrix,
    // Keep updateLoopMetadata as it's implemented on audioStore and used elsewhere
    updateLoopMetadata,
  }
})
