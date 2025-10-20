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
  validatePreset,
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

  // Configuración de auto-guardado
  const AUTO_SAVE_DELAY = 2000 // 2 segundos de debounce
  let autoSaveTimer = null

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
      
      // Si no hay presets, crear uno por defecto
      if (loadedPresets.length === 0) {
        await createDefaultPreset()
      }
    } catch (error) {
      console.error('Error al cargar presets:', error)
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

    // Capturar configuración de loops
    const loops = audioStore.loops.map(loop => ({
      id: loop.id,
      isActive: loop.isActive,
      scale: [...loop.scale],
      baseNote: loop.baseNote,
      // Nomenclatura correcta: synthType es el tipo de sintetizador, oscillatorType es la forma de onda
      synthType: loop.synthModel || loop.synthType || 'PolySynth', // Tipo de sintetizador
      oscillatorType: loop.synthType || loop.oscillatorType || 'sine', // Forma de onda
      pattern: [...loop.pattern],
      notes: [...loop.notes],
      length: loop.length,
      delayAmount: loop.delayAmount,
      reverbAmount: loop.reverbAmount,
      volume: loop.volume,
      pan: loop.pan,
      envelope: { ...loop.envelope },
      harmonicity: loop.harmonicity,
      modulationIndex: loop.modulationIndex,
      synthConfig: loop.synthConfig ? { ...loop.synthConfig } : null
    }))

    return {
      globalConfig,
      loops
    }
  }

  // Aplicar preset al estado de la aplicación
  const applyPresetToState = async (preset, options = {}) => {
    try {
      console.log(`🚀🚀🚀 INICIANDO applyPresetToState para preset: ${preset.name}`)
      console.log(`🔍 delayDivision en preset:`, preset.globalConfig?.delayDivision)
      
      // Validar preset antes de aplicar
      if (!validatePreset(preset)) {
        throw new Error('Preset inválido')
      }

      isLoadingPreset.value = true
      const audioStore = useAudioStore()

      // Pausar auto-guardado temporalmente para evitar conflictos
      const wasAutoSaveEnabled = autoSaveEnabled.value
      autoSaveEnabled.value = false

      // Aplicar configuración global
      const { globalConfig, loops: presetLoops } = preset

      // Actualizar configuración global con validación de tipos
      if (typeof globalConfig.tempo === 'number') audioStore.updateTempo(globalConfig.tempo)
      if (typeof globalConfig.masterVol === 'number') audioStore.updateMasterVolume(globalConfig.masterVol * 100)
      if (typeof globalConfig.currentScale === 'string') audioStore.currentScale = globalConfig.currentScale
      // delayDivision se actualiza al final para asegurar que la interfaz se actualice correctamente
      
      // Configuración de evolución automática
      if (typeof globalConfig.autoEvolve === 'boolean') audioStore.autoEvolve = globalConfig.autoEvolve
      
      // Solo aplicar valores de evolución si no se especifica preservarlos
      if (!options.preserveEvolutionSettings) {
        if (typeof globalConfig.evolveInterval === 'number') audioStore.updateEvolveInterval(globalConfig.evolveInterval)
        if (typeof globalConfig.evolveIntensity === 'number') audioStore.updateEvolveIntensity(globalConfig.evolveIntensity)
      }
      if (typeof globalConfig.momentumMaxLevel === 'number') audioStore.momentumMaxLevel = globalConfig.momentumMaxLevel
      if (typeof globalConfig.scaleLocked === 'boolean') audioStore.scaleLocked = globalConfig.scaleLocked
      
      // Tipos de evolución
      if (typeof globalConfig.momentumEnabled === 'boolean') audioStore.setMomentumEnabled(globalConfig.momentumEnabled)
      if (typeof globalConfig.callResponseEnabled === 'boolean') audioStore.setCallResponseEnabled(globalConfig.callResponseEnabled)
      if (typeof globalConfig.tensionReleaseMode === 'boolean') audioStore.setTensionReleaseMode(globalConfig.tensionReleaseMode)
      
      // Gestión de energía sonora
      if (typeof globalConfig.energyManagementEnabled === 'boolean') audioStore.energyManagementEnabled = globalConfig.energyManagementEnabled
      if (typeof globalConfig.maxSonicEnergy === 'number') audioStore.maxSonicEnergy = globalConfig.maxSonicEnergy
      if (typeof globalConfig.energyReductionFactor === 'number') audioStore.energyReductionFactor = globalConfig.energyReductionFactor

      // Aplicar configuración de loops con validación
      if (Array.isArray(presetLoops)) {
        presetLoops.forEach((presetLoop, index) => {
          if (index < audioStore.loops.length && presetLoop) {
            const loop = audioStore.loops[index]
            
            // Actualizar propiedades del loop con validación de tipos
            if (typeof presetLoop.isActive === 'boolean') loop.isActive = presetLoop.isActive
            if (Array.isArray(presetLoop.scale)) loop.scale = [...presetLoop.scale]
            if (typeof presetLoop.baseNote === 'number') loop.baseNote = presetLoop.baseNote
            
            // Corregir aplicación de tipo de sintetizador y forma de onda
            // Priorizar la nueva nomenclatura, pero mantener compatibilidad
            if (typeof presetLoop.synthType === 'string') {
              loop.synthModel = presetLoop.synthType // Tipo de sintetizador
            } else if (typeof presetLoop.synthModel === 'string') {
              loop.synthModel = presetLoop.synthModel // Compatibilidad hacia atrás
            }
            
            if (typeof presetLoop.oscillatorType === 'string') {
              loop.synthType = presetLoop.oscillatorType // Forma de onda
            } else if (typeof presetLoop.synthType === 'string' && !presetLoop.oscillatorType) {
              // Si solo existe synthType en preset antiguo, asumimos que es la forma de onda
              loop.synthType = presetLoop.synthType
            }
            if (typeof presetLoop.length === 'number') {
              // Si el tamaño cambió, actualizar y regenerar patrón y notas
              if (loop.length !== presetLoop.length) {
                loop.length = presetLoop.length
                // Usar updateLoopParam para regenerar patrón y notas correctamente
                if (audioStore.updateLoopParam) {
                  audioStore.updateLoopParam(index, 'length', presetLoop.length)
                }
              } else {
                loop.length = presetLoop.length
              }
            }
            // Aplicar patrón y notas del preset solo después de ajustar el tamaño
            if (Array.isArray(presetLoop.pattern)) loop.pattern = [...presetLoop.pattern]
            if (Array.isArray(presetLoop.notes)) loop.notes = [...presetLoop.notes]
            if (typeof presetLoop.delayAmount === 'number') loop.delayAmount = presetLoop.delayAmount
            if (typeof presetLoop.reverbAmount === 'number') loop.reverbAmount = presetLoop.reverbAmount
            if (typeof presetLoop.volume === 'number') loop.volume = presetLoop.volume
            if (typeof presetLoop.pan === 'number') loop.pan = presetLoop.pan
            
            // Envelope con validación
            if (presetLoop.envelope && typeof presetLoop.envelope === 'object') {
              loop.envelope = { ...loop.envelope, ...presetLoop.envelope }
            }
            
            if (typeof presetLoop.harmonicity === 'number') loop.harmonicity = presetLoop.harmonicity
            if (typeof presetLoop.modulationIndex === 'number') loop.modulationIndex = presetLoop.modulationIndex
            if (presetLoop.synthConfig && typeof presetLoop.synthConfig === 'object') {
              loop.synthConfig = { ...presetLoop.synthConfig }
            }

            // Actualizar sintetizador con la configuración correcta
            if (audioStore.updateLoopSynth) {
              try {
                // Crear configuración del sintetizador basada en los valores del preset
                const synthConfig = {
                  type: loop.synthModel || 'PolySynth', // Tipo de sintetizador
                  oscillator: { type: loop.synthType || 'sine' }, // Forma de onda
                  envelope: { ...loop.envelope },
                  harmonicity: loop.harmonicity,
                  modulationIndex: loop.modulationIndex
                }
                
                // Si hay configuración específica del sintetizador, usarla
                if (presetLoop.synthConfig && typeof presetLoop.synthConfig === 'object') {
                  Object.assign(synthConfig, presetLoop.synthConfig)
                }
                
                audioStore.updateLoopSynth(index, synthConfig)
              } catch (synthError) {
                console.warn(`Error actualizando sintetizador del loop ${index}:`, synthError)
              }
            }

            // Actualizar parámetros de efectos
            if (audioStore.updateLoopParam) {
              try {
                audioStore.updateLoopParam(index, 'delayAmount', presetLoop.delayAmount)
                audioStore.updateLoopParam(index, 'reverbAmount', presetLoop.reverbAmount)
                audioStore.updateLoopParam(index, 'volume', presetLoop.volume)
                audioStore.updateLoopParam(index, 'pan', presetLoop.pan)
              } catch (paramError) {
                console.warn(`Error actualizando parámetros del loop ${index}:`, paramError)
              }
            }
          }
        })
      }

      // Actualizar tempo y otros parámetros globales
      if (audioStore.updateTempo && typeof globalConfig.tempo === 'number') {
        audioStore.updateTempo(globalConfig.tempo)
      }
      if (audioStore.updateMasterVolume && typeof globalConfig.masterVol === 'number') {
        audioStore.updateMasterVolume(Math.round(globalConfig.masterVol * 100))
      }
      if (audioStore.updateScale && typeof globalConfig.currentScale === 'string') {
        audioStore.updateScale(globalConfig.currentScale)
      }
      // Aplicar delayDivision al final para asegurar que se actualice correctamente
      if (audioStore.updateDelayDivision && typeof globalConfig.delayDivision === 'string') {
        audioStore.updateDelayDivision(globalConfig.delayDivision)
        
        // Esperar múltiples ticks para asegurar que la interfaz se actualice
        await nextTick()
        await nextTick()
        
        // Forzar una segunda actualización para asegurar que el DOM se actualice
        audioStore.updateDelayDivision(globalConfig.delayDivision)
        await nextTick()
      }
      
      // Restaurar auto-guardado
      autoSaveEnabled.value = wasAutoSaveEnabled
      
      console.log('Preset aplicado correctamente:', preset.name)
      
    } catch (error) {
      console.error('Error al aplicar preset:', error)
      // Restaurar auto-guardado en caso de error
      autoSaveEnabled.value = true
      throw error
    } finally {
      isLoadingPreset.value = false
    }
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
        throw new Error('Preset no encontrado')
      }

      await applyPresetToState(preset)
      currentPresetId.value = presetId
      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()
      
      return preset
    } catch (error) {
      console.error('Error al cargar preset:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Guardar preset actual
  const saveCurrentPreset = async () => {
    try {
      if (!currentPresetId.value) {
        // Si no hay preset actual, crear uno nuevo
        return await createPreset()
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

  // Auto-guardado con debounce
  const scheduleAutoSave = () => {
    if (!autoSaveEnabled.value || isLoadingPreset.value || !currentPresetId.value) {
      return
    }

    // Cancelar timer anterior
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }

    // Programar nuevo guardado
    autoSaveTimer = setTimeout(async () => {
      try {
        await saveCurrentPreset()
        console.log('Auto-guardado completado')
      } catch (error) {
        console.error('Error en auto-guardado:', error)
      }
    }, AUTO_SAVE_DELAY)

    hasUnsavedChanges.value = true
  }

  // Marcar cambios para auto-guardado
  const markChanges = () => {
    if (!isLoadingPreset.value) {
      scheduleAutoSave()
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
      
      console.log('Preset automático creado:', autoPresetName)
      
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
    
    // No guardar automáticamente si la evolución automática está activa
    // para evitar guardados no deseados por cambios automáticos del sistema
    const audioStore = useAudioStore()
    if (audioStore.autoEvolve) {
      return
    }
    
    if (!currentPresetId.value) {
      // Si no hay preset seleccionado, crear uno automático
      createAutoPreset()
    } else {
      // Si hay preset seleccionado, marcar cambios para auto-guardado
      markChanges()
    }
  }

  // Configurar watchers para auto-guardado
  const setupAutoSave = () => {
    const audioStore = useAudioStore()

    // Observar cambios en audioStore
    watch(() => audioStore.tempo, handleChange)
    watch(() => audioStore.masterVol, handleChange)
    watch(() => audioStore.currentScale, handleChange)
    watch(() => audioStore.delayDivision, handleChange)
    watch(() => audioStore.scaleLocked, handleChange)
    
    // Auto-evolve settings
    watch(() => audioStore.autoEvolveEnabled, handleChange)
    watch(() => audioStore.evolveInterval, handleChange)
    watch(() => audioStore.evolveIntensity, handleChange)
    watch(() => audioStore.evolveMode, handleChange)
    watch(() => audioStore.momentumEnabled, handleChange)
    watch(() => audioStore.callResponseEnabled, handleChange)
    watch(() => audioStore.tensionReleaseMode, handleChange)
    
    // Energy management
    watch(() => audioStore.energyManagementEnabled, handleChange)
    watch(() => audioStore.maxSonicEnergy, handleChange)
    watch(() => audioStore.energyReductionFactor, handleChange)

    // Observar cambios en loops (deep watch)
    // Los cambios en configuraciones de sintetizador se detectarán aquí
    // ya que se reflejan en las propiedades de los loops
    watch(() => audioStore.loops, handleChange, { deep: true })
  }

  // Abrir/cerrar diálogo
  const openDialog = () => {
    isDialogOpen.value = true
  }

  const closeDialog = () => {
    isDialogOpen.value = false
  }

  // Inicialización
  const initialize = async () => {
    await loadPresets()
    setupAutoSave()
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
    createAutoPreset,
    openDialog,
    closeDialog,

    // Utilidades
    captureCurrentState,
    applyPresetToState,
    applyStyleModifier: (preset) => applyPresetToState(preset, { preserveEvolutionSettings: true })
  }
})