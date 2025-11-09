import { ref, shallowRef, triggerRef } from 'vue'
import { useScales, useNoteUtils } from '../../composables/useMusic'

// Helper function for efficient MIDI note clamping
const clampToMidiRange = (note) => {
  const MIN_MIDI = 24
  const MAX_MIDI = 96
  const OCTAVE = 12

  if (note < MIN_MIDI) {
    const octavesBelow = Math.ceil((MIN_MIDI - note) / OCTAVE)
    return note + (octavesBelow * OCTAVE)
  }
  if (note > MAX_MIDI) {
    const octavesAbove = Math.ceil((note - MAX_MIDI) / OCTAVE)
    return note - (octavesAbove * OCTAVE)
  }
  return note
}

/**
 * Gestor de loops que maneja la creación, configuración y 
 * reproducción de patrones musicales
 * Ahora integrado con la matriz de notas centralizada
 */
export const useLoopManager = (notesMatrix = null) => {
  // Estado de los loops - using shallowRef for performance
  // We don't need deep reactivity since currentStep is now computed in components
  const loops = shallowRef([])
  const NUM_LOOPS = 8

  // Global root note for harmonic consistency - all loops use the same root
  let globalRootNote = 60 // Default to C (middle C)

  // Configuración
  const synthTypes = ['sine', 'triangle', 'square', 'sawtooth']

  const isDebugEnabled = () => typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
  const debugLog = (label, payload = {}) => {
    if (isDebugEnabled()) {
      // console.log(`[LoopManager] ${label}`, payload)
    }
  }

  const getLoopNoteDensity = (loopId) => {
    return notesMatrix.getLoopNoteDensity(loopId)
  }

  const generateNotes = (scale, baseNote, length) => {
    // scale should be intervals array here

    const notes = Array.from({ length }, (_, idx) => {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * 3)
      const note = baseNote + scale[scaleIndex] + (octave * 12)

      // Asegurar que la nota esté en rango MIDI válido SIN salirse de la escala
      const finalNote = clampToMidiRange(note)

      if (idx < 3) { // Log first 3 notes
      }

      return finalNote
    })
    return notes
  }

  const generateNotesInRange = (scale, baseNote, length, maxOctaves = 2) => {
    // scale should be intervals array here

    return Array.from({ length }, (_, idx) => {
      if (Math.random() < 0.3) return null // 30% silencio

      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * maxOctaves)
      const note = baseNote + scale[scaleIndex] + (octave * 12)

      // Asegurar rango MIDI válido manteniendo la nota en escala
      // Note: using 84 as upper limit instead of 96 for this function
      const finalNote = Math.min(84, clampToMidiRange(note))

      if (idx < 3 && finalNote !== null) { // Log first 3 non-null notes
      }

      return finalNote
    })
  }

  // Generar una respuesta derivada de un loop "call"
  // Aplica transformaciones simples (transposición, retrogradación, inversión) y cuantiza a la escala
  const generateResponseFromCall = (callLoop, responderLoop, scale, baseNote, options = {}) => {
    // scale should be intervals array here

    // Obtener notas desde la matriz centralizada
    const sourceNotes = notesMatrix ? notesMatrix.getLoopNotes(callLoop.id) : []

    const targetLength = responderLoop?.length ?? sourceNotes.length
    const { quantizeToScale } = useNoteUtils()

    // Elegir estrategia de transformación
    const strategies = ['transposeUp', 'transposeDown', 'retrograde', 'invert']
    const strategy = options.strategy && strategies.includes(options.strategy)
      ? options.strategy
      : strategies[Math.floor(Math.random() * strategies.length)]

    // Delta de transposición (en semitonos) con cuantización posterior a la escala
    const transposeDelta = options.transposeDelta ?? ([2, 3, 4][Math.floor(Math.random() * 3)])

    const clampMidi = (n) => n

    const transformNote = (note, idx) => {
      let transformed = note
      switch (strategy) {
        case 'transposeUp':
          transformed = note + transposeDelta
          break
        case 'transposeDown':
          transformed = note - transposeDelta
          break
        case 'invert': {
          const pivot = callLoop.baseNote
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
      const quantized = quantizeToScale(transformed, scale, baseNote)
      return quantized
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
  }

  // Generar nota base que esté en la escala actual  // Generar nota base que esté en la escala actual
  const generateScaleBaseNote = (scale) => {
    // All loops share the same global root note for harmonic consistency
    // Optionally add octave variation
    const octaveVariation = Math.floor(Math.random() * 3) - 1 // -1, 0, or +1 octave
    const baseNote = globalRootNote + (octaveVariation * 12)

    return baseNote
  }

  // Crear estructura básica de loop (sin objetos de audio)
  const createBasicLoop = (id, scaleName, adaptiveVolume = 0.5, adaptiveDensity = null) => {
    // scaleName parameter is the scale NAME (e.g., 'major', 'minorPentatonic')
    // Get intervals for note generation
    const scale = useScales().getScale(scaleName)

    // Generar nota base que esté garantizada en la escala actual
    const baseNote = generateScaleBaseNote(scale)
    const synthType = synthTypes[Math.floor(Math.random() * synthTypes.length)]
    const length = 16

    // Inicializar loop en la matriz centralizada si está disponible
    if (notesMatrix) {
      notesMatrix.initializeLoop(id, {
        length,
        scale: scaleName, // Store scale NAME
        baseNote,
        density: adaptiveDensity || 0.4,
        octaveRange: 2
      })

      // Generar notas en la matriz centralizada using scale NAME
      notesMatrix.generateLoopNotes(id, {
        scale: scaleName, // This will be resolved to intervals by the function
        baseNote,
        length,
        density: adaptiveDensity || 0.4,
        octaveRange: 2
      })
    }

    return {
      id,
      isActive: false,
      // scale removed - uses global scale from audioStore
      baseNote,
      synthModel: 'PolySynth',
      synthType,
      // notes: removido - ahora se usa la matriz centralizada
      length,
      currentStep: 0, // Track current beat position
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
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.8
      }
    }
  }

  // Crear loop completo con objetos de audio
  const createLoop = (id, scaleName, audioEngine, adaptiveVolume = 0.5, adaptiveDensity = null) => {
    const basicLoop = createBasicLoop(id, scaleName, adaptiveVolume, adaptiveDensity)

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

    const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)

    // Asignar objetos de audio al loop
    basicLoop.synth = audioChain.synth
    basicLoop.panner = audioChain.panner
    basicLoop.delaySend = audioChain.delaySend
    basicLoop.reverbSend = audioChain.reverbSend

    return basicLoop
  }

  // Inicializar todos los loops
  const initializeLoops = (scaleName, audioEngine = null, getAdaptiveVolume = null, getAdaptiveDensity = null) => {
    // scaleName is the scale NAME (e.g., 'major', 'minorPentatonic'), not intervals

    // Inicializar la matriz de notas centralizada
    if (notesMatrix) {
      notesMatrix.initializeMatrix()
      //console.log('🔄 LOOP MANAGER: Central notes matrix initialized');
    }

    loops.value = []

    for (let i = 0; i < NUM_LOOPS; i++) {
      const adaptiveVolume = getAdaptiveVolume ? getAdaptiveVolume(i) : 0.5
      const adaptiveDensity = getAdaptiveDensity ? getAdaptiveDensity() : null

      //console.log(`🔄 LOOP MANAGER: Creating loop ${i}, adaptiveVolume: ${adaptiveVolume}, adaptiveDensity: ${adaptiveDensity}`);

      if (audioEngine && audioEngine.audioInitialized) {
        loops.value.push(createLoop(i, scaleName, audioEngine, adaptiveVolume, adaptiveDensity))
      } else {
        loops.value.push(createBasicLoop(i, scaleName, adaptiveVolume, adaptiveDensity))
      }

      // console.log(`🔄 LOOP MANAGER: Loop ${i} created successfully`);
    }

    // Trigger reactivity for shallowRef after initial setup
    triggerRef(loops)

    //console.log('🔄 LOOP MANAGER: All loops initialized, total:', loops.value.length);
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

        const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)

        loop.synth = audioChain.synth
        loop.panner = audioChain.panner
        loop.delaySend = audioChain.delaySend
        loop.reverbSend = audioChain.reverbSend
      }
    })
  }  // Activar/desactivar loop
  const toggleLoop = (id) => {
    const loop = loops.value[id]
    if (loop) {
      loop.isActive = !loop.isActive

      // Sincronizar con la matriz centralizada
      if (notesMatrix) {
        notesMatrix.setLoopActive(id, loop.isActive)
      }

      if (isDebugEnabled()) {
        const activeIds = loops.value.filter(l => l.isActive).map(l => l.id)
        const densities = activeIds.map(loopId => ({
          id: loopId,
          density: getLoopNoteDensity(loopId)
        }))
        debugLog('toggle loop', {
          id,
          isActive: loop.isActive,
          activeIds,
          densities
        })
      }
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

        if (notesMatrix) {
          const density = getLoopNoteDensity(id) || 0.4
          notesMatrix.updateLoopMetadata(id, { length: newLen })
          notesMatrix.resizeLoop(id, newLen, { density })
          debugLog('loop length resized', { id, newLen, density })
        }
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
  const quantizeLoopNotes = (loop, newScale, currentScaleName) => {
    // newScale is the actual scale array (intervals)
    // currentScaleName is the scale name (e.g., 'major', 'minor')

    // Verificar y ajustar la nota base si es necesario
    const baseNoteInterval = loop.baseNote % 12
    const currentBaseNoteInScale = newScale.includes(baseNoteInterval)

    if (!currentBaseNoteInScale) {
      loop.baseNote = generateScaleBaseNote(newScale)
      //console.log(`🎼 Updated baseNote to ${loop.baseNote} for scale compatibility`)
    }

    // Usar la función de cuantización de la matriz centralizada
    // Esta función maneja internamente la actualización de metadatos
    if (notesMatrix) {
      notesMatrix.quantizeLoop(loop.id, currentScaleName)

      // También actualizar el metadato de escala y baseNote explícitamente
      notesMatrix.updateLoopMetadata(loop.id, {
        scale: currentScaleName,
        baseNote: loop.baseNote
      })
    }
  }

  // Actualizar escala de todos los loops
  const updateAllLoopsScale = (newScale, currentScaleName) => {
    // newScale is the actual scale array (intervals)
    // currentScaleName is the scale name (e.g., 'major', 'minor')

    if (!newScale) return

    // Actualizar cada loop individualmente para asegurar compatibilidad de base note
    loops.value.forEach(loop => {
      // Verificar y ajustar la nota base si es necesario
      const baseNoteInterval = loop.baseNote % 12
      const currentBaseNoteInScale = newScale.includes(baseNoteInterval)

      if (!currentBaseNoteInScale) {
        loop.baseNote = generateScaleBaseNote(newScale)
        //console.log(`🎼 Updated loop ${loop.id} baseNote to ${loop.baseNote} for scale compatibility`)
      }
    })

    // Usar la función centralizada para cuantizar todos los loops activos
    if (notesMatrix) {
      notesMatrix.quantizeAllActiveLoops(currentScaleName)

      // Actualizar metadatos para todos los loops
      loops.value.forEach(loop => {
        notesMatrix.updateLoopMetadata(loop.id, {
          scale: currentScaleName,
          baseNote: loop.baseNote
        })
      })
    }
  }

  // Regenerar notas de un loop
  const regenerateLoopNotes = (id, currentScale, currentScaleName) => {
    // currentScale is the actual scale array (intervals)
    // currentScaleName is the scale name (e.g., 'major', 'minor')

    const loop = loops.value[id]
    if (loop && notesMatrix) {
      // Asegurar que la nota base esté en la escala actual
      // Verificar si la nota base actual está en la escala
      // La nota base debe estar en los intervalos de la escala (mod 12)
      const baseNoteInterval = loop.baseNote % 12
      const currentBaseNoteInScale = currentScale.includes(baseNoteInterval)

      if (!currentBaseNoteInScale) {
        loop.baseNote = generateScaleBaseNote(currentScale)

        // Actualizar metadatos en la matriz
        notesMatrix.updateLoopMetadata(id, { baseNote: loop.baseNote })
      }

      // Regenerar notas en la matriz centralizada using scale NAME
      notesMatrix.generateLoopNotes(id, {
        scale: currentScaleName,
        baseNote: loop.baseNote,
        length: loop.length,
        density: 0.4,
        octaveRange: 2
      })
    }
  }

  // Regenerar loop completo (notas y ajustes relacionados)
  const regenerateLoop = (id, scale, currentScaleName, adaptiveDensity = null, adaptiveVolume = null) => {
    // scale is the actual scale array (intervals)
    // currentScaleName is the scale name (e.g., 'major', 'minor')

    const loop = loops.value[id]
    if (!loop) return

    // Si hay cambio de escala, regenerar la nota base para que esté en la nueva escala
    if (scale) {
      const newBaseNote = generateScaleBaseNote(scale)
      loop.baseNote = newBaseNote
    }

    // Regenerar notas en la matriz centralizada
    if (notesMatrix) {
      // Actualizar metadatos si hay cambios de escala - use scale NAME
      if (scale && currentScaleName) {
        notesMatrix.updateLoopMetadata(id, {
          scale: currentScaleName, // Store NAME not intervals
          baseNote: loop.baseNote
        })
      }

      // Regenerar notas en la matriz centralizada using scale NAME
      const targetDensity = adaptiveDensity ?? getLoopNoteDensity(id) ?? 0.4

      notesMatrix.generateLoopNotes(id, {
        scale: currentScaleName, // Pass scale NAME, not intervals
        baseNote: loop.baseNote,
        length: loop.length,
        density: targetDensity,
        octaveRange: 2
      })
      debugLog('regenerate loop', {
        id,
        scaleChanged: Boolean(scale),
        newLength: loop.length,
        density: targetDensity
      })
    }

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
    // No need to update currentStep - it's now computed in components based on currentPulse

    const midiNote = notesMatrix.getNote(loop.id, step)
    if (midiNote === null || midiNote === undefined) return
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

  // Utilidades de acceso a la matriz centralizada
  const getLoopNotesFromMatrix = (loopId) => {
    if (!notesMatrix) return []
    return notesMatrix.getLoopNotes(loopId)
  }

  const setLoopNoteInMatrix = (loopId, stepIndex, midiNote) => {
    if (!notesMatrix) return false
    return notesMatrix.setLoopNote(loopId, stepIndex, midiNote)
  }

  const getMatrixStats = () => {
    if (!notesMatrix) return null
    return notesMatrix.getMatrixStats()
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
    generateNotes,
    generateNotesInRange,
    generateScaleBaseNote,
    generateResponseFromCall,
    regenerateLoopNotes,
    regenerateLoop,

    // Funciones de escala
    quantizeLoopNotes,
    updateAllLoopsScale,

    // Utilidades
    getActiveLoops,
    playLoopNote,

    // Acceso a matriz centralizada
    getLoopNotesFromMatrix,
    setLoopNoteInMatrix,
    getLoopNoteDensity,
    getMatrixStats
  }
}
