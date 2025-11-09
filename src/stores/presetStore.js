import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { useAudioStore } from './audioStore'
import { useSynthStore } from './synthStore'
import {
  createPreset as createPresetService,
  getAllPresets,
  getPresetById,
  updatePreset,
  deletePreset,
  duplicatePreset,
  getStorageStats
} from '../services/presetService'

export const usePresetStore = defineStore('preset', () => {
  // Estado reactivo
  const presets = ref([])
  const currentPresetId = ref(null)
  const isLoading = ref(false)
  const hasUnsavedChanges = ref(false)
  const lastSaveTime = ref(null)
  const autoSaveEnabled = ref(true)
  const isDialogOpen = ref(false)
  const isLoadingPreset = ref(false) // Flag reactivo para evitar auto-guardado durante carga
  const isBatchMode = ref(false) // Flag para operaciones batch (evolución, etc.)

  // Configuración de auto-guardado
  const AUTO_SAVE_DELAY = 2000 // 2 segundos de debounce
  let autoSaveTimer = null
  let pendingSaveAfterBatch = false

  // Computed
  const currentPreset = computed(() => {
    if (!currentPresetId.value) return null
    return presets.value.find(preset => preset.id === currentPresetId.value) || null
  })

  const sortedPresets = computed(() => {
    return [...presets.value].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  })

  const presetsCount = computed(() => presets.value.length)

  // Cargar presets desde localStorage
  const loadPresets = async () => {
    try {
      isLoading.value = true
      const loadedPresets = getAllPresets()
      presets.value = loadedPresets
    } catch (error) {
      console.error('Error loading presets:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Crear preset por defecto
  const createDefaultPreset = async () => {
    try {
      const audioStore = useAudioStore()
      const currentState = captureCurrentState(audioStore)

      const defaultPreset = await createPresetService({
        name: 'Preset por Defecto',
        ...currentState
      })

      presets.value.push(defaultPreset)
      currentPresetId.value = defaultPreset.id
      hasUnsavedChanges.value = false

      console.log('📦 [PresetLoaded] Default preset created and loaded:', defaultPreset.name, 'ID:', defaultPreset.id)

      return defaultPreset
    } catch (error) {
      console.error('Error al crear preset por defecto:', error)
      throw error
    }
  }

  // Capturar estado actual de la aplicación
  const captureCurrentState = (audioStore) => {
    // Capturar configuración global
    const globalConfig = {
      tempo: audioStore.tempo,
      masterVol: audioStore.masterVol,
      currentScale: audioStore.currentScale,
      delayDivision: audioStore.delayDivision,

      // Configuración de evolución automática
      autoEvolve: audioStore.autoEvolve,
      evolveInterval: audioStore.evolveInterval,
      evolveIntensity: audioStore.evolveIntensity,
      momentumMaxLevel: audioStore.momentumMaxLevel,
      scaleLocked: audioStore.scaleLocked,

      // Tipos de evolución
      momentumEnabled: audioStore.momentumEnabled,
      callResponseEnabled: audioStore.callResponseEnabled,
      tensionReleaseMode: audioStore.tensionReleaseMode,

      // Gestión de energía sonora
      energyManagementEnabled: audioStore.energyManagementEnabled,
      maxSonicEnergy: audioStore.maxSonicEnergy,
      energyReductionFactor: audioStore.energyReductionFactor
    }

    // Capturar configuración de loops - save "as is"
    // Notes matrix data (including density and notes) is NOT saved - it will be regenerated on load
    const loops = audioStore.loops.map(loop => {
      return {
        id: loop.id,
        isActive: loop.isActive,
        // scale removed - uses global scale from audioStore.currentScale
        baseNote: loop.baseNote,
        synthType: loop.synthModel || loop.synthType || 'PolySynth',
        oscillatorType: loop.synthType || loop.oscillatorType || 'sine',
        length: loop.length,
        delayAmount: loop.delayAmount,
        reverbAmount: loop.reverbAmount,
        volume: loop.volume,
        pan: loop.pan,
        envelope: { ...loop.envelope },
        harmonicity: loop.harmonicity,
        modulationIndex: loop.modulationIndex,
        synthConfig: loop.synthConfig
      }
    })

    return {
      globalConfig,
      loops
    }
  }

  // Aplicar preset al estado de la aplicación
  const applyPresetToState = async (preset, options = {}) => {
    isLoadingPreset.value = true
    const audioStore = useAudioStore()

    // Pausar auto-guardado temporalmente para evitar conflictos
    const wasAutoSaveEnabled = autoSaveEnabled.value
    autoSaveEnabled.value = false

    // Aplicar configuración global - read values "as is"
    const { globalConfig, loops: presetLoops } = preset

    // Update global config directly without type validation
    if (globalConfig.tempo !== undefined) audioStore.updateTempo(globalConfig.tempo)
    if (globalConfig.masterVol !== undefined) audioStore.updateMasterVolume(globalConfig.masterVol * 100)
    if (globalConfig.currentScale !== undefined) audioStore.currentScale = globalConfig.currentScale

    // Evolution config
    if (globalConfig.autoEvolve !== undefined) audioStore.autoEvolve = globalConfig.autoEvolve

    // Only apply evolution values if not preserving them
    if (!options.preserveEvolutionSettings) {
      if (globalConfig.evolveInterval !== undefined) audioStore.updateEvolveInterval(globalConfig.evolveInterval)
      if (globalConfig.evolveIntensity !== undefined) audioStore.updateEvolveIntensity(globalConfig.evolveIntensity)
    }
    if (globalConfig.momentumMaxLevel !== undefined) audioStore.updateMomentumMaxLevel(globalConfig.momentumMaxLevel)
    if (globalConfig.scaleLocked !== undefined) audioStore.scaleLocked = globalConfig.scaleLocked

    // Evolution types
    if (globalConfig.momentumEnabled !== undefined) audioStore.setMomentumEnabled(globalConfig.momentumEnabled)
    if (globalConfig.callResponseEnabled !== undefined) audioStore.setCallResponseEnabled(globalConfig.callResponseEnabled)
    if (globalConfig.tensionReleaseMode !== undefined) audioStore.setTensionReleaseMode(globalConfig.tensionReleaseMode)

    // Energy management
    if (globalConfig.energyManagementEnabled !== undefined) audioStore.energyManagementEnabled = globalConfig.energyManagementEnabled
    if (globalConfig.maxSonicEnergy !== undefined) audioStore.maxSonicEnergy = globalConfig.maxSonicEnergy
    if (globalConfig.energyReductionFactor !== undefined) audioStore.energyReductionFactor = globalConfig.energyReductionFactor

    // Apply loop configuration directly "as is"
    if (Array.isArray(presetLoops)) {
      presetLoops.forEach((presetLoop, index) => {
        if (index < audioStore.loops.length && presetLoop) {
          const loop = audioStore.loops[index]

          // Apply loop properties directly without validation
          // Set active state
          const targetActiveState = presetLoop.isActive !== undefined ? presetLoop.isActive : false
          if (audioStore.setLoopActive) {
            audioStore.setLoopActive(index, targetActiveState)
          } else {
            loop.isActive = targetActiveState
          }

          // Apply all properties directly
          // scale removed - uses global scale from audioStore.currentScale
          if (presetLoop.baseNote !== undefined) loop.baseNote = presetLoop.baseNote
          if (presetLoop.synthType !== undefined) loop.synthModel = presetLoop.synthType
          if (presetLoop.oscillatorType !== undefined) loop.synthType = presetLoop.oscillatorType
          if (presetLoop.synthModel !== undefined) loop.synthModel = presetLoop.synthModel

          if (presetLoop.length !== undefined) {
            if (loop.length !== presetLoop.length) {
              loop.length = presetLoop.length
              if (audioStore.updateLoopParam) {
                audioStore.updateLoopParam(index, 'length', presetLoop.length)
              }
            } else {
              loop.length = presetLoop.length
            }
          }

          if (presetLoop.delayAmount !== undefined) loop.delayAmount = presetLoop.delayAmount
          if (presetLoop.reverbAmount !== undefined) loop.reverbAmount = presetLoop.reverbAmount
          if (presetLoop.volume !== undefined) loop.volume = presetLoop.volume
          if (presetLoop.pan !== undefined) loop.pan = presetLoop.pan

          // Apply envelope directly
          if (presetLoop.envelope) {
            loop.envelope = { ...loop.envelope, ...presetLoop.envelope }
          }

          // Apply synth parameters directly
          if (presetLoop.harmonicity !== undefined) loop.harmonicity = presetLoop.harmonicity
          if (presetLoop.modulationIndex !== undefined) loop.modulationIndex = presetLoop.modulationIndex
          if (presetLoop.synthConfig) loop.synthConfig = presetLoop.synthConfig
          // Update synth with direct config application
          if (audioStore.updateLoopSynth) {
            const synthConfig = {
              type: loop.synthModel || 'PolySynth',
              oscillator: { type: loop.synthType || 'sine' },
              envelope: { ...loop.envelope }
            }

            if (loop.harmonicity !== undefined) synthConfig.harmonicity = loop.harmonicity
            if (loop.modulationIndex !== undefined) synthConfig.modulationIndex = loop.modulationIndex

            audioStore.updateLoopSynth(index, synthConfig)
          }

          // Update effect parameters
          if (audioStore.updateLoopParam) {
            if (presetLoop.delayAmount !== undefined) audioStore.updateLoopParam(index, 'delayAmount', presetLoop.delayAmount)
            if (presetLoop.reverbAmount !== undefined) audioStore.updateLoopParam(index, 'reverbAmount', presetLoop.reverbAmount)
            if (presetLoop.volume !== undefined) audioStore.updateLoopParam(index, 'volume', presetLoop.volume)
            if (presetLoop.pan !== undefined) audioStore.updateLoopParam(index, 'pan', presetLoop.pan)
          }
        }
      })
    }

    // Update global parameters directly
    if (audioStore.updateTempo && globalConfig.tempo !== undefined) {
      audioStore.updateTempo(globalConfig.tempo)
    }
    if (audioStore.updateMasterVolume && globalConfig.masterVol !== undefined) {
      audioStore.updateMasterVolume(Math.round(globalConfig.masterVol * 100))
    }
    if (audioStore.updateScale && globalConfig.currentScale !== undefined) {
      audioStore.updateScale(globalConfig.currentScale)
    }
    if (audioStore.updateDelayDivision && globalConfig.delayDivision !== undefined) {
      audioStore.updateDelayDivision(globalConfig.delayDivision)

      // Wait for UI updates
      await nextTick()
      await nextTick()

      // Force second update
      if (globalConfig.delayDivision !== undefined) {
        audioStore.updateDelayDivision(globalConfig.delayDivision)
        await nextTick()
      }
    }

    // Generate notes for all active loops - calculate density from existing matrix or use default
    if (audioStore.loopManager && Array.isArray(audioStore.loops) && Array.isArray(presetLoops)) {
      // Get global scale from audioStore
      const globalScale = audioStore.getScale(audioStore.currentScale)
      const globalScaleName = audioStore.currentScale

      audioStore.loops.forEach((loop, index) => {
        if (!loop || !loop.isActive) return

        // Calculate density from existing notes in matrix if available, otherwise use default
        let density = 0.4
        if (audioStore.notesMatrix && audioStore.notesMatrix.getLoopNoteDensity) {
          const calculatedDensity = audioStore.notesMatrix.getLoopNoteDensity(index)
          if (calculatedDensity > 0) {
            density = calculatedDensity
          }
        }

        // Use global scale for all loops
        audioStore.loopManager.regenerateLoop(index, globalScale, globalScaleName, density, null)
      })
    }

    // Restaurar auto-guardado después de que todos los watchers hayan procesado los cambios
    isLoadingPreset.value = false
    // Esperar a que se completen los watchers antes de reactivar autosave
    await nextTick()
    autoSaveEnabled.value = wasAutoSaveEnabled
  }

  // Crear nuevo preset
  const createPreset = async (name) => {
    try {
      const audioStore = useAudioStore()
      const currentState = captureCurrentState(audioStore)

      const newPreset = await createPresetService({
        name: name || `Preset ${new Date().toLocaleString()}`,
        ...currentState
      })

      presets.value.push(newPreset)
      currentPresetId.value = newPreset.id
      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()

      return newPreset
    } catch (error) {
      console.error('Error al crear preset:', error)
      throw error
    }
  }

  // Cargar preset
  const loadPreset = async (presetId) => {
    try {
      isLoading.value = true
      const preset = await getPresetById(presetId)

      if (!preset) {
        console.error('Error loading preset - preset not found, aborting')
        throw new Error('Preset not found')
      }

      await applyPresetToState(preset)
      currentPresetId.value = presetId
      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()

      console.log('📦 [PresetLoaded] Preset loaded successfully:', preset.name, 'ID:', presetId)

      return preset
    } catch (error) {
      console.error('Error loading preset - aborting:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Guardar preset actual
  const saveCurrentPreset = async () => {
    try {
      if (!currentPresetId.value) {
        // Si no hay preset actual, lanzar error para que el componente maneje la solicitud de nombre
        throw new Error('NO_PRESET_SELECTED')
      }

      const audioStore = useAudioStore()
      const currentState = captureCurrentState(audioStore)

      const updatedPreset = await updatePreset(currentPresetId.value, currentState)

      // Actualizar en el array local
      const index = presets.value.findIndex(p => p.id === currentPresetId.value)
      if (index !== -1) {
        presets.value[index] = updatedPreset
      }

      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()

      return updatedPreset
    } catch (error) {
      console.error('Error al guardar preset:', error)
      throw error
    }
  }

  // Renombrar preset
  const renamePreset = async (presetId, newName) => {
    try {
      const updatedPreset = await updatePreset(presetId, { name: newName })

      const index = presets.value.findIndex(p => p.id === presetId)
      if (index !== -1) {
        presets.value[index] = updatedPreset
      }

      return updatedPreset
    } catch (error) {
      console.error('Error al renombrar preset:', error)
      throw error
    }
  }

  // Eliminar preset
  const deletePresetFromStore = async (presetId) => {
    try {
      await deletePreset(presetId)

      presets.value = presets.value.filter(p => p.id !== presetId)

      // Si se eliminó el preset actual, limpiar selección
      if (currentPresetId.value === presetId) {
        currentPresetId.value = null
        hasUnsavedChanges.value = true
      }

      return true
    } catch (error) {
      console.error('Error al eliminar preset:', error)
      throw error
    }
  }

  // Duplicar preset
  const duplicatePresetInStore = async (presetId) => {
    try {
      const duplicated = await duplicatePreset(presetId)
      presets.value.push(duplicated)
      return duplicated
    } catch (error) {
      console.error('Error al duplicar preset:', error)
      throw error
    }
  }

  // Marcar cambios para auto-guardado (simplified)
  const markChanges = () => {
    if (!isLoadingPreset.value) {
      hasUnsavedChanges.value = true
    }
  }

  // Función para crear un preset automático cuando no hay uno seleccionado
  const createAutoPreset = async () => {
    if (currentPresetId.value) return // Ya hay un preset seleccionado

    try {
      const audioStore = useAudioStore()
      const currentState = captureCurrentState(audioStore)

      // Generar nombre descriptivo basado en el estado actual
      const activeLoops = currentState.loops.filter(loop => loop.isActive).length
      const tempo = currentState.globalConfig.tempo
      const scale = currentState.globalConfig.currentScale

      const timestamp = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })

      const autoPresetName = `Auto ${activeLoops}L ${tempo}BPM ${scale} ${timestamp}`

      const newPreset = await createPresetService({
        name: autoPresetName,
        ...currentState
      })

      // Actualizar estado del store
      presets.value.push(newPreset)
      currentPresetId.value = newPreset.id
      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()

      return newPreset
    } catch (error) {
      console.error('Error creando preset automático:', error)
      throw error
    }
  }

  // Función mejorada para detectar cambios
  const handleChange = () => {
    // No hacer nada si se está cargando un preset o el auto-guardado está deshabilitado
    if (isLoadingPreset.value || !autoSaveEnabled.value) {
      return
    }

    // Si estamos en modo batch, solo marcar que hay cambios pendientes
    // El modo batch se usa durante las evoluciones automáticas para evitar múltiples guardados
    if (isBatchMode.value) {
      pendingSaveAfterBatch = true
      hasUnsavedChanges.value = true
      return
    }

    // Solo marcar cambios si hay un preset seleccionado
    if (currentPresetId.value) {
      hasUnsavedChanges.value = true

      // Debounce auto-save to prevent excessive saves
      clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(async () => {
        try {
          await saveCurrentPreset()
        } catch (error) {
          console.warn('Auto-save failed:', error.message)
        }
      }, AUTO_SAVE_DELAY)
    } else {
      hasUnsavedChanges.value = true
    }
  }

  // Funciones para controlar el modo batch
  const startBatchMode = () => {
    isBatchMode.value = true
    pendingSaveAfterBatch = false
  }

  const endBatchMode = async (autoSave = true) => {
    isBatchMode.value = false

    // Si hay cambios pendientes y se solicita auto-guardado
    if (autoSave && pendingSaveAfterBatch && currentPresetId.value && autoSaveEnabled.value) {
      hasUnsavedChanges.value = true
      pendingSaveAfterBatch = false

      // Guardar después de un pequeño delay para asegurar que todos los cambios se completaron
      clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(async () => {
        try {
          await saveCurrentPreset()
        } catch (error) {
          console.warn('Auto-save after batch failed:', error.message)
        }
      }, AUTO_SAVE_DELAY)
    } else {
      // Siempre limpiar el flag pendiente, incluso si no se guarda
      pendingSaveAfterBatch = false
    }
  }

  // Configure watchers for auto-save
  const setupAutoSave = () => {
    const audioStore = useAudioStore()

    // Watch only major configuration changes to avoid infinite loops
    watch(() => audioStore.tempo, () => {
      if (!isLoadingPreset.value && autoSaveEnabled.value) {
        handleChange()
      }
    })

    watch(() => audioStore.currentScale, () => {
      if (!isLoadingPreset.value && autoSaveEnabled.value) {
        handleChange()
      }
    })

    watch(() => audioStore.autoEvolve, () => {
      if (!isLoadingPreset.value && autoSaveEnabled.value) {
        handleChange()
      }
    })

    // Watch loop activity changes but not every parameter
    watch(() => audioStore.loops.map(l => l.isActive), () => {
      if (!isLoadingPreset.value && autoSaveEnabled.value) {
        handleChange()
      }
    })
  }

  // Abrir/cerrar diálogo
  const openDialog = () => {
    isDialogOpen.value = true
  }

  const closeDialog = () => {
    isDialogOpen.value = false
  }

  // Inicialización
  let presetStoreInitializing = false
  const initialize = async () => {

    // Prevent multiple concurrent initializations
    if (presetStoreInitializing) {
      return true
    }

    presetStoreInitializing = true
    isLoading.value = true

    try {
      await loadPresets()

      // Si no hay presets, crear uno por defecto
      if (presets.value.length === 0) {
        await createDefaultPreset()
      }

      // Establecer el preset actual al más reciente
      if (presets.value.length > 0 && !currentPresetId.value) {
        currentPresetId.value = sortedPresets.value[0].id
        // Load the preset to apply its state
        await loadPreset(currentPresetId.value)
      }

      setupAutoSave()
      presetStoreInitializing = false
      return true
    } catch (error) {
      console.error('Error initializing preset system:', error)
      presetStoreInitializing = false
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Estado
    presets,
    currentPresetId,
    isLoading,
    hasUnsavedChanges,
    lastSaveTime,
    autoSaveEnabled,
    isDialogOpen,
    isBatchMode,

    // Computed
    currentPreset,
    sortedPresets,
    presetsCount,

    // Métodos
    initialize,
    loadPresets,
    createPreset,
    createDefaultPreset,
    loadPreset,
    saveCurrentPreset,
    renamePreset,
    deletePreset: deletePresetFromStore,
    duplicatePreset: duplicatePresetInStore,
    markChanges,
    handleChange,
    startBatchMode,
    endBatchMode,
    createAutoPreset,
    openDialog,
    closeDialog,

    // Utilidades
    captureCurrentState,
    applyPresetToState,
    applyStyleModifier: (preset) => applyPresetToState(preset, { preserveEvolutionSettings: true })
  }
})