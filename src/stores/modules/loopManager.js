import { ref, shallowRef, triggerRef } from 'vue'
import * as Tone from 'tone'
import { useScales, useNoteUtils } from '../../composables/useMusic.js'
import { generatePossibleNotes } from '../../utils/noteUtils.js'
import { useMelodicGenerator } from '../../composables/useMelodicGenerator.js'
import { clampToMidiRange } from '../../composables/musicUtils.js'


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

  const melodicGenerator = notesMatrix ? useMelodicGenerator(notesMatrix) : null

  // Global root note for harmonic consistency - all loops use the same root
  let globalRootNote = 60 // Default to C (middle C)

  // Configuración
  const synthTypes = ['sine', 'triangle', 'square', 'sawtooth']

  const isDebugEnabled = () => typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
  const _serialize = (v) => {
    try {
      return JSON.stringify(v)
    } catch (e) {
      if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? String(x) : x)).join(', ')
      return String(v)
    }
  }
  const debugLog = (label, payload = {}) => {
    if (isDebugEnabled()) {
      if (payload && typeof payload === 'object') {
        console.log(`[LoopManager] ${label}`, _serialize(payload))
      } else {
        console.log(`[LoopManager] ${label}`, payload)
      }
    }
  }

  const getLoopNoteDensity = (loopId) => {
    return notesMatrix.getLoopNoteDensity(loopId)
  }

  // Removed legacy local generators to avoid duplication; use melodic generator delegation instead

  const generateLoopMelodyFor = (loopId, options = {}) => {
    if (!notesMatrix) return []
    notesMatrix.generateLoopNotes(loopId, options)
    return notesMatrix.getLoopNotes(loopId)
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

    // Build allowed notes for responder within its note range
    const meta = notesMatrix && notesMatrix.loopMetadata ? notesMatrix.loopMetadata[responderLoop.id] : null
    const minRange = meta && typeof meta.noteRangeMin === 'number' ? meta.noteRangeMin : 24
    const maxRange = meta && typeof meta.noteRangeMax === 'number' ? meta.noteRangeMax : 96
    // Use centralized `generatePossibleNotes` to avoid duplicate logic and sorts
    const allowedNotes = generatePossibleNotes(scale, baseNote, { min: minRange, max: maxRange })

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
      transformed = clampToMidiRange(transformed)
      const quantized = quantizeToScale(transformed, scale, baseNote)
      if (typeof quantized !== 'number' || allowedNotes.length === 0) return quantized
      // Snap to nearest allowed note inside responder's range
      let nearest = allowedNotes[0]
      let bestDist = Math.abs(quantized - nearest)
      for (let i = 1; i < allowedNotes.length; i++) {
        const d = Math.abs(quantized - allowedNotes[i])
        if (d < bestDist) {
          bestDist = d
          nearest = allowedNotes[i]
        }
      }
      debugLog('response-map', {
        responderId: responderLoop.id,
        src: note,
        transformed,
        quantized,
        nearest,
        minRange,
        maxRange
      })
      return nearest
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
    // Ensure we have a valid scale name
    if (!scaleName || scaleName === 'null') {
      console.warn(`Invalid scale name provided: "${scaleName}", using 'major' as default`)
      scaleName = 'major'
    }

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

      // Generar notas en la matriz centralizada sin pasar densidad explícita
      notesMatrix.generateLoopNotes(id, {
        scale: scaleName, // Resuelto internamente por el generador
        baseNote,
        length,
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
      lastResetPulse: 0, // Track when the loop was last reset/regenerated
      // Objetos de audio (se asignarán después)
      synth: null,
      panner: null,
      delaySend: null,
      reverbSend: null,
      // LFO effects objects (will be created with synth)
      tremoloLFO: null,
      vibratoLFO: null,
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
      },
      // LFO configurations (tremolo and vibrato)
      tremolo: {
        speed: '8n',     // Tone.js time unit (4n, 8n, 16n, 1m, etc.)
        depth: 0.3       // 0-1
      },
      vibrato: {
        speed: '4n',     // Tone.js time unit
        depth: 10        // cents
      },
      glideTime: 0.02,  // seconds
      // Melodic generation fields
      noteRangeMin: 24,        // MIDI note min (default: full range)
      noteRangeMax: 96,        // MIDI note max (default: full range)
      patternProbabilities: {  // Per-loop pattern weights
        euclidean: 0.3,
        scale: 0.3,
        random: 0.4,
        // Will add more in Phase 2
      },
      generationMode: 'auto',  // 'auto' | 'locked'
      lastPattern: null        // Track what was generated for reference
    }
  }

  // Crear loop completo con objetos de audio
  const createLoop = (id, scaleName, audioEngine, adaptiveVolume = 0.5, adaptiveDensity = null) => {
    const basicLoop = createBasicLoop(id, scaleName, adaptiveVolume, adaptiveDensity)

    // Crear cadena de audio usando el motor de audio
    const synthConfig = {
      oscillator: { type: basicLoop.synthType },
      envelope: basicLoop.envelope,
      portamento: basicLoop.glideTime
    }

    const effectsConfig = {
      delayAmount: basicLoop.delayAmount,
      reverbAmount: basicLoop.reverbAmount,
      pan: basicLoop.pan,
      volume: basicLoop.volume,
      synthType: basicLoop.synthModel === 'PolySynth' ? 'PolySynth' : 'Synth',
      tremolo: basicLoop.tremolo,
      vibrato: basicLoop.vibrato
    }

    const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)

    // Asignar objetos de audio al loop
    basicLoop.synth = audioChain.synth
    basicLoop.panner = audioChain.panner
    basicLoop.delaySend = audioChain.delaySend
    basicLoop.reverbSend = audioChain.reverbSend
    basicLoop.tremoloLFO = audioChain.tremoloLFO
    basicLoop.vibratoLFO = audioChain.vibratoLFO

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

      if (audioEngine && audioEngine.audioInitialized.value) {
        const newLoop = createLoop(i, scaleName, audioEngine, adaptiveVolume, adaptiveDensity)
        loops.value.push(newLoop)
      } else {
        const newLoop = createBasicLoop(i, scaleName, adaptiveVolume, adaptiveDensity)
        loops.value.push(newLoop)
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
          envelope: loop.envelope,
          portamento: loop.glideTime
        }

        const effectsConfig = {
          delayAmount: loop.delayAmount,
          reverbAmount: loop.reverbAmount,
          pan: loop.pan,
          volume: loop.volume,
          synthType: loop.synthModel === 'PolySynth' ? 'PolySynth' : 'Synth',
          tremolo: loop.tremolo,
          vibrato: loop.vibrato
        }

        const audioChain = audioEngine.createAudioChain(synthConfig, effectsConfig)

        loop.synth = audioChain.synth
        loop.panner = audioChain.panner
        loop.delaySend = audioChain.delaySend
        loop.reverbSend = audioChain.reverbSend
        loop.tremoloLFO = audioChain.tremoloLFO
        loop.vibratoLFO = audioChain.vibratoLFO
      }
    })
  }
  // Activar/desactivar loop
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

        // Trigger reactivity update after length change
        triggerRef(loops)
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
        // Update synth volume immediately for real-time volume control
        if (loop.synth) {
          loop.synth.volume.value = Tone.gainToDb(loop.volume)
        }
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
      case 'tremoloSpeed': {
        const num = typeof value === 'number' ? value : parseFloat(value)
        loop.tremolo.speed = isNaN(num) ? value : num
        if (loop.tremoloLFO) {
          loop.tremoloLFO.frequency.value = loop.tremolo.speed
        }
        break
      }
      case 'tremoloDepth': {
        const num = typeof value === 'number' ? value : parseFloat(value)
        loop.tremolo.depth = Math.max(0, Math.min(1, isNaN(num) ? value : num))
        if (loop.tremoloLFO) {
          loop.tremoloLFO.min = 1 - loop.tremolo.depth
          loop.tremoloLFO.max = 1
        }
        break
      }
      case 'vibratoSpeed': {
        const num = typeof value === 'number' ? value : parseFloat(value)
        loop.vibrato.speed = isNaN(num) ? value : num
        if (loop.vibratoLFO) {
          loop.vibratoLFO.frequency.value = loop.vibrato.speed
        }
        break
      }
      case 'vibratoDepth': {
        const num = typeof value === 'number' ? value : parseFloat(value)
        loop.vibrato.depth = Math.max(0, isNaN(num) ? value : num)
        if (loop.vibratoLFO) {
          loop.vibratoLFO.min = -loop.vibrato.depth
          loop.vibratoLFO.max = loop.vibrato.depth
        }
        break
      }
      case 'glideTime': {
        const num = typeof value === 'number' ? value : parseFloat(value)
        loop.glideTime = Math.max(0, isNaN(num) ? value : num)
        // Note: actual glide change requires synth recreation for proper portamento
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

      // Regenerar notas en la matriz centralizada usando la densidad efectiva del store
      notesMatrix.generateLoopNotes(id, {
        scale: currentScaleName,
        baseNote: loop.baseNote,
        length: loop.length,
        octaveRange: 2
      })
    }
  }

  // Regenerar loop completo (notas y ajustes relacionados)
  const regenerateLoop = (id, scale, currentScaleName, adaptiveVolume = null, currentPulse = null) => {
    // scale is the actual scale array (intervals)
    // currentScaleName is the scale name (e.g., 'major', 'minor')
    // currentPulse is the current global pulse for step reset

    const loop = loops.value[id]
    if (!loop) return

    // Reset the step counter when regenerating
    if (currentPulse !== null) {
      loop.lastResetPulse = currentPulse
      loop.currentStep = 0
    }

    // Actualizar baseNote SOLO si la escala cambió o si no pertenece a la escala actual
    if (scale && currentScaleName) {
      const meta = notesMatrix && notesMatrix.loopMetadata ? notesMatrix.loopMetadata[id] : null
      const prevScaleName = meta && meta.scale ? meta.scale : null
      const baseInterval = loop.baseNote % 12
      const baseInScale = Array.isArray(scale) ? scale.includes(baseInterval) : true
      const shouldUpdateBase = (prevScaleName !== currentScaleName) || !baseInScale
      if (shouldUpdateBase) {
        const newBaseNote = generateScaleBaseNote(scale)
        loop.baseNote = newBaseNote
      }
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

      // Regenerar notas leyendo únicamente de la metadata del store
      if (notesMatrix.updateLoopMetadata) {
        const randomOffset = Math.floor(Math.random() * (loop.length || 16))
        notesMatrix.updateLoopMetadata(id, { startOffset: randomOffset })
      }
      notesMatrix.generateLoopNotes(id, {
      })
      debugLog('regenerate loop', {
        id,
        scaleChanged: Boolean(scale),
        newLength: loop.length,
        density: notesMatrix.getEffectiveDensity ? notesMatrix.getEffectiveDensity(id) : undefined,
        resetPulse: currentPulse,
        lastResetPulse: loop.lastResetPulse
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

    if (!loop.synth) {
      console.error(`❌ Loop ${loop.id} has no synth! Cannot play note ${midiNote}`);
      return
    }

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

    try {
      audioEngine.playNote(audioChain, midiNote, duration, 1, time)
    } catch (error) {
      console.error(`❌ Error playing note for loop ${loop.id}:`, error);
    }
  }  // Aplicar distribución dispersa en el espectro estéreo
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
    // Clean up LFO effects
    if (loop.tremoloLFO) {
      loop.tremoloLFO.stop()
      loop.tremoloLFO.dispose()
    }
    if (loop.vibratoLFO) {
      loop.vibratoLFO.stop()
      loop.vibratoLFO.dispose()
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

    // Store LFO configurations on the loop
    loop.tremolo = synthConfig.tremolo || loop.tremolo || { speed: '8n', depth: 0.3 }
    loop.vibrato = synthConfig.vibrato || loop.vibrato || { speed: '4n', depth: 10 }
    loop.glideTime = synthConfig.glideTime || loop.glideTime || 0.02

    // Preparar configuraciones para audioEngine.createAudioChain
    const newSynthConfig = {
      oscillator: { type: loop.synthType },
      envelope: loop.envelope,
      portamento: loop.glideTime
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
      volume: loop.volume,
      synthType: loop.synthModel,
      tremolo: loop.tremolo,
      vibrato: loop.vibrato
    }

    // Crear nueva cadena de audio usando audioEngine
    const audioChain = audioEngine.createAudioChain(newSynthConfig, effectsConfig)

    // Asignar los nuevos objetos de audio al loop
    loop.synth = audioChain.synth
    loop.panner = audioChain.panner
    loop.delaySend = audioChain.delaySend
    loop.reverbSend = audioChain.reverbSend
    loop.tremoloLFO = audioChain.tremoloLFO
    loop.vibratoLFO = audioChain.vibratoLFO
  }

  // Force reactivity update for shallowRef loops
  const triggerLoopsUpdate = () => {
    triggerRef(loops)
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
    generateLoopMelodyFor,
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
    triggerLoopsUpdate,

    // Acceso a matriz centralizada
    getLoopNotesFromMatrix,
    setLoopNoteInMatrix,
    getLoopNoteDensity,
    getMatrixStats
  }
}