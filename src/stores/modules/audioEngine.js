import { ref, markRaw, computed } from 'vue'
import * as Tone from 'tone'

/**
 * Motor de audio principal que maneja la inicialización de Tone.js,
 * efectos globales, transporte y configuración de audio
 */
export const useAudioEngine = () => {
  // Estado del motor de audio
  const audioInitialized = ref(false)
  const isPlaying = ref(false)
  const currentPulse = ref(0)
  const currentBeat = computed(() => currentPulse.value % 16)
  const tempo = ref(120)
  const masterVol = ref(0.7)
  const delayDivision = ref('8n')

  // Referencias de audio globales
  let delay = null
  let reverb = null
  let masterGain = null
  let _feedbackResetTimer = null

  // Configuración de debug
  const DEBUG_AUDIO = false
  const BYPASS_EFFECTS_FOR_TEST = false

  // Funciones de utilidad para efectos
  const softResetDelayFeedback = () => {
    if (!audioInitialized.value || !delay) return
    try {
      const original = delay.feedback?.value ?? 0.4
      // Reducir feedback a cero temporalmente
      if (delay.feedback) delay.feedback.value = 0
      if (_feedbackResetTimer) clearTimeout(_feedbackResetTimer)
      const holdMs = Tone.Time('16n').toMilliseconds()
      _feedbackResetTimer = setTimeout(() => {
        try {
          if (delay?.feedback) delay.feedback.value = original
        } catch (e) { }
      }, Math.max(10, holdMs))
    } catch (e) { }
  }

  const updateDelayTime = () => {
    if (!audioInitialized.value || !delay) return
    const seconds = Tone.Time(delayDivision.value).toSeconds()
    if (delay.delayTime && delay.delayTime.value !== seconds) {
      delay.delayTime.value = seconds
    }
  }

  // Inicializar el motor de audio
  const initAudio = async () => {
    console.log('🔊 AUDIO ENGINE: Starting audio engine initialization - audioInitialized:', audioInitialized.value);
    console.log('🔊 AUDIO ENGINE: Browser info:', navigator.userAgent);
    console.log('🔊 AUDIO ENGINE: Tone.context.state:', Tone.context.state);

    if (audioInitialized.value) {
      console.log('🔊 AUDIO ENGINE: Audio already initialized, skipping');
      return
    }

    try {
      console.log('🔊 AUDIO ENGINE: Starting Tone.js...');
      console.log('🔊 AUDIO ENGINE: Pre-start - Tone.context.state:', Tone.context.state);
      await Tone.start()
      console.log('🔊 AUDIO ENGINE: Tone.js started successfully');
      console.log('🔊 AUDIO ENGINE: Post-start - Tone.context.state:', Tone.context.state);

      // Crear cadena de efectos globales
      console.log('🔊 AUDIO ENGINE: Creating master gain node');
      masterGain = markRaw(new Tone.Gain(masterVol.value).toDestination())
      console.log('🔊 AUDIO ENGINE: Master gain node created');

      if (!BYPASS_EFFECTS_FOR_TEST) {
        console.log('🔊 AUDIO ENGINE: Creating delay effect');
        delay = markRaw(new Tone.PingPongDelay(delayDivision.value, 0.4).connect(masterGain))
        console.log('🔊 AUDIO ENGINE: Creating reverb effect');
        reverb = markRaw(new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(masterGain))
        await reverb.generate()
        console.log('🔊 AUDIO ENGINE: Effects created successfully');
      }

      // Configurar transporte
      console.log('🔊 AUDIO ENGINE: Configuring transport, BPM:', tempo.value);
      Tone.Transport.bpm.value = tempo.value
      updateDelayTime()

      audioInitialized.value = true
      console.log('🔊 AUDIO ENGINE: Audio engine initialization complete');
    } catch (error) {
      console.error('🔴 AUDIO ENGINE: Error al inicializar motor de audio:', error)
      throw error
    }
  }

  // Configurar el callback del transporte
  const setupTransportCallback = (callback) => {
    if (!audioInitialized.value) return

    Tone.Transport.scheduleRepeat((time) => {
      currentPulse.value = currentPulse.value + 1
      callback(time, currentPulse.value)
    }, "16n")
  }

  // Control de reproducción
  const startTransport = async () => {
    console.log('🎛️ AUDIO_ENGINE: startTransport called - isPlaying:', isPlaying.value, 'audioInitialized:', audioInitialized.value);
    if (!isPlaying.value) {
      console.log('🎛️ AUDIO_ENGINE: About to call initAudio() from startTransport');
      await initAudio()
      console.log('🎛️ AUDIO_ENGINE: initAudio() completed in startTransport');
      Tone.Transport.start()
      isPlaying.value = true
      console.log('🎛️ AUDIO_ENGINE: Transport started, isPlaying set to true');
    }
  }

  const stopTransport = () => {
    if (isPlaying.value) {
      Tone.Transport.pause()
      isPlaying.value = false
    }
  }

  const togglePlay = async () => {
    console.log('🎛️ AUDIO_ENGINE: togglePlay called - Current isPlaying:', isPlaying.value);
    if (isPlaying.value) {
      stopTransport()
    } else {
      await startTransport()
    }
    console.log('🎛️ AUDIO_ENGINE: togglePlay completed - New isPlaying:', isPlaying.value);
  }

  // Actualización de parámetros globales
  const updateTempo = (newTempo) => {
    const t = Number(newTempo ?? tempo.value)
    tempo.value = t
    if (audioInitialized.value) {
      Tone.Transport.bpm.value = t
      updateDelayTime()
      softResetDelayFeedback()
    }
  }

  const updateMasterVolume = (newVolumePercent) => {
    const volPercent = Number(newVolumePercent)
    const vol = Math.max(0, Math.min(100, volPercent)) / 100
    masterVol.value = vol
    if (audioInitialized.value && masterGain) {
      masterGain.gain.value = vol
    }
  }

  const updateDelayDivision = (division) => {
    const allowed = ['16n', '8n', '4n', '2n', '8t', '4t', '2t']
    const div = allowed.includes(division) ? division : '8n'
    delayDivision.value = div
    updateDelayTime()
    softResetDelayFeedback()
  }

  // Computed properties
  const masterVolume = computed(() => Math.round(masterVol.value * 100))

  // Getters para acceso a objetos de audio
  const getAudioObjects = () => ({
    delay,
    reverb,
    masterGain,
    audioInitialized: audioInitialized.value
  })

  // Crear conexiones de audio para un sintetizador
  const createAudioChain = (synthConfig, effectsConfig = {}) => {
    if (!audioInitialized.value) {
      throw new Error('Motor de audio no inicializado')
    }

    const {
      delayAmount = 0.2,
      reverbAmount = 0.3,
      pan = 0,
      synthType = 'PolySynth'
    } = effectsConfig

    // Crear sintetizador según el tipo
    let synth
    switch (synthType) {
      case 'Synth':
        synth = markRaw(new Tone.Synth(synthConfig))
        break
      case 'AMSynth':
        synth = markRaw(new Tone.PolySynth(Tone.AMSynth, synthConfig))
        break
      case 'FMSynth':
        synth = markRaw(new Tone.PolySynth(Tone.FMSynth, synthConfig))
        break
      case 'PluckSynth':
        synth = markRaw(new Tone.PolySynth(Tone.PluckSynth, synthConfig))
        break
      case 'MembraneSynth':
        synth = markRaw(new Tone.PolySynth(Tone.MembraneSynth, synthConfig))
        break
      default: // PolySynth
        synth = markRaw(new Tone.PolySynth(Tone.Synth, synthConfig))
        break
    }

    // Crear efectos individuales
    const panner = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Panner(pan))
    const delaySend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(delayAmount))
    const reverbSend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(reverbAmount))

    // Conectar cadena de audio
    if (BYPASS_EFFECTS_FOR_TEST) {
      synth.connect(masterGain)
    } else {
      synth.connect(panner)
      synth.connect(delaySend)
      synth.connect(reverbSend)

      if (masterGain) {
        panner.connect(masterGain)
      } else {
        panner.toDestination()
      }
      if (delay) delaySend.connect(delay)
      if (reverb) reverbSend.connect(reverb)
    }

    return {
      synth,
      panner,
      delaySend,
      reverbSend
    }
  }

  // Reproducir una nota individual
  const playNote = (audioChain, midiNote, duration = '16n', velocity = 1, time = undefined) => {
    try {
      const { synth } = audioChain

      // Validaciones
      if (!synth || typeof synth.triggerAttackRelease !== 'function') return
      if (!Tone.context || Tone.context.state !== 'running') return
      if (Number.isNaN(midiNote) || midiNote < 0 || midiNote > 127) return

      // Calcular frecuencia
      const freq = Tone.Frequency(midiNote, 'midi').toFrequency()
      const safeVelocity = Math.max(0, Math.min(1, velocity))
      const useTime = typeof time === 'number' && isFinite(time) ? time : undefined

      // Disparar la nota
      synth.triggerAttackRelease(freq, duration, useTime, safeVelocity)
    } catch (error) {
      console.error('Error al reproducir nota:', error)
    }
  }

  return {
    // Estado
    audioInitialized,
    isPlaying,
    currentPulse,
    currentBeat,
    tempo,
    masterVol,
    masterVolume,
    delayDivision,

    // Funciones principales
    initAudio,
    setupTransportCallback,
    togglePlay,
    startTransport,
    stopTransport,

    // Configuración
    updateTempo,
    updateMasterVolume,
    updateDelayDivision,

    // Utilidades de audio
    getAudioObjects,
    createAudioChain,
    playNote,

    // Efectos
    softResetDelayFeedback,
    updateDelayTime
  }
}