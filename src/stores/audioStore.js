import { defineStore } from 'pinia'
import { ref, computed, markRaw } from 'vue'
import { useScales, useNoteUtils, useMusic } from '../composables/useMusic'
import { useNotesMatrix } from '../composables/useNotesMatrix'

// Importar los nuevos módulos especializados
import { useAudioEngine } from './modules/audioEngine'
import { useLoopManager } from './modules/loopManager'
import { useEnergyManager } from './modules/energyManager'
import { useEvolutionSystem } from './modules/evolutionSystem'

export const useAudioStore = defineStore('audio', () => {
  // Inicializar matriz de notas centralizada primero
  const notesMatrix = useNotesMatrix()

  // Inicializar módulos especializados con acceso a la matriz
  const audioEngine = useAudioEngine()
  const loopManager = useLoopManager(notesMatrix)
  const energyManager = useEnergyManager()
  const evolutionSystem = useEvolutionSystem(notesMatrix)

  // Estado específico del store principal (coordinación entre módulos)
  const currentScale = ref('major')
  const scaleNamesSpanish = ref({
    'major': 'Mayor',
    'minor': 'Menor',
    'dorian': 'Dórico',
    'phrygian': 'Frigio',
    'lydian': 'Lidio',
    'mixolydian': 'Mixolidio',
    'locrian': 'Locrio',
    'harmonicMinor': 'Menor Armónica',
    'melodicMinor': 'Menor Melódica',
    'pentatonic': 'Pentatónica',
    'blues': 'Blues',
    'chromatic': 'Cromática'
  })

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

  const scaleNames = computed(() => Object.keys(scales.value))
  const synthTypes = computed(() => ['sine', 'square', 'sawtooth', 'triangle'])

  // Funciones principales que coordinan entre módulos

  // Función para reproducir loops activos en cada pulso
  const playActiveLoops = (time, pulse) => {
    const activeLoops = loopManager.getActiveLoops()

    activeLoops.forEach(loop => {
      const step = (pulse - 1) % loop.length
      if (loop.pattern[step]) {
        loopManager.playLoopNote(loop, audioEngine, step, time)
      }
    })
  }

  // Inicialización de audio
  let audioStoreInitializing = false
  const initAudio = async () => {
    console.log('🎵 AUDIO STORE: Starting audio initialization');

    // Prevent multiple concurrent initializations
    if (audioStoreInitializing) {
      console.log('🔴 AUDIO STORE: Already initializing, skipping this call');
      return
    }

    audioStoreInitializing = true
    console.log('🎵 AUDIO STORE: Current scale:', currentScale.value);

    try {
      console.log('🎵 AUDIO STORE: Initializing audio engine...');
      await audioEngine.initAudio()
      console.log('🎵 AUDIO STORE: Audio engine initialized successfully');

      // Configurar callback del transporte para reproducir loops
      console.log('🎵 AUDIO STORE: Setting up transport callback');
      audioEngine.setupTransportCallback(playActiveLoops)
      console.log('🎵 AUDIO STORE: Transport callback configured');

      // Inicializar loops con configuración por defecto
      console.log('🎵 AUDIO STORE: Getting scale and initializing loops');
      const scale = useScales().getScale(currentScale.value)
      console.log('🎵 AUDIO STORE: Scale retrieved:', currentScale.value);

      loopManager.initializeLoops(scale, audioEngine)
      console.log('🎵 AUDIO STORE: Loops initialized successfully');

      console.log('🎵 AUDIO STORE: Audio initialization complete');
      audioStoreInitializing = false
      return true
    } catch (error) {
      console.error('🔴 AUDIO STORE: Error al inicializar audio:', error)
      audioStoreInitializing = false
      return false
    }
  }

  // Control de reproducción
  const togglePlay = () => {
    console.log('🎵 AUDIO_STORE: togglePlay called - Current isPlaying:', audioEngine.isPlaying.value);
    audioEngine.togglePlay()
    console.log('🎵 AUDIO_STORE: togglePlay executed - New isPlaying:', audioEngine.isPlaying.value);

    if (audioEngine.isPlaying.value && autoEvolve.value) {
      startAutoEvolve()
    } else if (!audioEngine.isPlaying.value) {
      stopAutoEvolve()
    }
  }

  // Control de loops
  const toggleLoop = (id) => {
    const loop = loopManager.loops.value[id]
    if (!loop) return

    loopManager.toggleLoop(id)

    // Aplicar gestión de energía después de cambios
    if (energyManager.energyManagementEnabled.value) {
      energyManager.adjustAllLoopVolumes(loopManager.loops.value)
    }
  }

  // Actualizar parámetros de loop
  const updateLoopParam = (id, param, value) => {
    loopManager.updateLoopParam(id, param, value)

    // Verificar balance energético solo cuando se cambia el volumen
    // Los efectos (delay/reverb) no deben activar la gestión automática de energía
    if (param === 'volume') {
      energyManager.checkAndBalanceEnergy(loopManager.loops.value)
    }
  }

  // Actualizar configuración del sintetizador
  const updateLoopSynth = (loopId, synthConfig) => {
    loopManager.updateLoopSynth(loopId, synthConfig, audioEngine)
  }

  // Regenerar loop individualla g 
  const regenerateLoop = (id) => {
    if (!audioEngine.audioInitialized.value) return

    const scale = useScales().getScale(currentScale.value)
    const adaptiveDensity = energyManager.getAdaptiveDensity(loopManager.loops.value)
    const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, id)

    loopManager.regenerateLoop(id, scale, adaptiveDensity, adaptiveVolume)
  }

  // Regenerar todos los loops
  const regenerateAllLoops = () => {
    if (!audioEngine.audioInitialized.value) return

    const scale = useScales().getScale(currentScale.value)
    console.log('🎵 REGENERATING ALL LOOPS with scale:', currentScale.value, 'intervals:', scale)

    for (let i = 0; i < loopManager.NUM_LOOPS; i++) {
      const adaptiveDensity = energyManager.getAdaptiveDensity(loopManager.loops.value)
      const adaptiveVolume = energyManager.getAdaptiveVolume(loopManager.loops.value, i)
      loopManager.regenerateLoop(i, scale, adaptiveDensity, adaptiveVolume)
    }

    // Ajustar volúmenes después de regenerar todos
    energyManager.adjustAllLoopVolumes(loopManager.loops.value)
    console.log('🎵 FINISHED REGENERATING ALL LOOPS with scale:', currentScale.value)
  }

  // Distribución panorámica
  const applySparseDistribution = () => {
    if (!audioEngine.audioInitialized.value) return
    loopManager.applySparseDistribution()
  }

  // Control de tempo
  const updateTempo = (newTempo) => {
    audioEngine.updateTempo(newTempo)
  }

  // Control de volumen maestro
  const updateMasterVolume = (volume) => {
    audioEngine.updateMasterVolume(volume)
  }

  // Actualizar escala musical
  const updateScale = (newScale) => {
    const scale = useScales().getScale(newScale)
    if (!scale) return

    currentScale.value = newScale

    if (!audioEngine.audioInitialized.value) {
      // Si no está inicializado, solo actualizar la referencia de la escala
      loopManager.loops.value.forEach(loop => {
        loop.scale = scale
      })
      return
    }

    // Cuantizar notas existentes manteniendo patrón y baseNote
    loopManager.loops.value.forEach(loop => {
      loop.scale = scale
      loopManager.quantizeLoopNotes(loop, scale)
    })
  }

  // Actualizar división del delay
  const updateDelayDivision = (division) => {
    audioEngine.updateDelayDivision(division)
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
    const targetLevel = Math.min(evolutionSystem.evolutionIntensity.value * 10, Math.floor(elapsedSec / 10))
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
      // Priorizar densidad de patrón
      return list.reduce((best, loop) => {
        const density = Array.isArray(loop.pattern) ? loop.pattern.filter(Boolean).length : 0
        const bestDensity = Array.isArray(best?.pattern) ? best.pattern.filter(Boolean).length : -1
        return density > bestDensity ? loop : best
      }, null) || list[0]
    }
    const caller = pickCaller(callerCandidates.length ? callerCandidates : activeLoops)
    lastCallerId.value = caller?.id ?? null

    const scale = useScales().getScale(currentScale.value) || useScales().getScale('major')

    // Fijar base del respondedor cercana a la del caller si existe, con pequeña variación de octava
    const baseNotes = [36, 48, 60, 72]
    const baseFromCaller = (caller?.baseNote ?? null)
    const octaveShift = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 12 : -12)
    const chosenBase = baseFromCaller ? Math.max(24, Math.min(72, baseFromCaller + octaveShift))
      : baseNotes[Math.floor(Math.random() * baseNotes.length)]
    responder.baseNote = chosenBase

    // Generar respuesta derivada del caller si existe; en su defecto, generar notas en rango
    let responseNotes
    if (caller) {
      responseNotes = loopManager.generateResponseFromCall(caller, responder, scale, responder.baseNote)
    } else {
      responseNotes = loopManager.generateNotesInRange(scale, responder.baseNote, responder.length, 2)
    }

    // Guardar las notas en la matriz centralizada
    notesMatrix.setLoopNotes(responder.id, responseNotes)

    return loopsToReharmonize
  }

  // Evolución musical principal
  const evolveMusic = () => {
    if (!audioEngine.audioInitialized.value) return

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
    const availableScales = Object.keys(scales.value).map(name => ({
      name,
      notes: useScales().getScale(name)
    }))

    // Excluir reverb y delay de la evolución cuando se están aplicando cambios de estilo
    const isStyleChange = momentumEnabled.value || callResponseEnabled.value || tensionReleaseMode.value
    const evolutionOptions = isStyleChange ? { excludeReverb: true, excludeDelay: true } : {}

    const evolvedLoops = evolutionSystem.evolveMultipleLoops(loopManager.loops.value, availableScales, evolutionOptions)

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

  const stopAutoEvolve = () => {
    autoEvolve.value = false
    evolutionSystem.updateEvolutionSettings({ enabled: false })
    if (evolveIntervalId) {
      clearInterval(evolveIntervalId)
      evolveIntervalId = null
    }
  }

  const updateEvolveInterval = (interval) => {
    const measuresInterval = Math.max(2, Math.min(32, Number(interval))) // límites en compases
    evolutionSystem.updateEvolutionSettings({ interval: measuresInterval })
    if (autoEvolve.value) {
      // Recalcular próxima evolución: simplemente sumar el nuevo intervalo en compases
      nextEvolveMeasure.value = audioEngine.currentPulse.value + (measuresInterval * 16)
    }
  }

  const updateEvolveIntensity = (intensity) => {
    const normalizedIntensity = Math.max(0.1, Math.min(1.0, Number(intensity) / 10))
    evolutionSystem.updateEvolutionSettings({ intensity: normalizedIntensity })
  }

  const updateMomentumMaxLevel = (level) => {
    // Mantener compatibilidad con la interfaz existente
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
  }

  const setCallResponseEnabled = (enabled) => {
    callResponseEnabled.value = Boolean(enabled)
    if (!enabled) {
      lastResponderId.value = null
      lastCallerId.value = null
    }
  }

  const setTensionReleaseMode = (enabled) => {
    tensionReleaseMode.value = Boolean(enabled)
    if (enabled) {
      isTensionPhase.value = false
    }
  }

  const toggleScaleLock = () => {
    scaleLocked.value = !scaleLocked.value
  }

  return {
    // Estado del motor de audio
    audioInitialized: audioEngine.audioInitialized,
    isPlaying: audioEngine.isPlaying,
    currentPulse: audioEngine.currentPulse,
    currentBeat: audioEngine.currentBeat,
    tempo: audioEngine.tempo,
    masterVol: audioEngine.masterVol,
    masterVolume: audioEngine.masterVolume,
    delayDivision: audioEngine.delayDivision,

    // Estado de loops
    loops: loopManager.loops,

    // Estado de escalas
    currentScale,
    scaleNamesSpanish,
    scales,
    scaleNames,
    synthTypes,

    // Estado de evolución automática
    autoEvolve,
    evolveInterval: computed(() => evolutionSystem.evolutionInterval.value), // intervalo en compases
    evolveIntensity: computed(() => evolutionSystem.evolutionIntensity.value * 10), // convertir para compatibilidad
    measuresSinceEvolve,
    nextEvolveMeasure,
    scaleLocked,

    // Estado de gestión de energía
    energyManagementEnabled: energyManager.energyManagementEnabled,
    maxSonicEnergy: energyManager.maxSonicEnergy,
    energyReductionFactor: energyManager.energyReductionFactor,

    // Funciones principales
    initAudio,
    togglePlay,
    toggleLoop,
    updateLoopParam,
    updateLoopSynth,
    regenerateLoop,
    regenerateAllLoops,
    applySparseDistribution,
    updateTempo,
    updateMasterVolume,
    updateScale,
    updateDelayDivision,

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

    // Configuración de energía sonora
    updateEnergyManagement: energyManager.updateEnergyManagement,
    updateMaxSonicEnergy: energyManager.updateMaxSonicEnergy,
    updateEnergyReductionFactor: energyManager.updateEnergyReductionFactor,

    // Funciones de matriz de notas centralizada
    notesMatrix: notesMatrix.notesMatrix,
    loopMetadata: notesMatrix.loopMetadata,
    matrixState: notesMatrix.matrixState,
    initializeMatrix: notesMatrix.initializeMatrix,
    activateLoop: notesMatrix.activateLoop,
    deactivateLoop: notesMatrix.deactivateLoop,
    updateLoopMetadata: notesMatrix.updateLoopMetadata,
    getLoopNotes: notesMatrix.getLoopNotes,
    setLoopNote: notesMatrix.setLoopNote,
    clearLoopNote: notesMatrix.clearLoopNote,
    generateRandomNotes: notesMatrix.generateLoopNotes,
    quantizeLoopToScale: notesMatrix.quantizeLoopToScale,
    quantizeAllToScale: notesMatrix.quantizeAllToScale,
    transposeLoop: notesMatrix.transposeLoop,
    rotateLoop: notesMatrix.rotateLoop,
    inverseLoop: notesMatrix.inverseLoop,
    mutateLoop: notesMatrix.mutateLoop,
    copyLoop: notesMatrix.copyLoop,
    getMatrixStats: notesMatrix.getMatrixStats,
    clearMatrix: notesMatrix.clearMatrix,
    exportMatrix: notesMatrix.exportMatrix,
    importMatrix: notesMatrix.importMatrix
  }
})
