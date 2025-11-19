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

  // OPTIMIZATION: Use non-reactive counter for high-frequency updates
  // Only update ref on measure boundaries to reduce reactivity cascade
  let _internalPulse = 0
  const currentPulse = ref(0)
  const currentBeat = computed(() => currentPulse.value % 16)
  const beatFlash = ref(false) // Simple toggle for tempo indicator

  const tempo = ref(120)
  const masterVol = ref(0.7)
  const delayDivision = ref('8n')

  // Referencias de audio globales
  let delay = null
  let reverb = null
  let masterGain = null
  let _feedbackResetTimer = null
  // Fallback transport interval id for Node/test environments where Tone.Transport isn't available
  let __nodeTransportIntervalId = null

  // Configuración de debug
  const DEBUG_AUDIO = false
  const BYPASS_EFFECTS_FOR_TEST = false

  // Funciones de utilidad para efectos
  const softResetDelayFeedback = () => {
    if (!audioInitialized.value || !delay) return
    const original = delay.feedback?.value ?? 0.4
    // Reducir feedback a cero temporalmente
    if (delay.feedback) delay.feedback.value = 0
    if (_feedbackResetTimer) clearTimeout(_feedbackResetTimer)
    const holdMs = Tone.Time('16n').toMilliseconds()
    _feedbackResetTimer = setTimeout(() => {
      if (delay?.feedback) delay.feedback.value = original
    }, holdMs)
  }

  const updateDelayTime = () => {
    if (!audioInitialized.value || !delay) return
    const seconds = Tone.Time(delayDivision.value).toSeconds()
    if (delay.delayTime && delay.delayTime.value !== seconds) {
      delay.delayTime.value = seconds
    }
  }

  // Reset internal counters to re-sync loop positions without stopping playback
  const resetCounters = () => {
    if (!audioInitialized.value) return
    _internalPulse = 0
    currentPulse.value = 0
    // Keep transport running; just realign step calculation
  }

  // Inicializar el motor de audio
  const initAudio = async () => {

    if (audioInitialized.value) {
      return
    }

    await Tone.start()

    // Crear cadena de efectos globales
    masterGain = markRaw(new Tone.Gain(masterVol.value).toDestination())

    if (!BYPASS_EFFECTS_FOR_TEST) {
      delay = markRaw(new Tone.PingPongDelay(delayDivision.value, 0.4).connect(masterGain))
      reverb = markRaw(new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(masterGain))

      // OPTIMIZATION: Generate reverb in background to avoid blocking initialization
      // Allow playback to start immediately with dry reverb
      reverb.generate().catch(err => {
        console.warn('Reverb generation failed:', err)
      })
    }

    // Configurar transporte
    Tone.Transport.bpm.value = tempo.value
    updateDelayTime()

    audioInitialized.value = true
  }

  // Transport callback management - allow registering multiple listeners
  const _transportMainCallback = { cb: null }
  const transportListeners = new Set()

  const setupTransportCallback = (callback) => {
    if (!audioInitialized.value) return
    _transportMainCallback.cb = callback
    // Clear any old listeners if any; keep the registered listeners set
    // We'll call main callback + all registered transport listeners on each pulse
  }

  const registerTransportListener = (fn) => {
    if (typeof fn === 'function') transportListeners.add(fn)
  }

  const unregisterTransportListener = (fn) => {
    transportListeners.delete(fn)
  }

  // Provide a test helper that directly triggers a transport pulse (useful for Node tests)
  const testTransportPulse = () => {
    const time = Date.now()
    _internalPulse = _internalPulse + 1
    if (_internalPulse % 4 === 0) {
      currentPulse.value = _internalPulse
      beatFlash.value = !beatFlash.value
    }
    try { if (typeof _transportMainCallback.cb === 'function') _transportMainCallback.cb(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport main callback error', err) }
    for (const l of transportListeners) { try { l(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport listener error', err) } }
    return _internalPulse
  }

  // Install Tone transport scheduler if available, otherwise we'll run a fallback scheduler in start/stopTransport
  if (typeof Tone?.Transport?.scheduleRepeat === 'function') {
    Tone.Transport.scheduleRepeat((time) => {
      _internalPulse = _internalPulse + 1

      // Update reactive ref every 4 pulses (quarter note / beat) for tempo indicator
      if (_internalPulse % 4 === 0) {
        currentPulse.value = _internalPulse
        beatFlash.value = !beatFlash.value // Toggle flash on each beat
      }

      // Call main callback if configured
      try {
        if (typeof _transportMainCallback.cb === 'function') _transportMainCallback.cb(time, _internalPulse)
      } catch (err) {
        console.warn('[audioEngine] transport main callback error', err)
      }

      // Call additional listeners
      for (const l of transportListeners) {
        try { l(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport listener error', err) }
      }
    }, "16n")
  }

  // Control de reproducción
  const startTransport = async () => {
    if (!isPlaying.value) {
      await initAudio()
      // If Tone.Transport has scheduleRepeat available, use Tone transport; otherwise use fallback interval.
      if (typeof Tone?.Transport?.start === 'function' && typeof Tone?.Transport?.scheduleRepeat === 'function') {
        Tone.Transport.start()
      } else {
        // Fallback scheduler: call callbacks according to tempo and pulses per beat
        const pulsesPerBeat = 4
        const pulseMs = (60000 / (tempo.value || 120)) / pulsesPerBeat
        // Create fallback interval to mimic Tone.Transport
        if (__nodeTransportIntervalId == null) {
          __nodeTransportIntervalId = setInterval(() => {
            const time = Date.now()
            _internalPulse = _internalPulse + 1
            if (_internalPulse % 4 === 0) {
              currentPulse.value = _internalPulse
              beatFlash.value = !beatFlash.value
            }
            try { if (typeof _transportMainCallback.cb === 'function') _transportMainCallback.cb(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport main callback error', err) }
            for (const l of transportListeners) { try { l(time, _internalPulse) } catch (err) { console.warn('[audioEngine] transport listener error', err) } }
          }, Math.max(10, Math.round(pulseMs)))
        }
      }
      isPlaying.value = true
    }
  }

  const stopTransport = () => {
    if (isPlaying.value) {
      if (typeof Tone?.Transport?.pause === 'function' && typeof Tone?.Transport?.scheduleRepeat === 'function') {
        Tone.Transport.pause()
      } else {
        if (__nodeTransportIntervalId != null) {
          clearInterval(__nodeTransportIntervalId)
          __nodeTransportIntervalId = null
        }
      }
      isPlaying.value = false
    }
  }

  const togglePlay = async () => {
    if (isPlaying.value) {
      stopTransport()
    } else {
      await startTransport()
    }
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
      volume = 0.5,
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

    // Set initial synth volume
    synth.volume.value = Tone.gainToDb(volume)

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
    const { synth } = audioChain

    if (!synth) {
      console.error('❌ audioEngine.playNote: No synth in audioChain!')
      return
    }

    // Calcular frecuencia
    const freq = Tone.Frequency(midiNote, 'midi').toFrequency()
    const safeVelocity = velocity
    const useTime = time

    // Disparar la nota
    synth.triggerAttackRelease(freq, duration, useTime, safeVelocity)
  }

  return {
    // Estado
    audioInitialized,
    isPlaying,
    currentPulse,
    currentBeat,
    beatFlash,
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

    // Transport listener registration for modules that need to step on pulses
    registerTransportListener,
    unregisterTransportListener,

    // Reset counters for sync
    resetCounters,

    // Efectos
    softResetDelayFeedback,
    updateDelayTime,
    // Test helpers (for Node tests)
    testTransportPulse,
  }
}
