import { ref, watch, onUnmounted } from 'vue'
import * as Tone from 'tone'

export function useAudio() {
  const audioContext = ref(null)
  const isInitialized = ref(false)
  
  // Inicializar contexto de audio
  const initializeAudio = async () => {
    if (isInitialized.value) return true
    
    try {
      await Tone.start()
      audioContext.value = Tone.getContext()
      isInitialized.value = true
      // Contexto de audio inicializado
      return true
    } catch (error) {
      console.error('Error al inicializar audio:', error)
      return false
    }
  }

  // Limpiar recursos de audio al desmontar
  onUnmounted(() => {
    if (audioContext.value) {
      Tone.Transport.stop()
      Tone.Transport.cancel()
    }
  })

  return {
    audioContext,
    isInitialized,
    initializeAudio
  }
}

export function useEffects() {
  const delay = ref(null)
  const reverb = ref(null)
  const masterGain = ref(null)
  
  // Crear cadena de efectos
  const createEffectsChain = async (masterVolume = 0.7) => {
    try {
      // Crear efectos
      masterGain.value = new Tone.Gain(masterVolume).toDestination()
      delay.value = new Tone.PingPongDelay("8n", 0.4).connect(masterGain.value)
      reverb.value = new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(masterGain.value)
      
      // Generar impulse response para reverb
      await reverb.value.generate()
      
      // Cadena de efectos creada
      return true
    } catch (error) {
      console.error('Error al crear efectos:', error)
      return false
    }
  }

  // Actualizar tiempo de delay basado en tempo
  const updateDelayTime = (tempo) => {
    if (delay.value && delay.value.delayTime) {
      const delayTime = Tone.Time('8n').toSeconds()
      delay.value.delayTime.value = delayTime
    }
  }

  // Actualizar volumen master
  const updateMasterVolume = (volume) => {
    if (masterGain.value) {
      masterGain.value.gain.value = volume
    }
  }

  // Limpiar efectos
  const disposeEffects = () => {
    if (delay.value) {
      delay.value.dispose()
      delay.value = null
    }
    if (reverb.value) {
      reverb.value.dispose()
      reverb.value = null
    }
    if (masterGain.value) {
      masterGain.value.dispose()
      masterGain.value = null
    }
  }

  onUnmounted(() => {
    disposeEffects()
  })

  return {
    delay,
    reverb,
    masterGain,
    createEffectsChain,
    updateDelayTime,
    updateMasterVolume,
    disposeEffects
  }
}

export function useTransport() {
  const isPlaying = ref(false)
  const currentStep = ref(0)
  const tempo = ref(120)
  
  // Configurar transporte
  const setupTransport = (callback) => {
    Tone.Transport.bpm.value = tempo.value
    
    // Programar callback para cada paso
    Tone.Transport.scheduleRepeat((time) => {
      currentStep.value = (currentStep.value + 1) % 16
      if (callback) {
        callback(time, currentStep.value)
      }
    }, "16n")
  }

  // Iniciar transporte
  const startTransport = () => {
    if (!isPlaying.value) {
      Tone.Transport.start()
      isPlaying.value = true
    }
  }

  // Pausar transporte
  const pauseTransport = () => {
    if (isPlaying.value) {
      Tone.Transport.pause()
      isPlaying.value = false
    }
  }

  // Detener transporte
  const stopTransport = () => {
    Tone.Transport.stop()
    isPlaying.value = false
    currentStep.value = 0
  }

  // Actualizar tempo
  const updateTempo = (newTempo) => {
    tempo.value = newTempo
    Tone.Transport.bpm.value = newTempo
  }

  // Observar cambios en tempo
  watch(tempo, (newTempo) => {
    Tone.Transport.bpm.value = newTempo
  })

  onUnmounted(() => {
    stopTransport()
  })

  return {
    isPlaying,
    currentStep,
    tempo,
    setupTransport,
    startTransport,
    pauseTransport,
    stopTransport,
    updateTempo
  }
}

export function useSynthesizer() {
  // Crear sintetizador con configuración
  const createSynth = (config = {}) => {
    const defaultConfig = {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8
      }
    }

    const synthConfig = { ...defaultConfig, ...config }
    
    switch (config.type) {
      case 'AMSynth': {
        const amEnvelope = {
          attack: synthConfig.envelope?.attack ?? 0.03,
          decay: synthConfig.envelope?.decay ?? 0.3,
          sustain: synthConfig.envelope?.sustain ?? 0.6,
          release: synthConfig.envelope?.release ?? 0.6
        }
        return new Tone.PolySynth(Tone.AMSynth, {
          ...synthConfig,
          envelope: amEnvelope,
          harmonicity: (typeof config.harmonicity === 'number') ? config.harmonicity : 2,
          modulation: { type: synthConfig.oscillator.type },
          modulationEnvelope: {
            attack: amEnvelope.attack,
            decay: amEnvelope.decay,
            sustain: 0.85,
            release: amEnvelope.release
          },
          volume: 6
        })
      }
      
      case 'FMSynth': {
        const fmEnvelope = {
          attack: synthConfig.envelope?.attack ?? 0.03,
          decay: synthConfig.envelope?.decay ?? 0.3,
          sustain: synthConfig.envelope?.sustain ?? 0.6,
          release: synthConfig.envelope?.release ?? 0.7
        }
        return new Tone.PolySynth(Tone.FMSynth, {
          ...synthConfig,
          envelope: fmEnvelope,
          harmonicity: (typeof config.harmonicity === 'number') ? config.harmonicity : 2,
          modulationIndex: (typeof config.modulationIndex === 'number') ? config.modulationIndex : 10,
          modulation: { type: synthConfig.oscillator.type }
        })
      }
      
      case 'PluckSynth':
        return new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.7
        })
      
      case 'MembraneSynth':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: synthConfig.oscillator,
          envelope: synthConfig.envelope
        })
      
      default:
        return new Tone.PolySynth(Tone.Synth, synthConfig)
    }
  }

  // Conectar sintetizador a efectos
  const connectSynthToEffects = (synth, effects) => {
    const { delay, reverb, masterGain } = effects
    
    // Crear sends para efectos
    const panner = new Tone.Panner(0)
    const delaySend = new Tone.Gain(0.2)
    const reverbSend = new Tone.Gain(0.3)
    
    // Conectar cadena
    synth.connect(panner)
    synth.connect(delaySend)
    synth.connect(reverbSend)
    
    panner.toDestination()
    if (delay) delaySend.connect(delay)
    if (reverb) reverbSend.connect(reverb)
    
    return { panner, delaySend, reverbSend }
  }

  // Reproducir nota
  const playNote = (synth, note, duration = "8n", time = undefined, velocity = 1) => {
    if (!synth || typeof synth.triggerAttackRelease !== 'function') return

    try {
      const noteName = typeof note === 'number' 
        ? Tone.Frequency(note, "midi").toNote()
        : note

      const DEBUG_VERBOSE = false
      const ctxState = Tone.context?.state
      const transportState = Tone.Transport?.state
      // DEBUG_VERBOSE: silenciado

      // Si el contexto no está running, disparar inmediatamente para evitar errores de scheduling
      const useTime = ctxState === 'running' ? time : undefined
      
      synth.triggerAttackRelease(noteName, duration, useTime, velocity)
    } catch (error) {
      console.error('Error al reproducir nota:', error)
      console.trace()
    }
  }

  return {
    createSynth,
    connectSynthToEffects,
    playNote
  }
}