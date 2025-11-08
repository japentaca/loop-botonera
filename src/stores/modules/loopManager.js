import { ref } from 'vue'
import { useScales, useNoteUtils } from '../../composables/useMusic'

/**
 * Gestor de loops que maneja la creación, configuración y 
 * reproducción de patrones musicales
 */
export const useLoopManager = () => {
  // Estado de los loops
  const loops = ref([])
  const NUM_LOOPS = 8

  // Configuración
  const synthTypes = ['sine', 'triangle', 'square', 'sawtooth']

  // Funciones de generación de patrones
  const generatePattern = (length, density = null) => {
    const pattern = new Array(length).fill(false)
    
    // Usar densidad proporcionada o calcular una aleatoria
    const patternDensity = density !== null ? density : (0.3 + Math.random() * 0.4)
    
    for (let i = 0; i < length; i++) {
      if (Math.random() < patternDensity) {
        pattern[i] = true
      }
    }
    
    // Asegurar al menos una nota activa
    if (!pattern.some(Boolean)) {
      pattern[0] = true
    }
    
    return pattern
  }

  const generateNotes = (scale, baseNote, length) => {
    return Array.from({ length }, () => {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * 3)
      const note = baseNote + scale[scaleIndex] + (octave * 12)
      // Asegurar que la nota esté en rango MIDI válido
      return Math.max(24, Math.min(96, note))
    })
  }

  const generateNotesInRange = (scale, baseNote, length, maxOctaves = 2) => {
    return Array.from({ length }, () => {
      if (Math.random() < 0.3) return null // 30% silencio
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * maxOctaves)
      const note = baseNote + scale[scaleIndex] + (octave * 12)
      // Asegurar que la nota esté en rango MIDI válido y musical
      const finalNote = Math.max(24, Math.min(84, note))
      
      // Verificar que la nota generada esté realmente en la escala
      const { quantizeToScale } = useNoteUtils()
      const quantizedNote = quantizeToScale(finalNote, scale, baseNote)
      
      return quantizedNote
    })
  }

  // Generar una respuesta derivada de un loop "call"
  // Aplica transformaciones simples (transposición, retrogradación, inversión) y cuantiza a la escala
  const generateResponseFromCall = (callLoop, responderLoop, scale, baseNote, options = {}) => {
    try {
      const sourceNotes = Array.isArray(callLoop?.notes) ? callLoop.notes : []
      const targetLength = responderLoop?.length ?? sourceNotes.length
      const { quantizeToScale } = useNoteUtils()

      // Elegir estrategia de transformación
      const strategies = ['transposeUp', 'transposeDown', 'retrograde', 'invert']
      const strategy = options.strategy && strategies.includes(options.strategy)
        ? options.strategy
        : strategies[Math.floor(Math.random() * strategies.length)]

      // Delta de transposición (en semitonos) con cuantización posterior a la escala
      const transposeDelta = options.transposeDelta ?? ([2, 3, 4][Math.floor(Math.random() * 3)])

      const clampMidi = (n) => Math.max(24, Math.min(84, n))

      const transformNote = (note, idx) => {
        if (typeof note !== 'number') return null
        let transformed = note
        switch (strategy) {
          case 'transposeUp':
            transformed = note + transposeDelta
            break
          case 'transposeDown':
            transformed = note - transposeDelta
            break
          case 'invert': {
            const pivot = (callLoop?.baseNote ?? baseNote)
            transformed = pivot - (note - pivot)
            break
          }
          case 'retrograde':
            // Retrogradación se aplica a la secuencia completa; aquí solo cuantizamos
            transformed = note
            break
          default:
            transformed = note
        }
        transformed = clampMidi(transformed)
        return quantizeToScale(transformed, scale, baseNote)
      }

      // Construir la secuencia transformada
      let seq = sourceNotes.slice()
      if (strategy === 'retrograde') {
        seq = seq.reverse()
      }

      const result = Array.from({ length: targetLength }, (_, i) => {
        const src = seq.length ? seq[i % seq.length] : null
        return transformNote(src, i)
      })

      return result
    } catch (error) {
      console.error('Error al generar respuesta desde call:', error)
      // Fallback: generar notas aleatorias en rango
      return generateNotesInRange(scale, baseNote, responderLoop?.length ?? 16, 2)
    }
  }

  // Crear estructura básica de loop (sin objetos de audio)
  const createBasicLoop = (id, scale, adaptiveVolume = 0.5, adaptiveDensity = null) => {
    const baseNote = 36 + Math.floor(Math.random() * 24)
    const synthType = synthTypes[Math.floor(Math.random() * synthTypes.length)]
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
      synthModel: 'PolySynth',
      synthType,
      pattern: generatePattern(length, adaptiveDensity),
      notes: generateNotes(scale, baseNote, length),
      length,
      // Objetos de audio (se asignarán después)
      synth: null,
      panner: null,
      delaySend: null,
      reverbSend: null,
      // Parámetros de efectos
      delayAmount: 0.2,
      reverbAmount: 0.3,
      volume: adaptiveVolume,
      pan: 0,
      envelope
    }
  }

  // Crear loop completo con objetos de audio
  const createLoop = (id, scale, audioEngine, adaptiveVolume = 0.5, adaptiveDensity = null) => {
    const basicLoop = createBasicLoop(id, scale, adaptiveVolume, adaptiveDensity)
    
    // Crear cadena de audio usando el motor de audio
    const synthConfig = {
      oscillator: { type: basicLoop.synthType },
      envelope: basicLoop.envelope
    }
    
    const effectsConfig = {
      delayAmount: basicLoop.delayAmount,
      reverbAmount: basicLoop.reverbAmount,
      pan: basicLoop.pan,
      synthType: basicLoop.synthModel === 'PolySynth' ? 'PolySynth' : 'Synth'
    }

    try {
      const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)
      
      // Asignar objetos de audio al loop
      basicLoop.synth = audioChain.synth
      basicLoop.panner = audioChain.panner
      basicLoop.delaySend = audioChain.delaySend
      basicLoop.reverbSend = audioChain.reverbSend
    } catch (error) {
      console.error('Error al crear cadena de audio para loop:', error)
    }

    return basicLoop
  }

  // Inicializar todos los loops
  const initializeLoops = (currentScale, audioEngine = null, getAdaptiveVolume = null, getAdaptiveDensity = null) => {
    console.log('🔄 LOOP MANAGER: Starting loop initialization');
    console.log('🔄 LOOP MANAGER: Current scale:', currentScale);
    console.log('🔄 LOOP MANAGER: Audio engine available:', !!audioEngine);
    console.log('🔄 LOOP MANAGER: Audio engine initialized:', audioEngine?.audioInitialized);
    
    const scale = useScales().getScale(currentScale)
    console.log('🔄 LOOP MANAGER: Retrieved scale:', scale);
    
    loops.value = []
    console.log('🔄 LOOP MANAGER: Creating', NUM_LOOPS, 'loops');
    
    for (let i = 0; i < NUM_LOOPS; i++) {
      const adaptiveVolume = getAdaptiveVolume ? getAdaptiveVolume(i) : 0.5
      const adaptiveDensity = getAdaptiveDensity ? getAdaptiveDensity() : null
      
      console.log(`🔄 LOOP MANAGER: Creating loop ${i}, adaptiveVolume: ${adaptiveVolume}, adaptiveDensity: ${adaptiveDensity}`);
      
      if (audioEngine && audioEngine.audioInitialized) {
        loops.value.push(createLoop(i, scale, audioEngine, adaptiveVolume, adaptiveDensity))
      } else {
        loops.value.push(createBasicLoop(i, scale, adaptiveVolume, adaptiveDensity))
      }
      
      console.log(`🔄 LOOP MANAGER: Loop ${i} created successfully`);
    }
    
    console.log('🔄 LOOP MANAGER: All loops initialized, total:', loops.value.length);
  }

  // Actualizar loops existentes con objetos de audio
  const upgradeLoopsWithAudio = (audioEngine) => {
    loops.value.forEach((loop) => {
      if (!loop.synth) {
        const synthConfig = {
          oscillator: { type: loop.synthType },
          envelope: loop.envelope
        }
        
        const effectsConfig = {
          delayAmount: loop.delayAmount,
          reverbAmount: loop.reverbAmount,
          pan: loop.pan,
          synthType: loop.synthModel === 'PolySynth' ? 'PolySynth' : 'Synth'
        }

        try {
          const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)
          
          loop.synth = audioChain.synth
          loop.panner = audioChain.panner
          loop.delaySend = audioChain.delaySend
          loop.reverbSend = audioChain.reverbSend
        } catch (error) {
          console.error('Error al actualizar loop con audio:', error)
        }
      }
    })
  }

  // Activar/desactivar loop
  const toggleLoop = (id) => {
    const loop = loops.value[id]
    if (loop) {
      loop.isActive = !loop.isActive
    }
  }

  // Actualizar parámetros de loop
  const updateLoopParam = (id, param, value) => {
    const loop = loops.value[id]
    if (!loop) return

    switch (param) {
      case 'length': {
        const newLen = Math.max(1, Math.round(Number(value)))
        loop.length = newLen
        loop.pattern = generatePattern(newLen)
        loop.notes = generateNotes(loop.scale, loop.baseNote, newLen)
        break
      }
      case 'delay':
      case 'delayAmount': {
        const amt = param === 'delay' ? Number(value) / 100 : Number(value)
        loop.delayAmount = amt
        if (loop.delaySend) loop.delaySend.gain.value = amt
        break
      }
      case 'reverb':
      case 'reverbAmount': {
        const amt = param === 'reverb' ? Number(value) / 100 : Number(value)
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
      case 'synthType': {
        loop.synthType = value
        // Nota: cambiar el tipo de oscilador requiere recrear el sintetizador
        break
      }
    }
  }

  // Cuantizar notas de un loop a una nueva escala
  const quantizeLoopNotes = (loop, newScale) => {
    const { quantizeToScale } = useNoteUtils()
    
    loop.scale = newScale
    loop.notes = loop.notes.map(note => {
      if (note === null || note === undefined) return note
      return quantizeToScale(note, newScale, loop.baseNote)
    })
  }

  // Actualizar escala de todos los loops
  const updateAllLoopsScale = (newScale) => {
    const scale = useScales().getScale(newScale)
    if (!scale) return
    
    loops.value.forEach(loop => {
      quantizeLoopNotes(loop, scale)
    })
  }

  // Regenerar patrón de un loop
  const regenerateLoopPattern = (id, density = null) => {
    const loop = loops.value[id]
    if (loop) {
      loop.pattern = generatePattern(loop.length, density)
    }
  }

  // Regenerar notas de un loop
  const regenerateLoopNotes = (id) => {
    const loop = loops.value[id]
    if (loop) {
      loop.notes = generateNotes(loop.scale, loop.baseNote, loop.length)
    }
  }

  // Regenerar loop completo (patrón y notas)
  const regenerateLoop = (id, scale, adaptiveDensity = null, adaptiveVolume = null) => {
    const loop = loops.value[id]
    if (!loop) return

    // Actualizar escala si se proporciona
    if (scale) {
      loop.scale = scale
    }

    // Regenerar patrón con densidad adaptiva
    loop.pattern = generatePattern(loop.length, adaptiveDensity)
    
    // Regenerar notas con la nueva escala
    loop.notes = generateNotes(loop.scale, loop.baseNote, loop.length)
    
    // Aplicar volumen adaptivo si se proporciona
    if (adaptiveVolume !== null) {
      loop.volume = Math.max(0, Math.min(1, adaptiveVolume))
    }
  }

  // Obtener loops activos
  const getActiveLoops = () => {
    return loops.value.filter(loop => loop.isActive)
  }

  // Reproducir nota de un loop específico
  const playLoopNote = (loop, audioEngine, step, time) => {
    if (!loop.notes || !loop.notes[step] || loop.notes[step] === null) return
    
    const midiNote = loop.notes[step]
    const synthModel = loop.synthModel || 'PolySynth'
    
    // Seleccionar duración según el modelo de síntesis
    const duration = (synthModel === 'AMSynth' || synthModel === 'FMSynth') ? '8n'
      : (synthModel === 'PluckSynth' || synthModel === 'MembraneSynth') ? '16n'
      : '16n'

    const audioChain = {
      synth: loop.synth,
      panner: loop.panner,
      delaySend: loop.delaySend,
      reverbSend: loop.reverbSend
    }

    audioEngine.playNote(audioChain, midiNote, duration, loop.volume, time)
  }

  // Aplicar distribución dispersa en el espectro estéreo
  const applySparseDistribution = () => {
    // Obtener loops activos
    const activeLoops = loops.value.filter(loop => loop.isActive)
    
    if (activeLoops.length === 0) {
      return
    }

    // Distribuir los loops activos a través del espectro estéreo
    activeLoops.forEach((loop, index) => {
      // Calcular posición en el espectro estéreo (-1 a 1)
      let panPosition
      
      if (activeLoops.length === 1) {
        // Un solo loop: centrado
        panPosition = 0
      } else if (activeLoops.length === 2) {
        // Dos loops: uno a la izquierda, otro a la derecha
        panPosition = index === 0 ? -0.7 : 0.7
      } else {
        // Múltiples loops: distribuir uniformemente
        panPosition = -1 + (2 * index) / (activeLoops.length - 1)
        // Limitar el rango para evitar extremos demasiado duros
        panPosition = Math.max(-0.8, Math.min(0.8, panPosition))
      }

      // Aplicar la panoramización
      loop.pan = panPosition
      if (loop.panner && loop.panner.pan) {
        loop.panner.pan.value = panPosition
      }
    })

    activeLoops.forEach((loop, index) => {
      const panDirection = loop.pan < -0.2 ? 'izquierda' : loop.pan > 0.2 ? 'derecha' : 'centro'
    })
  }

  // Actualizar configuración del sintetizador de un loop
  const updateLoopSynth = (loopId, synthConfig, audioEngine) => {
    const loop = loops.value[loopId]
    if (!loop) {
      console.error(`Loop ${loopId} no encontrado`)
      return
    }

    if (!audioEngine) {
      console.error('AudioEngine requerido para actualizar sintetizador')
      return
    }

    try {
      // Desconectar y limpiar el sintetizador anterior
      if (loop.synth) {
        loop.synth.disconnect()
        loop.synth.dispose()
      }
      if (loop.panner) {
        loop.panner.disconnect()
        loop.panner.dispose()
      }
      if (loop.delaySend) {
        loop.delaySend.disconnect()
        loop.delaySend.dispose()
      }
      if (loop.reverbSend) {
        loop.reverbSend.disconnect()
        loop.reverbSend.dispose()
      }

      // Actualizar la configuración del loop
      loop.synthModel = synthConfig.type || 'PolySynth'
      loop.synthType = synthConfig.oscillator?.type || 'sine'
      loop.envelope = synthConfig.envelope || {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8
      }

      // Preparar configuraciones para audioEngine.createAudioChain
      const newSynthConfig = {
        oscillator: { type: loop.synthType },
        envelope: loop.envelope
      }

      // Agregar configuraciones específicas según el tipo de sintetizador
      if (loop.synthModel === 'AMSynth') {
        newSynthConfig.harmonicity = synthConfig.harmonicity || 3
        newSynthConfig.modulation = { type: loop.synthType }
        newSynthConfig.modulationEnvelope = {
          attack: loop.envelope.attack,
          decay: loop.envelope.decay,
          sustain: 0.85,
          release: loop.envelope.release
        }
      } else if (loop.synthModel === 'FMSynth') {
        newSynthConfig.harmonicity = synthConfig.harmonicity || 3
        newSynthConfig.modulationIndex = synthConfig.modulationIndex || 10
        newSynthConfig.modulation = { type: loop.synthType }
      } else if (loop.synthModel === 'PluckSynth') {
        newSynthConfig.attackNoise = 1
        newSynthConfig.dampening = 4000
        newSynthConfig.resonance = 0.7
      } else if (loop.synthModel === 'MembraneSynth') {
        newSynthConfig.pitchDecay = 0.05
        newSynthConfig.octaves = 10
      }

      const effectsConfig = {
        delayAmount: loop.delayAmount,
        reverbAmount: loop.reverbAmount,
        pan: loop.pan,
        synthType: loop.synthModel
      }

      // Crear nueva cadena de audio usando audioEngine
      const audioChain = audioEngine.createAudioChain(newSynthConfig, effectsConfig)

      // Asignar los nuevos objetos de audio al loop
      loop.synth = audioChain.synth
      loop.panner = audioChain.panner
      loop.delaySend = audioChain.delaySend
      loop.reverbSend = audioChain.reverbSend
    } catch (error) {
      console.error(`Error al actualizar sintetizador del loop ${loopId}:`, error)
    }
  }

  return {
    // Estado
    loops,
    NUM_LOOPS,
    synthTypes,
    
    // Funciones de creación
    createBasicLoop,
    createLoop,
    initializeLoops,
    upgradeLoopsWithAudio,
    
    // Funciones de control
    toggleLoop,
    updateLoopParam,
    updateLoopSynth,
    applySparseDistribution,
    
    // Funciones de generación
    generatePattern,
    generateNotes,
    generateNotesInRange,
    generateResponseFromCall,
    regenerateLoopPattern,
    regenerateLoopNotes,
    regenerateLoop,
    
    // Funciones de escala
    quantizeLoopNotes,
    updateAllLoopsScale,
    
    // Utilidades
    getActiveLoops,
    playLoopNote
  }
}
