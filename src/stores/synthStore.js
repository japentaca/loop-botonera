import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as Tone from 'tone'
import { useAudioStore } from './audioStore.js'

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
    modulationIndex: 10,
    // LFO Controls (Time Units synced with Tone.js Transport)
    tremolo: {
      speed: '8n',     // Tone.js time unit (4n, 8n, 16n, 1m, etc.)
      depth: 0.3       // 0-1
    },
    vibrato: {
      speed: '4n',     // Tone.js time unit
      depth: 10        // cents
    },
    glideTime: 0.02  // seconds
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
        modulationIndex: loop.modulationIndex || 10,
        tremolo: loop.tremolo || { speed: '8n', depth: 0.3 },
        vibrato: loop.vibrato || { speed: '4n', depth: 10 },
        glideTime: loop.glideTime || 0.02
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
          modulationIndex: originalSynthConfig.value.modulationIndex,
          tremolo: originalSynthConfig.value.tremolo,
          vibrato: originalSynthConfig.value.vibrato,
          glideTime: originalSynthConfig.value.glideTime
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
          modulationIndex: selectedType === 'FMSynth' ? tempSynthConfig.value.modulationIndex : undefined,
          tremolo: tempSynthConfig.value.tremolo,
          vibrato: tempSynthConfig.value.vibrato,
          glideTime: tempSynthConfig.value.glideTime
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

  // Actualizar tremolo speed
  const updateTremoloSpeed = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.tremolo.speed = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar tremolo depth
  const updateTremoloDepth = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.tremolo.depth = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar vibrato speed
  const updateVibratoSpeed = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.vibrato.speed = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar vibrato depth
  const updateVibratoDepth = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.vibrato.depth = isNaN(num) ? value : num
    scheduleApplySynthDebounced()
  }

  // Actualizar glide time
  const updateGlideTime = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value)
    tempSynthConfig.value.glideTime = isNaN(num) ? value : num
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
      // Create basic synth for preview (LFO effects are handled by the main audio engine)
      const tempSynth = createBasicSynthForPreview(tempSynthConfig.value)

      // Connect to destination
      tempSynth.toDestination()

      // Play test note
      const testNote = 'C4'
      tempSynth.triggerAttackRelease(testNote, '8n')

      // Cleanup after a short time
      setTimeout(() => {
        tempSynth.dispose()
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
        modulationIndex: selectedType === 'FMSynth' ? tempSynthConfig.value.modulationIndex : undefined,
        tremolo: tempSynthConfig.value.tremolo,
        vibrato: tempSynthConfig.value.vibrato,
        glideTime: tempSynthConfig.value.glideTime
      }

      audioStore.updateLoopSynth(loopId, cfg)

      // audioStore.updateLoopSynth ya sincroniza los campos del loop
      closeSynthEditor()
    } catch (error) {
      console.error('Error al aplicar configuración:', error)
    }
  }

  // Create basic synth for preview without LFO (LFO is handled by audio engine)
  const createBasicSynthForPreview = (config) => {
    const synthConfig = {
      oscillator: { type: config.oscillatorType },
      envelope: config.envelope,
      portamento: config.glideTime || 0
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
          resonance: 0.7,
          portamento: config.glideTime || 0
        })
        break

      case 'MembraneSynth':
        synth = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: config.oscillatorType },
          envelope: config.envelope,
          portamento: config.glideTime || 0
        })
        break

      default: // PolySynth
        synth = new Tone.PolySynth(Tone.Synth, {
          ...synthConfig,
          portamento: config.glideTime || 0
        })
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
    updateTremoloSpeed,
    updateTremoloDepth,
    updateVibratoSpeed,
    updateVibratoDepth,
    updateGlideTime,
    previewSynth,
    applySynthConfig,
    cancelSynthChanges,
    createBasicSynthForPreview,
    getSynthTypeDescription
  }
})