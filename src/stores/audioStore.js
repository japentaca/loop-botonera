import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useScales, useMusic } from '../composables/useMusic.js'
import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { startCycle, stopCycle, stepCycle, pauseCycle, resumeCycle, listCycles, subscribe as subscribeTonalCycles } from '../modules/tonalCycles.js'

// Importar los nuevos módulos especializados
import { useAudioEngine } from './modules/audioEngine.js'
import { useLoopManager } from './modules/loopManager.js'
import { useEnergyManager } from './modules/energyManager.js'
import { useEvolutionSystem } from './modules/evolutionSystem.js'

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
    const { usePresetStore } = await import('./presetStore.js')
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



  const evolutionSystem = useEvolutionSystem(notesMatrix)

  // Tonal cycles reactive list
  const tonalCyclesList = ref(listCycles() || [])
  // Subscribe to changes in tonalCycles
  try {
    subscribeTonalCycles((list) => {
      tonalCyclesList.value = list || []
    })
  } catch (err) {
    console.warn('[audioStore] subscribeTonalCycles failed', err)
  }

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
  // Apply the global density bias as a master setting, evenly split among all active auto-mode loops.
  // The bias is always applied regardless of the energy manager "enabled" flag. However, the
  // distribution will be scaled if predicted sonic energy (manual + auto) exceeds maxSonicEnergy.
  const applyDynamicDensities = debounce(() => {
    try {
      const loops = loopManager.loops.value
      if (!Array.isArray(loops) || loops.length === 0) return

      // Determine active loops and whether they accept auto density
      const activeLoops = loops.filter(l => l && l.isActive)
      const autoTargets = activeLoops.filter(l => {
        const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[l.id]
        return meta && meta.densityMode !== 'manual'
      })
      const manualTargets = activeLoops.filter(l => {
        const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[l.id]
        return meta && meta.densityMode === 'manual'
      })

      // Inactive or no auto-targets -> nothing to do
      if (autoTargets.length === 0) return

      // Base per-loop density from global bias (even split)
      const basePerLoopDensity = Math.max(0, Math.min(1, Number(globalDensityBias.value || 0))) / autoTargets.length

      // Compute predicted energies (manual loops use their manualDensity) so we can scale auto densities
      const REFERENCE_LENGTH = 16
      // manual energy sum
      let manualEnergySum = 0
      for (const loop of manualTargets) {
        const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loop.id]
        if (!meta) continue
        const val = typeof meta.manualDensity === 'number' ? meta.manualDensity : (typeof meta.density === 'number' ? meta.density : 0)
        const lengthFactor = REFERENCE_LENGTH / (loop.length || REFERENCE_LENGTH)
        const volumeContrib = (typeof loop.volume === 'number' ? loop.volume : 0)
        manualEnergySum += val * volumeContrib * lengthFactor
      }

      // predicted auto energy based on basePerLoopDensity
      let predictedAutoEnergySum = 0
      for (const loop of autoTargets) {
        const lengthFactor = REFERENCE_LENGTH / (loop.length || REFERENCE_LENGTH)
        const volumeContrib = (typeof loop.volume === 'number' ? loop.volume : 0)
        predictedAutoEnergySum += basePerLoopDensity * volumeContrib * lengthFactor
      }

      // If manual loops already exceed maxSonicEnergy, set auto densities to zero
      const availableEnergy = Math.max(0, (energyManager.maxSonicEnergy && typeof energyManager.maxSonicEnergy.value === 'number') ? energyManager.maxSonicEnergy.value - manualEnergySum : Infinity)

      let scaleFactor = 1
      if (!isFinite(availableEnergy) && predictedAutoEnergySum <= 0) {
        scaleFactor = 1
      } else if (predictedAutoEnergySum <= 0) {
        scaleFactor = 0
      } else if (predictedAutoEnergySum > availableEnergy) {
        scaleFactor = availableEnergy / predictedAutoEnergySum
      }

      // Apply computed auto densities to auto-targets; keep manual ones untouched
      for (const loop of autoTargets) {
        const computedDensity = Math.max(0, Math.min(1, basePerLoopDensity * scaleFactor))
        const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loop.id]
        if (meta && notesMatrix.updateLoopMetadata) {
          notesMatrix.updateLoopMetadata(loop.id, { autoDensity: computedDensity, density: computedDensity })
        }
      }
    } catch (err) {
      console.error('[applyDynamicDensities] error', err)
    }
  }, DENSITY_DEBOUNCE_MS)

  // Estado específico del store principal (coordinación entre módulos)
  const currentScale = ref('major') // Default scale - must be set before loop initialization

  // Control global de densidad
  const globalDensityBias = ref(0.5)
  const updateGlobalDensityBias = (value) => {
    const v = Math.max(0, Math.min(1, Number(value)))
    globalDensityBias.value = v
    applyDynamicDensities()
    notifyPresetChanges()
  }

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
  // momentum removed - keep evolveStartTime as a timestamp used only for potential metrics
  let evolveIntervalId = null

  // Configuración de modos creativos
  // Removed creative modes: momentum, call/response, tension/release. Evolution scheduling is based on measures only.

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
    if (autoEvolve.value && (audioEngine.currentPulse.value % 16 === 0)) {
      checkEvolve()
    }
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

    // Apply global bias allocation to newly initialized active loops
    applyDynamicDensities()
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
      // Recompute auto densities when volume changes because sonic energy changes
      applyDynamicDensities()
    }

    // Re-evaluate auto density when a loop's length changes (affects energy per loop)
    if (param === 'length') {
      applyDynamicDensities()
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
    // Recompute auto densities whenever metadata changes (e.g., manual/auto mode toggles)
    applyDynamicDensities()

    // Disparar notificación de cambios para activar auto-guardado en el preset
    notifyPresetChanges()
  }

  // Regenerar loop individual
  const regenerateLoop = (id) => {

    const scale = useScales().getScale(currentScale.value)
    const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, id)

    // Pass both scale intervals and scale name, plus current pulse for step reset
    console.log('[Regeneration] regenerateLoop id=', id)
    loopManager.regenerateLoop(id, scale, currentScale.value, adaptiveVolume, audioEngine.currentPulse.value)
  }

  // Unified pattern generation API: read metadata from notesMatrix and generate accordingly
  const generateLoopPattern = (loopId) => {
    try {
      // Validate loop id
      if (typeof loopId !== 'number' || loopId >= loopManager.NUM_LOOPS) return

      // Prefer melodic generation if the metadata explicitly requests it (optional)
      const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loopId]
      const preferMelodic = meta && meta.generationMode === 'melodic'

      const currentPulse = audioEngine.currentPulse.value
      const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, loopId)

      if (preferMelodic && typeof melodicGenerator?.regenerateLoop === 'function') {
        // melodic generator can accept optional currentPulse; call centrally so UI/evolver never pass args
        // Silent mode avoids metadata changes
        melodicGenerator.regenerateLoop(loopId, currentPulse, { silent: true })
        return
      }

      // Default: matrix-based generator - use silent mode to prevent metadata updates
      if (typeof notesMatrix.generateLoopNotes === 'function') {
        notesMatrix.generateLoopNotes(loopId, { silent: true })
      }
    } catch (err) {
      console.error('[generateLoopPattern] error', err)
    }
  }

  // Regenerar todos los loops
  const regenerateAllLoops = () => {

    const scale = useScales().getScale(currentScale.value)
    const currentPulse = audioEngine.currentPulse.value
    const activeIds = loopManager.loops.value.filter(l => l && l.isActive).map(l => l.id)
    console.log('[Regeneration] regenerateAllLoops active=', activeIds)
    for (const i of activeIds) {
      const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, i)
      console.log('[Regeneration] regenerateAllLoops -> loop', i)
      loopManager.regenerateLoop(i, scale, currentScale.value, adaptiveVolume, currentPulse)
    }

    // Ajustar volúmenes después de regenerar todos
    energyManager.adjustAllLoopVolumes(loopManager.loops.value)
  }

  // Regenerar loop individual con generación melódica
  const regenerateLoopMelody = (loopId) => {
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

  // Generate patterns for all active loops via unified API
  const generateAllPatterns = () => {
    const activeIds = loopManager.loops.value.filter(l => l && l.isActive).map(l => l.id)
    activeIds.forEach(i => generateLoopPattern(i))
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
    if (newScale === currentScale.value) return
    const scale = useScales().getScale(newScale)
    if (!scale) {
      console.error(`[updateScale] Invalid scale name: "${newScale}"`)
      return
    }

    console.log(`${new Date().toISOString()} [updateScale] Changing global scale from "${currentScale.value}" to "${newScale}", intervals: [${scale}]`)
    currentScale.value = newScale

    // Scale is now managed by audioStore only - removed setGlobalScale call

    if (!audioEngine.audioInitialized.value) {
      console.log(`${new Date().toISOString()} [updateScale] Audio not initialized, only updating scale reference`)
      return
    }

    // Cuantizar notas existentes manteniendo patrón y baseNote
    // Pass both scale intervals and scale name to loopManager
    console.log(`${new Date().toISOString()} [updateScale] Quantizing ${loopManager.loops.value.length} loops to new scale`)
    loopManager.loops.value.forEach(loop => {
      loopManager.quantizeLoopNotes(loop, scale, newScale)
    })

    console.log(`${new Date().toISOString()} [updateScale] Scale update complete, all loops now using "${newScale}"`)
    notifyPresetChanges()
  }

  if (typeof window !== 'undefined') {
    window.__LOOP_DEBUG = true
    window.__DBG = {
      getMeta: (id) => notesMatrix.loopMetadata[id],
      getNotes: (id) => notesMatrix.getLoopNotes(id),
      setMeta: (id, updates) => notesMatrix.updateLoopMetadata(id, updates),
      loops: loopManager.loops,
      selectPatternType: (id) => notesMatrix.selectPatternType ? notesMatrix.selectPatternType(id) : null,
      regenerate: (id) => generateLoopPattern(id),
      setGenParams: (params) => { window.__DBG.__genParams = { ...params } },
      clearGenParams: () => { delete window.__DBG.__genParams },
      getGenParams: () => window.__DBG.__genParams || null
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
  // applyMomentum removed; momentum is not used anymore

  // Tensión/Release usando el sistema de evolución
  // applyTensionRelease removed - tension/release modes disabled

  // Call & Response usando el sistema de evolución
  // applyCallResponse removed - call & response disabled

  // Evolución musical principal
  const evolveMusic = async () => {
    if (!audioEngine.audioInitialized.value) return

    // Iniciar modo batch para evitar múltiples autosaves durante evolución
    const presetStore = await getPresetStore()
    if (presetStore && presetStore.startBatchMode) {
      presetStore.startBatchMode()
    }

    try {
      // No automated scale changes as part of evolution; evolution triggers pattern generation only

      const currentScaleIntervals = useScales().getScale(currentScale.value)
      const evolutionOptions = {}
      const intents = evolutionSystem.evolveMultipleLoops(loopManager.loops.value, currentScaleIntervals, evolutionOptions)

      const activeLoopsCount = loopManager.loops.value.filter(l => l.isActive).length
      const regenIntents = intents.filter(i => i.type === 'regenerate')
      const doGlobalRegeneration = regenIntents.length > Math.floor(activeLoopsCount / 2)
      // We intentionally DO NOT apply metadata updates from evolution intents here.
      // Evolver must never modify loop metadata - metadata changes must be explicit
      // user or preset actions. The intents array may contain regenerate/quantize
      // or mutation intents only.

      const start = performance.now()
      if (doGlobalRegeneration) {
        for (let loopId = 0; loopId < notesMatrix.MAX_LOOPS; loopId++) {
          const meta = notesMatrix.loopMetadata[loopId]
          if (meta && meta.isActive) {
            // Use unified API to generate loop patterns (no args, no metadata modifications)
            generateLoopPattern(loopId)
          }
        }
      } else {
        regenIntents.forEach(i => {
          // Use unified API for regeneration
          generateLoopPattern(i.loopId)
        })
      }

      // Apply mutation intents (if any) produced by the evolution system.
      intents.filter(i => i.type === 'mutate').forEach(i => {
        try {
          // If it's a matrix mutation, prefer evolution system utility
          if (evolutionSystem && typeof evolutionSystem.applyMatrixMutation === 'function') {
            // mutation object defines the type and params
            const m = i.mutation || {}
            const loopId = i.loopId
            const mutationType = m.mutationType || m.type
            evolutionSystem.applyMatrixMutation(loopId, notesMatrix, mutationType, m.params || {})
          } else {
            // Fallback: attempt to apply known mutations directly
            const m = i.mutation || {}
            const mutationType = m.mutationType || m.type
            switch (mutationType) {
              case 'transpose':
                notesMatrix.transposeLoop(i.loopId, m.params?.semitones || 0)
                break
              case 'rotate':
                notesMatrix.rotateLoop(i.loopId, m.params?.steps || 1)
                break
              case 'inverse':
                notesMatrix.inverseLoop(i.loopId, m.params?.centerNote || 60)
                break
              case 'mutate':
                if (notesMatrix && typeof notesMatrix.mutateLoop === 'function') {
                  notesMatrix.mutateLoop(i.loopId, { probability: m.params?.probability || 0.3 })
                }
                break
              default:
                console.warn('[Evolve] Unknown mutation type', mutationType)
            }
          }
        } catch (err) {
          console.error('[Evolve] apply mutation failed', err)
        }
      })

      // No metadata application step here to ensure evolver cannot alter metadata.

      // Quantize intents are ignored for evolution to avoid modifying metadata.

      // Call & Response, Tension/Release, momentum modes are disabled: evolution only regenerates/mutates loops

      // Aplicar gestión de energía después de la evolución
      energyManager.checkAndBalanceEnergy(loopManager.loops.value)

      // Resetear contador
      measuresSinceEvolve.value = 0
      nextEvolveMeasure.value = audioEngine.currentPulse.value + (evolutionSystem.evolutionInterval.value * 16)

      const modeInfo = ''
      const tensionInfo = ''
      const elapsed = performance.now() - start
      console.log(`Regeneration plan applied intents=${intents.length} regen=${doGlobalRegeneration ? 'global' : regenIntents.length} time=${elapsed.toFixed(1)}ms${modeInfo}${tensionInfo}`)
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
    if ((audioEngine.currentPulse.value % 16) !== 0) return
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
    // momentum removed

    evolveIntervalId = null
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

  // updateMomentumMaxLevel removed; momentum no longer supported

  // Control de modos creativos
  // setEvolveMode removed; no evolve modes supported

  // setMomentumEnabled removed; momentum no longer supported

  // setCallResponseEnabled removed; call/response no longer supported

  // setTensionReleaseMode removed; tension/release no longer supported

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
    // Densidad global
    globalDensityBias,

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
    generateLoopPattern,
    regenerateAllLoops,
    regenerateLoopMelody,
    regenerateAllMelodies,
    generateAllPatterns,
    logNotesMatrix,
    applySparseDistribution,
    updateTempo,
    updateMasterVolume,
    updateScale,
    updateDelayDivision,
    // Tonal cycles control
    // Tonal cycles control
    startTonalCycle: (cfg) => startCycle(cfg),
    stopTonalCycle: (id) => stopCycle(id),
    stepTonalCycle: (id) => stepCycle(id),
    pauseTonalCycle: (id) => pauseCycle(id),
    resumeTonalCycle: (id) => resumeCycle(id),
    listTonalCycles: () => listCycles(),
    // reactive tonal cycles list (updated via subscription)
    activeTonalCycles: tonalCyclesList,
    updateGlobalDensityBias,
    // Sincronización
    resetLoopCounters,

    // Funciones de evolución automática
    startAutoEvolve,
    stopAutoEvolve,
    updateEvolveInterval,
    updateEvolveIntensity,
    // updateMomentumMaxLevel removed
    evolveMusic,

    // Funciones de evolución con matriz
    evolveMatrixLoop: evolutionSystem.evolveMatrixLoop,
    evolveMultipleMatrixLoops: evolutionSystem.evolveMultipleMatrixLoops,
    applyMatrixMutation: evolutionSystem.applyMatrixMutation,
    evolveMatrixWithStrategy: evolutionSystem.evolveMatrixWithStrategy,

    // No creative modes provided — momentum/callResponse/tensionRelease removed
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
