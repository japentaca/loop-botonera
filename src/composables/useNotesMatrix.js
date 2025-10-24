import { ref, computed, reactive, watch, readonly } from 'vue'
import { useScales, useNoteUtils } from './useMusic'

export function useNotesMatrix() {
  // Configuración de la matriz
  const MAX_LOOPS = 16
  const MAX_STEPS = 32
  
  // Matriz principal de notas [loopId][stepIndex] = midiNote | null
  const notesMatrix = ref(Array(MAX_LOOPS).fill(null).map(() => Array(MAX_STEPS).fill(null)))
  
  // Metadatos por loop
  const loopMetadata = reactive({})
  
  // Estado global de la matriz
  const matrixState = reactive({
    currentScale: 'major',
    globalBaseNote: 60,
    activeLoops: new Set(),
    stepCount: 16, // Pasos activos por defecto
    syncMode: 'all' // 'all', 'selected', 'none'
  })

  const { getScale, generateScaleNotes } = useScales()
  const { quantizeToScale } = useNoteUtils()

  // Computed para obtener la escala actual
  const currentScaleNotes = computed(() => {
    return getScale(matrixState.currentScale)
  })

  // Inicializar metadatos de un loop
  const initializeLoop = (loopId, config = {}) => {
    if (loopId >= MAX_LOOPS) return false
    
    loopMetadata[loopId] = {
      isActive: false,
      length: config.length || 16,
      scale: config.scale || matrixState.currentScale,
      baseNote: config.baseNote || matrixState.globalBaseNote,
      density: config.density || 0.4,
      octaveRange: config.octaveRange || 2,
      lastModified: Date.now(),
      ...config
    }
    
    return true
  }

  // Activar/desactivar loop
  const setLoopActive = (loopId, active) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId)
    
    loopMetadata[loopId].isActive = active
    if (active) {
      matrixState.activeLoops.add(loopId)
    } else {
      matrixState.activeLoops.delete(loopId)
    }
  }

  // Obtener notas de un loop específico
  const getLoopNotes = (loopId) => {
    if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) return []
    const length = loopMetadata[loopId].length
    return notesMatrix.value[loopId].slice(0, length)
  }

  // Establecer notas de un loop
  const setLoopNotes = (loopId, notes) => {
    if (loopId >= MAX_LOOPS || !Array.isArray(notes)) return false
    
    if (!loopMetadata[loopId]) initializeLoop(loopId)
    
    // Limpiar el array del loop
    notesMatrix.value[loopId].fill(null)
    
    // Establecer las nuevas notas
    notes.forEach((note, index) => {
      if (index < MAX_STEPS) {
        notesMatrix.value[loopId][index] = note
      }
    })
    
    loopMetadata[loopId].lastModified = Date.now()
    return true
  }

  // Establecer una nota específica
  const setNote = (loopId, stepIndex, note) => {
    if (loopId >= MAX_LOOPS || stepIndex >= MAX_STEPS) return false
    
    notesMatrix.value[loopId][stepIndex] = note
    if (loopMetadata[loopId]) {
      loopMetadata[loopId].lastModified = Date.now()
    }
    return true
  }

  // Obtener una nota específica
  const getNote = (loopId, stepIndex) => {
    if (loopId >= MAX_LOOPS || stepIndex >= MAX_STEPS) return null
    return notesMatrix.value[loopId][stepIndex]
  }

  // Generar notas aleatorias para un loop
  const generateLoopNotes = (loopId, config = {}) => {
    if (!loopMetadata[loopId]) initializeLoop(loopId, config)
    
    const meta = loopMetadata[loopId]
    const scale = getScale(config.scale || meta.scale)
    const baseNote = config.baseNote || meta.baseNote
    const length = config.length || meta.length
    const density = config.density || meta.density
    const octaveRange = config.octaveRange || meta.octaveRange
    
    const newNotes = Array(length).fill(null).map(() => {
      if (Math.random() > density) return null // Silencio según densidad
      
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * octaveRange)
      const note = baseNote + scale[scaleIndex] + (octave * 12)
      
      // Asegurar rango MIDI válido
      return Math.max(24, Math.min(96, note))
    })
    
    setLoopNotes(loopId, newNotes)
    return newNotes
  }

  // Cuantizar un loop a una nueva escala
  const quantizeLoop = (loopId, newScale = null) => {
    if (!loopMetadata[loopId]) return false
    
    const targetScale = newScale || matrixState.currentScale
    const scale = getScale(targetScale)
    const baseNote = loopMetadata[loopId].baseNote
    const length = loopMetadata[loopId].length
    
    for (let i = 0; i < length; i++) {
      const currentNote = notesMatrix.value[loopId][i]
      if (currentNote !== null) {
        notesMatrix.value[loopId][i] = quantizeToScale(currentNote, scale, baseNote)
      }
    }
    
    loopMetadata[loopId].scale = targetScale
    loopMetadata[loopId].lastModified = Date.now()
    return true
  }

  // Cuantizar todos los loops activos
  const quantizeAllActiveLoops = (newScale) => {
    matrixState.currentScale = newScale
    
    matrixState.activeLoops.forEach(loopId => {
      quantizeLoop(loopId, newScale)
    })
  }

  // Operaciones de matriz eficientes para evolución

  // Transponer un loop
  const transposeLoop = (loopId, semitones) => {
    if (!loopMetadata[loopId]) return false
    
    const length = loopMetadata[loopId].length
    for (let i = 0; i < length; i++) {
      const note = notesMatrix.value[loopId][i]
      if (note !== null) {
        const newNote = note + semitones
        notesMatrix.value[loopId][i] = Math.max(24, Math.min(96, newNote))
      }
    }
    
    loopMetadata[loopId].lastModified = Date.now()
    return true
  }

  // Rotar notas de un loop
  const rotateLoop = (loopId, steps) => {
    if (!loopMetadata[loopId]) return false
    
    const length = loopMetadata[loopId].length
    const notes = getLoopNotes(loopId)
    
    if (notes.length === 0) return false
    
    const rotatedNotes = [...notes]
    const actualSteps = ((steps % length) + length) % length
    
    for (let i = 0; i < length; i++) {
      const newIndex = (i + actualSteps) % length
      rotatedNotes[newIndex] = notes[i]
    }
    
    setLoopNotes(loopId, rotatedNotes)
    return true
  }

  // Invertir notas de un loop
  const invertLoop = (loopId) => {
    if (!loopMetadata[loopId]) return false
    
    const notes = getLoopNotes(loopId)
    const reversedNotes = [...notes].reverse()
    setLoopNotes(loopId, reversedNotes)
    return true
  }

  // Mutar notas aleatoriamente
  const mutateLoop = (loopId, intensity = 0.3) => {
    if (!loopMetadata[loopId]) return false
    
    const meta = loopMetadata[loopId]
    const scale = getScale(meta.scale)
    const length = meta.length
    const changeCount = Math.floor(length * intensity)
    
    for (let i = 0; i < changeCount; i++) {
      const randomIndex = Math.floor(Math.random() * length)
      const currentNote = notesMatrix.value[loopId][randomIndex]
      
      if (currentNote !== null) {
        // Cambiar a una nota cercana en la escala
        const scaleIndex = Math.floor(Math.random() * scale.length)
        const octave = Math.floor(Math.random() * meta.octaveRange)
        const newNote = meta.baseNote + scale[scaleIndex] + (octave * 12)
        notesMatrix.value[loopId][randomIndex] = Math.max(24, Math.min(96, newNote))
      }
    }
    
    meta.lastModified = Date.now()
    return true
  }

  // Copiar notas entre loops
  const copyLoop = (sourceLoopId, targetLoopId) => {
    if (sourceLoopId >= MAX_LOOPS || targetLoopId >= MAX_LOOPS) return false
    if (!loopMetadata[sourceLoopId]) return false
    
    const sourceNotes = getLoopNotes(sourceLoopId)
    setLoopNotes(targetLoopId, sourceNotes)
    
    // Copiar metadatos también
    if (!loopMetadata[targetLoopId]) initializeLoop(targetLoopId)
    Object.assign(loopMetadata[targetLoopId], {
      ...loopMetadata[sourceLoopId],
      lastModified: Date.now()
    })
    
    return true
  }

  // Obtener estadísticas de la matriz
  const getMatrixStats = () => {
    const stats = {
      activeLoops: matrixState.activeLoops.size,
      totalNotes: 0,
      notesPerLoop: {},
      averageDensity: 0
    }
    
    matrixState.activeLoops.forEach(loopId => {
      const notes = getLoopNotes(loopId)
      const noteCount = notes.filter(note => note !== null).length
      stats.totalNotes += noteCount
      stats.notesPerLoop[loopId] = noteCount
    })
    
    if (matrixState.activeLoops.size > 0) {
      stats.averageDensity = stats.totalNotes / (matrixState.activeLoops.size * matrixState.stepCount)
    }
    
    return stats
  }

  // Inicializar matriz
  const initializeMatrix = () => {
    // Inicializar la matriz con arrays vacíos
    for (let i = 0; i < MAX_LOOPS; i++) {
      notesMatrix.value[i] = new Array(MAX_STEPS).fill(null)
    }
    
    // Inicializar metadata vacío
    Object.keys(loopMetadata).forEach(key => {
      delete loopMetadata[key]
    })
    
    // Inicializar estado por defecto
    matrixState.activeLoops.clear()
    matrixState.currentScale = 'major'
    matrixState.globalBaseNote = 60
    matrixState.stepCount = 16
    matrixState.syncMode = 'all'
  }

  // Limpiar matriz completa
  const clearMatrix = () => {
    notesMatrix.value.forEach(loop => loop.fill(null))
    Object.keys(loopMetadata).forEach(key => delete loopMetadata[key])
    matrixState.activeLoops.clear()
  }

  // Exportar/importar matriz
  const exportMatrix = () => {
    return {
      notes: notesMatrix.value,
      metadata: { ...loopMetadata },
      state: { ...matrixState, activeLoops: Array.from(matrixState.activeLoops) }
    }
  }

  const importMatrix = (data) => {
    if (!data || !data.notes || !data.metadata) return false
    
    try {
      notesMatrix.value = data.notes
      Object.assign(loopMetadata, data.metadata)
      Object.assign(matrixState, data.state)
      matrixState.activeLoops = new Set(data.state.activeLoops || [])
      return true
    } catch (error) {
      console.error('Error importing matrix:', error)
      return false
    }
  }

  return {
    // Estado
    notesMatrix: readonly(notesMatrix),
    loopMetadata: readonly(loopMetadata),
    matrixState: readonly(matrixState),
    currentScaleNotes,
    
    // Gestión de loops
    initializeLoop,
    setLoopActive,
    getLoopNotes,
    setLoopNotes,
    setNote,
    getNote,
    
    // Generación
    generateLoopNotes,
    
    // Cuantización
    quantizeLoop,
    quantizeAllActiveLoops,
    
    // Operaciones evolutivas
    transposeLoop,
    rotateLoop,
    invertLoop,
    mutateLoop,
    copyLoop,
    
    // Utilidades
    initializeMatrix,
    getMatrixStats,
    clearMatrix,
    exportMatrix,
    importMatrix
  }
}