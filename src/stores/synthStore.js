import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as Tone from 'tone'
import { useAudioStore } from './audioStore'

export const useSynthStore = defineStore('synth', () => {
  // Estado del modal
  const isModalOpen = ref(false)
  const currentLoopId = ref(null)
  const originalSynthConfig = ref(null)
  
  // Configuración temporal del sintetizador
  const tempSynthConfig = ref({
    synthType: 'PolySynth',
    oscillatorType: 'sine',
    envelope: {
      attack: 0.01,
      decay: 0.3,
      sustain: 0.5,
      release: 0.8
    },
    harmonicity: 2,
    modulationIndex: 10
  })

  // Tipos de sintetizador disponibles
  const synthTypes = [
    { value: 'PolySynth', label: 'Poly Synth' },
    { value: 'AMSynth', label: 'AM Synth' },
    { value: 'FMSynth', label: 'FM Synth' },
    { value: 'PluckSynth', label: 'Pluck Synth' },
    { value: 'MembraneSynth', label: 'Membrane Synth' }
  ]

  // Tipos de oscilador
  const oscillatorTypes = [
    { value: 'sine', label: 'Sine' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'square', label: 'Square' },
    { value: 'sawtooth', label: 'Sawtooth' }
  ]

  // Abrir modal de edición
  const openSynthEditor = (loopId) => {
    const audioStore = useAudioStore()
    const loopsArr = Array.isArray(audioStore.loops) ? audioStore.loops : audioStore.loops?.value
    const loop = loopsArr?.[loopId]
    
    if (loop) {
      currentLoopId.value = loopId
      
      // Tomar snapshot de la configuración original del loop
      originalSynthConfig.value = {
        synthType: loop.synthModel || 'PolySynth',
        oscillatorType: loop.synthType || 'sine',
        envelope: { ...loop.envelope },
        harmonicity: loop.harmonicity || 3,
        modulationIndex: loop.modulationIndex || 10
      }
      
      // Inicializar temporal con el config actual
      tempSynthConfig.value = JSON.parse(JSON.stringify(originalSynthConfig.value))
      
      isModalOpen.value = true
    }
  }

  // Cerrar modal
  const closeSynthEditor = () => {
    isModalOpen.value = false
    currentLoopId.value = null
  }

  // Cancelar cambios y restaurar configuración original
  const cancelSynthChanges = () => {
    try {
      if (_applyTimer) { clearTimeout(_applyTimer); _applyTimer = null }
      if (currentLoopId.value === null) {
        isModalOpen.value = false
        return
      }
      const audioStore = useAudioStore()
      const loopId = currentLoopId.value
      if (originalSynthConfig.value) {
        const cfg = {
          type: originalSynthConfig.value.synthType || 'PolySynth',
          oscillator: { type: originalSynthConfig.value.oscillatorType },
          envelope: { ...originalSynthConfig.value.envelope },
          harmonicity: originalSynthConfig.value.harmonicity,
          modulationIndex: originalSynthConfig.value.modulationIndex
        }
        // Revertir el sintetizador del loop
        audioStore.updateLoopSynth(loopId, cfg)
        // Sincronizar el estado temporal con el original
        tempSynthConfig.value = JSON.parse(JSON.stringify(originalSynthConfig.value))
      }
    } catch (e) {
      console.error('Error al cancelar cambios del synth:', e)
    } finally {
      isModalOpen.value = false
      currentLoopId.value = null
      originalSynthConfig.value = null
    }
  }

  // Antirrebote para aplicar cambios sin saturar Tone.js
  let _applyTimer = null
  const scheduleApplySynthDebounced = () => {
    if (_applyTimer) clearTimeout(_applyTimer)
    _applyTimer = setTimeout(() => {
      try {
        if (currentLoopId.value === null) return
        const audioStore = useAudioStore()
        const loopId = currentLoopId.value
        const selectedType = tempSynthConfig.value.synthType || 'PolySynth'

        const cfg = {
          type: selectedType,
          oscillator: { type: tempSynthConfig.value.oscillatorType },
          envelope: { ...tempSynthConfig.value.envelope },
          harmonicity: selectedType !== 'PolySynth' ? tempSynthConfig.value.harmonicity : undefined,
          modulationIndex: selectedType === 'FMSynth' ? tempSynthConfig.value.modulationIndex : undefined
        }
        audioStore.updateLoopSynth(loopId, cfg)
      } catch (e) {
        console.error('Error aplicando cambios del synth (debounce):', e)
      }
    }, 300)
  }

  // Actualizar tipo de síntesis manualmente y ajustar valores
  const updateSynthType = (type) => {
    tempSynthConfig.value.synthType = type
    if (type === 'AMSynth') {
      if (typeof tempSynthConfig.value.harmonicity !== 'number') tempSynthConfig.value.harmonicity = 3
      tempSynthConfig.value.modulationIndex = undefined
    } else if (type === 'FMSynth') {
      if (typeof tempSynthConfig.value.harmonicity !== 'number') tempSynthConfig.value.harmonicity = 3
      if (typeof tempSynthConfig.value.modulationIndex !== 'number') tempSynthConfig.value.modulationIndex = 10
    } else { // PolySynth u otros
      tempSynthConfig.value.modulationIndex = undefined
    }
    scheduleApplySynthDebounced()
  }

  // Actualizar tipo de oscilador
  const updateOscillatorType = (type) => {
    tempSynthConfig.value.oscillatorType = type
    scheduleApplySynthDebounced()
  }

  // Actualizar parámetro del envelope
  const updateEnvelopeParam = (param, value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.envelope[param] = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar harmonicity (para AM/FM)
  const updateHarmonicity = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.harmonicity = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar modulation index (para FM)
  const updateModulationIndex = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.modulationIndex = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Previsualizar configuración
  const previewSynth = () => {
    if (currentLoopId.value === null) return
    
    const audioStore = useAudioStore()
    const loopsArr = Array.isArray(audioStore.loops) ? audioStore.loops : audioStore.loops?.value
    const loop = loopsArr?.[currentLoopId.value]
    
    if (!loop || !loop.synth) return

    try {
      // Crear sintetizador temporal para preview
      const tempSynth = createSynthFromConfig(tempSynthConfig.value)

      // Asegurar que el preview suene, sin tocar la cadena del loop
      try {
        if (typeof tempSynth.toDestination === 'function') {
          tempSynth.toDestination()
        } else {
          tempSynth.connect(Tone.getContext().destination)
        }
      } catch {}
      
      const DEBUG_VERBOSE = false
      const ctxState = Tone.context?.state
      const transportState = Tone.Transport?.state
      if (DEBUG_VERBOSE) {
        // Estado de transporte/sesión para preview (silenciado)
      }
      
      // Reproducir nota de prueba
      const testNote = 'C4'
      const useTime = ctxState === 'running' ? Tone.Transport?.now?.() : undefined
      tempSynth.triggerAttackRelease(testNote, '8n', useTime)
      
      // Limpiar después de un tiempo
      setTimeout(() => {
        try { tempSynth.disconnect() } catch {}
        try { tempSynth.dispose() } catch {}
      }, 2000)
    } catch (error) {
      console.error('Error en preview:', error)
      console.trace()
    }
  }

  // Aplicar configuración al loop
  const applySynthConfig = () => {
    if (currentLoopId.value === null) return
    
    try {
      const audioStore = useAudioStore()
      const loopId = currentLoopId.value
      const selectedType = tempSynthConfig.value.synthType || 'PolySynth'

      // Pasar SIEMPRE por audioStore.updateLoopSynth para unificar reemplazo
      const cfg = {
        type: selectedType,
        oscillator: { type: tempSynthConfig.value.oscillatorType },
        envelope: { ...tempSynthConfig.value.envelope },
        harmonicity: selectedType !== 'PolySynth' ? tempSynthConfig.value.harmonicity : undefined,
        modulationIndex: selectedType === 'FMSynth' ? tempSynthConfig.value.modulationIndex : undefined
      }

      audioStore.updateLoopSynth(loopId, cfg)
      
      // audioStore.updateLoopSynth ya sincroniza los campos del loop
      closeSynthEditor()
    } catch (error) {
      console.error('Error al aplicar configuración:', error)
    }
  }

  // Crear sintetizador desde configuración
  const createSynthFromConfig = (config) => {
    const synthConfig = {
      oscillator: { type: config.oscillatorType },
      envelope: config.envelope
    }

    let synth

    // Crear el tipo de sintetizador apropiado
    const resolvedType = config.synthType || 'PolySynth'
    switch (resolvedType) {
      case 'AMSynth':
        synth = new Tone.PolySynth(Tone.AMSynth, {
          ...synthConfig,
          harmonicity: config.harmonicity,
          modulation: {
            type: config.oscillatorType
          },
          modulationEnvelope: {
            attack: synthConfig.envelope?.attack ?? 0.03,
            decay: synthConfig.envelope?.decay ?? 0.3,
            sustain: 0.85,
            release: synthConfig.envelope?.release ?? 0.6
          },
          volume: 6
        })
        break
      
      case 'FMSynth':
        synth = new Tone.PolySynth(Tone.FMSynth, {
          ...synthConfig,
          harmonicity: config.harmonicity,
          modulationIndex: config.modulationIndex,
          modulation: {
            type: config.oscillatorType
          }
        })
        break
      
      case 'PluckSynth':
        synth = new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.7
        })
        break
      
      case 'MembraneSynth':
        synth = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: config.oscillatorType },
          envelope: config.envelope
        })
        break
      
      default: // PolySynth
        synth = new Tone.PolySynth(Tone.Synth, synthConfig)
        break
    }

    return synth
  }



  // Helper: descripción del tipo de sintetizador
  const getSynthTypeDescription = (type) => {
    switch (type) {
      case 'AMSynth':
        return 'Síntesis AM - modulación de amplitud con harmonicidad'
      case 'FMSynth':
        return 'Síntesis FM - modulación de frecuencia con harmonicidad e índice'
      default:
        return 'Sintetizador polifónico básico con envolvente ADSR'
    }
  }

  return {
    // Estado
    isModalOpen,
    currentLoopId,
    tempSynthConfig,
    synthTypes,
    oscillatorTypes,
    
    // Funciones
    openSynthEditor,
    closeSynthEditor,
    updateSynthType,
    updateOscillatorType,
    updateEnvelopeParam,
    updateHarmonicity,
    updateModulationIndex,
    previewSynth,
    applySynthConfig,
    cancelSynthChanges,
    createSynthFromConfig,
    getSynthTypeDescription
  }
})