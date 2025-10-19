import { defineStore } from 'pinia'
import { ref, computed, markRaw } from 'vue'
import * as Tone from 'tone'
import { useSynthesizer } from '../composables/useAudio'
import { useScales } from '../composables/useMusic'

export const useAudioStore = defineStore('audio', () => {
  // Estado reactivo
  const audioInitialized = ref(false)
  const isPlaying = ref(false)
  const currentPulse = ref(0)
  const tempo = ref(120)
  const transpose = ref(0)
  const masterVol = ref(0.7)
  const loops = ref([])
  const delayDivision = ref('8n')
  const currentScale = ref('major') // Escala actual seleccionada
  
  // Derivados para UI
  const currentBeat = computed(() => currentPulse.value % 16)
  const masterVolume = computed({
    get: () => Math.round(masterVol.value * 100),
    set: (v) => {
      const volPercent = Math.max(0, Math.min(100, Number(v)))
      masterVol.value = volPercent / 100
      if (audioInitialized.value && masterGain) {
        masterGain.gain.value = masterVol.value
      }
    }
  })
  
  // Depuración de audio
  const DEBUG_AUDIO = false
  const DEBUG_VERBOSE = false
  const DEBUG_INIT = false
  const DEBUG_TRANSPORT = false
  const DEBUG_LOOPS = false
  const BYPASS_EFFECTS_FOR_TEST = false
  const USE_SIMPLE_SYNTH = true
  const dbg = (msg, data = undefined) => {
    if (DEBUG_AUDIO) {
      // Silenciado: logs de debug no esenciales
    }
  }

  // Referencias de audio
  let delay, reverb, masterGain
  let _feedbackResetTimer = null

  // Constantes
  const NUM_LOOPS = 8
  const { scales, scaleNames, scaleNamesSpanish } = useScales()
  const synthTypes = ['sine', 'triangle', 'square', 'sawtooth']

  // Funciones auxiliares
  const generatePattern = (length) => {
    const pattern = new Array(length).fill(false)
    const density = 0.3 + Math.random() * 0.4
    for (let i = 0; i < length; i++) {
      if (Math.random() < density) {
        pattern[i] = true
      }
    }
    // Asegurar al menos una nota
    if (!pattern.some(Boolean)) {
      pattern[0] = true
    }
    return pattern
  }

  const generateNotes = (scale, baseNote, length) => {
    return Array.from({ length }, () => {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * 3)
      return baseNote + scale[scaleIndex] + (octave * 12)
    })
  }

  // Crear loop básico sin audio (para mostrar en UI)
  const createBasicLoop = (id) => {
    const scale = scales[currentScale.value]
    const baseNote = 36 + Math.floor(Math.random() * 24)
    const synthType = 'sine'
    const length = 16
    
    const envelope = {
      attack: 0.01,
      decay: 0.3,
      sustain: 0.5,
      release: 0.8
    }

    return {
      id,
      isActive: false,
      scale,
      baseNote,
      synthType,
      pattern: generatePattern(length),
      notes: generateNotes(scale, baseNote, length),
      length,
      synth: null,
      panner: null,
      delaySend: null,
      reverbSend: null,
      delayAmount: 0.2,
      reverbAmount: 0.3,
      volume: 0.5,
      pan: 0,
      envelope
    }
  }

  const createLoop = (id) => {
    const scale = scales[currentScale.value]
    const baseNote = 36 + Math.floor(Math.random() * 24)
    const synthType = 'sine'
    const length = 16
    
    const envelope = {
      attack: 0.01,
      decay: 0.3,
      sustain: 0.5,
      release: 0.8
    }

    // Crear sintetizador
    const synthConfig = {
      oscillator: { type: synthType },
      envelope
    }
    const synth = markRaw(USE_SIMPLE_SYNTH ? new Tone.Synth(synthConfig) : new Tone.PolySynth(Tone.Synth, synthConfig))
 
     // Efectos y ruteo
     const panner = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Panner(0))
     const delaySend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(0.2))
     const reverbSend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(0.3))

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
      id,
      isActive: false,
      scale,
      baseNote,
      synthType,
      pattern: generatePattern(length),
      notes: generateNotes(scale, baseNote, length),
      length,
      synth,
      panner,
      delaySend,
      reverbSend,
      delayAmount: 0.2,
      reverbAmount: 0.3,
      volume: 0.5,
      pan: 0,
      envelope
    }
  }

  // Reset suave del feedback para re-fasear el delay
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
        } catch {}
      }, Math.max(10, holdMs))
    } catch {}
  }

  // Sincronizar delay con tempo según división seleccionada
  const updateDelayTime = () => {
    if (!audioInitialized.value || !delay) return
    const seconds = Tone.Time(delayDivision.value).toSeconds()
    if (delay.delayTime && delay.delayTime.value !== seconds) {
      delay.delayTime.value = seconds
    }
  }

  // Inicializar audio
  const initAudio = async () => {
    if (audioInitialized.value) return

    try {
      await Tone.start()

      // Crear cadena de efectos
      masterGain = markRaw(new Tone.Gain(masterVol.value).toDestination())
      if (!BYPASS_EFFECTS_FOR_TEST) {
        delay = markRaw(new Tone.PingPongDelay(delayDivision.value, 0.4).connect(masterGain))
        reverb = markRaw(new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(masterGain))
        await reverb.generate()
      } else {
        delay = null
        reverb = null
      }

      // Configurar transporte
      Tone.Transport.bpm.value = tempo.value
      updateDelayTime()

      // Actualizar loops existentes con objetos de audio
      loops.value.forEach((loop) => {
        const synthConfig = {
          oscillator: { type: loop.synthType },
          envelope: loop.envelope
        }

        const synth = markRaw(USE_SIMPLE_SYNTH ? new Tone.Synth(synthConfig) : new Tone.PolySynth(Tone.Synth, synthConfig))
        const panner = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Panner(loop.pan))
        const delaySend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(loop.delayAmount))
        const reverbSend = BYPASS_EFFECTS_FOR_TEST ? null : markRaw(new Tone.Gain(loop.reverbAmount))

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

        // Actualizar el loop con los objetos de audio
        loop.synth = synth
        loop.panner = panner
        loop.delaySend = delaySend
        loop.reverbSend = reverbSend
      })

      // Programar reloj de transporte y reproducción de loops
      Tone.Transport.scheduleRepeat((time) => {
        currentPulse.value = currentPulse.value + 1

        // Ejecutar loops activos en este pulso
        loops.value.forEach(loop => {
          if (loop.isActive && loop.pattern[currentPulse.value % loop.length]) {
            playNote(loop, time, currentPulse.value % loop.length)
          }
        })
      }, "16n")

      audioInitialized.value = true
    } catch (error) {
      console.error('Error al inicializar audio:', error)
    }
  }

  // Reproducir nota
  const playNote = (loop, time, step) => {
    try {
      // Validar sintetizador y nota
      if (!loop?.synth || !loop?.notes?.[step]) return
      if (typeof loop.synth.triggerAttackRelease !== 'function') return

      // Validar contexto de audio
      if (!Tone.context || Tone.context.state !== 'running') return

      // Calcular frecuencia desde nota MIDI
      const midiNote = loop.notes[step] + transpose.value
      if (Number.isNaN(midiNote) || midiNote < 0 || midiNote > 127) return
      const freq = Tone.Frequency(midiNote, 'midi').toFrequency()

      // No automatizar parámetros dentro del callback: usar velocity directo
      const velocity = Math.max(0, Math.min(1, loop.volume ?? 1))

      // Asegurar tiempo válido
      if (typeof time !== 'number' || !isFinite(time)) return

      // Disparar la nota usando el tiempo del transporte
      loop.synth.triggerAttackRelease(freq, '16n', time, velocity)
    } catch (error) {
      console.error('Error al reproducir nota:', error)
      try {
        // Fallback: sintetizador temporal directo a destino
        const temp = new Tone.Synth().toDestination()
        const midiNote = loop?.notes?.[step]
        if (typeof midiNote === 'number' && isFinite(midiNote)) {
          const noteName = Tone.Frequency(midiNote + (transpose?.value || 0), 'midi').toNote()
          const useTime = Tone.context?.state === 'running' && typeof time === 'number' ? time : undefined
          temp.triggerAttackRelease(noteName, '16n', useTime)
        }
        setTimeout(() => temp.dispose(), 800)
      } catch (err2) {
        console.error('Fallback también falló:', err2)
      }
    }
  }

  // Toggle play/stop
  const togglePlay = async () => {
    if (!isPlaying.value) {
      await initAudio()
      Tone.Transport.start()
      isPlaying.value = true
    } else {
      Tone.Transport.pause()
      isPlaying.value = false
    }
  }

  // Toggle loop
  const toggleLoop = (id) => {
    if (!audioInitialized.value) return
    const loop = loops.value[id]
    loop.isActive = !loop.isActive
  }

  // Actualizar parámetro de loop
  const updateLoopParam = (id, param, value) => {
    const loop = loops.value[id]

    switch (param) {
      case 'length': {
        const newLenRaw = Number(value)
        const newLen = Math.max(1, Math.round(newLenRaw))
        loop.length = newLen
        loop.pattern = generatePattern(newLen)
        loop.notes = generateNotes(loop.scale, loop.baseNote, newLen)
        break
      }
      case 'delay': {
        const amt = Number(value) / 100
        loop.delayAmount = amt
        if (loop.delaySend) loop.delaySend.gain.value = amt
        break
      }
      case 'delayAmount': {
        const amt = Number(value)
        loop.delayAmount = amt
        if (loop.delaySend) loop.delaySend.gain.value = amt
        break
      }
      case 'reverb': {
        const amt = Number(value) / 100
        loop.reverbAmount = amt
        if (loop.reverbSend) loop.reverbSend.gain.value = amt
        break
      }
      case 'reverbAmount': {
        const amt = Number(value)
        loop.reverbAmount = amt
        if (loop.reverbSend) loop.reverbSend.gain.value = amt
        break
      }
      case 'volume': {
        const v = Math.abs(value) <= 1 ? Number(value) : Number(value) / 100
        loop.volume = Math.max(0, Math.min(1, v))
        break
      }
      case 'pan': {
        const p = Math.abs(value) <= 1 ? Number(value) : Number(value) / 100
        const pan = Math.max(-1, Math.min(1, p))
        if (loop.panner && loop.panner.pan) {
          loop.panner.pan.value = pan
        }
        loop.pan = pan
        break
      }
    }
  }

  // Actualizar tempo
  const updateTempo = (newTempo) => {
    const t = Number(newTempo ?? tempo.value)
    tempo.value = t
    if (audioInitialized.value) {
      Tone.Transport.bpm.value = t
      updateDelayTime()
      softResetDelayFeedback()
    }
  }

  // Actualizar volumen master (porcentaje 0-100)
  const updateMasterVolume = (newVolumePercent) => {
    const volPercent = Number(newVolumePercent ?? masterVolume.value)
    const vol = Math.max(0, Math.min(100, volPercent)) / 100
    masterVol.value = vol
    if (audioInitialized.value && masterGain) {
      masterGain.gain.value = vol
    }
  }

  // Actualizar transposición
  const updateTranspose = (value) => {
    transpose.value = Number(value)
  }

  // Cambiar escala actual y regenerar todos los loops
  const updateScale = (newScale) => {
    if (!scales[newScale]) return
    currentScale.value = newScale
    
    // Regenerar todos los loops con la nueva escala
    if (audioInitialized.value) {
      regenerateAllLoops()
    } else {
      // Si no está inicializado, solo actualizar la configuración básica
      for (let i = 0; i < NUM_LOOPS; i++) {
        const loop = loops.value[i]
        const scale = scales[newScale]
        const baseNote = 36 + Math.floor(Math.random() * 24)
        
        loop.scale = scale
        loop.baseNote = baseNote
        loop.pattern = generatePattern(loop.length)
        loop.notes = generateNotes(scale, baseNote, loop.length)
      }
    }
  }

  // Actualizar división del delay (tap division)
  const updateDelayDivision = (division) => {
    const allowed = ['16n', '8n', '4n', '2n', '8t', '4t', '2t']
    const div = allowed.includes(division) ? division : '8n'
    delayDivision.value = div
    updateDelayTime()
    softResetDelayFeedback()
  }

  // Regenerar loop
  const regenerateLoop = (id) => {
    if (!audioInitialized.value) return
    const loop = loops.value[id]
    
    const scale = scales[currentScale.value]
    const baseNote = 36 + Math.floor(Math.random() * 24)
    
    loop.scale = scale
    loop.baseNote = baseNote
    loop.pattern = generatePattern(loop.length)
    loop.notes = generateNotes(scale, baseNote, loop.length)
  }

  // Regenerar todos los loops
  const regenerateAllLoops = () => {
    for (let i = 0; i < NUM_LOOPS; i++) {
      regenerateLoop(i)
    }
  }

  // Actualizar configuración del sintetizador de un loop
  const updateLoopSynth = (loopId, synthConfig) => {
    const loop = loops.value?.[loopId]
    if (!loop) return

    // Guardar config para referencia
    loop.synthConfig = { ...synthConfig }

    // Desconectar y disponer sintetizador anterior si existe
    if (loop.synth) {
      try { loop.synth.disconnect() } catch {}
      try { loop.synth.dispose() } catch {}
    }

    // Crear nuevo sintetizador según config
    const newSynth = useSynthesizer().createSynth(synthConfig)

    // Evitar reactividad innecesaria
    loop.synth = markRaw(newSynth)

    // Sincronizar campos del loop para reflejar la configuración actual
    if (synthConfig?.oscillator?.type) {
      loop.synthType = synthConfig.oscillator.type
    }
    if (synthConfig?.envelope) {
      loop.envelope = { ...synthConfig.envelope }
    }
    if (Object.prototype.hasOwnProperty.call(synthConfig, 'harmonicity')) {
      loop.harmonicity = synthConfig.harmonicity
    }
    if (Object.prototype.hasOwnProperty.call(synthConfig, 'modulationIndex')) {
      loop.modulationIndex = synthConfig.modulationIndex
    }

    // Reconectar a cadena de efectos
    if (BYPASS_EFFECTS_FOR_TEST) {
      if (masterGain) {
        loop.synth.connect(masterGain)
      } else {
        loop.synth.toDestination()
      }
    } else {
      if (loop.panner) loop.synth.connect(loop.panner)
      if (loop.delaySend && delay) loop.synth.connect(loop.delaySend)
      if (loop.reverbSend && reverb) loop.synth.connect(loop.reverbSend)
    }
  }



  // Inicializar loops básicos al crear el store
  for (let i = 0; i < NUM_LOOPS; i++) {
    loops.value.push(createBasicLoop(i))
  }

  return {
    audioInitialized,
    isPlaying,
    currentPulse,
    currentBeat,
    tempo,
    transpose,
    masterVol,
    masterVolume,
    loops,
    currentScale,
    scaleNamesSpanish,
    initAudio,
    togglePlay,
    toggleLoop,
    updateLoopParam,
    updateLoopSynth,
    regenerateLoop,
    regenerateAllLoops,
    updateTempo,
    updateMasterVolume,
    updateTranspose,
    updateScale,
    updateDelayDivision,
    delayDivision,
    scales,
    scaleNames,
    synthTypes
  }
})