import { ref, computed } from 'vue'
import { useScales, useChords } from './musicTheory.js'
import { clampToMidiRange, quantizeToScale as _quantizeSingle } from './musicUtils.js'

export { useScales, useChords }
export { clampToMidiRange } from './musicUtils.js'

// clampToMidiRange now provided by musicUtils.js


export function usePatterns() {
  // Generar patrón rítmico
  const generateRhythmPattern = (length = 16, density = 0.35) => {
    const pattern = new Array(length).fill(false)

    // Aplicar densidad
    for (let i = 0; i < length; i++) {
      if (Math.random() < density) {
        pattern[i] = true
      }
    }

    // Asegurar al menos una nota activa
    if (!pattern.some(Boolean)) {
      pattern[0] = true
    }

    return pattern
  }

  // Generar patrón melódico
  const generateMelodyPattern = (scale, baseNote, length = 16) => {
    const notes = []

    for (let i = 0; i < length; i++) {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const octave = Math.floor(Math.random() * 3) // 0-2 octavas adicionales
      const note = baseNote + scale[scaleIndex] + (octave * 12)
      notes.push(note)
    }

    return notes
  }

  // Generar patrón euclidiano
  const generateEuclideanPattern = (steps, pulses) => {
    if (pulses >= steps) {
      return new Array(steps).fill(true)
    }

    const pattern = new Array(steps).fill(false)
    const interval = steps / pulses

    for (let i = 0; i < pulses; i++) {
      const index = Math.round(i * interval) % steps
      pattern[index] = true
    }

    return pattern
  }

  // Generar patrón con swing
  const generateSwingPattern = (length = 16, swingAmount = 0.1) => {
    const pattern = generateRhythmPattern(length)
    const swingPattern = []

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i]) {
        // Aplicar swing en beats off (impares)
        const timing = i % 2 === 1 ? swingAmount : 0
        swingPattern.push({
          active: true,
          timing: timing
        })
      } else {
        swingPattern.push({
          active: false,
          timing: 0
        })
      }
    }

    return swingPattern
  }

  return {
    generateRhythmPattern,
    generateMelodyPattern,
    generateEuclideanPattern,
    generateSwingPattern
  }
}

export function useNoteUtils() {
  // Convertir número MIDI a nombre de nota
  const midiToNoteName = (midiNumber) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(midiNumber / 12) - 1
    const noteIndex = midiNumber % 12
    return `${noteNames[noteIndex]}${octave}`
  }

  // Convertir nombre de nota a número MIDI
  const noteNameToMidi = (noteName) => {
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    }

    const match = noteName.match(/([A-G][#b]?)(\d+)/)
    if (!match) return 60 // Default to C4

    const [, note, octave] = match
    return (parseInt(octave) + 1) * 12 + noteMap[note]
  }



  // Generar nota base aleatoria
  const generateRandomBaseNote = (minNote = 36, maxNote = 60) => {
    return Math.floor(Math.random() * (maxNote - minNote + 1)) + minNote
  }

  const quantizeToScale = _quantizeSingle

  return {
    midiToNoteName,
    noteNameToMidi,
    generateRandomBaseNote,
    quantizeToScale
  }
}


export function useMusic() {
  const { scales, getRandomScale, getScale, generateScaleNotes } = useScales()
  const { generateRhythmPattern, generateMelodyPattern, generateEuclideanPattern, generateSwingPattern } = usePatterns()
  const { midiToNoteName, noteNameToMidi } = useNoteUtils()

  // Funciones para escalas consonantes y disonantes
  const getConsonantScale = (currentScale = null, recentScales = []) => {
    const consonantScales = ['major', 'lydian', 'mixolydian', 'pentatonic', 'minor']
    const available = consonantScales.filter(scale =>
      scale !== currentScale && !recentScales.includes(scale)
    )
    return available.length > 0 ?
      available[Math.floor(Math.random() * available.length)] : 'major'
  }

  const getDissonantScale = (currentScale = null, recentScales = []) => {
    const dissonantScales = ['diminished', 'wholeTone', 'chromatic', 'phrygian', 'locrian']
    const available = dissonantScales.filter(scale =>
      scale !== currentScale && !recentScales.includes(scale)
    )
    return available.length > 0 ?
      available[Math.floor(Math.random() * available.length)] : 'diminished'
  }

  const getRelatedScale = (targetScale, currentScale = null, recentScales = []) => {
    // Relaciones armónicas comunes
    const relations = {
      'major': ['lydian', 'mixolydian', 'minor', 'pentatonic'],
      'minor': ['dorian', 'phrygian', 'harmonicMinor', 'major'],
      'dorian': ['minor', 'mixolydian', 'major', 'pentatonic'],
      'phrygian': ['minor', 'harmonicMinor', 'diminished'],
      'lydian': ['major', 'mixolydian', 'wholeTone'],
      'mixolydian': ['major', 'dorian', 'lydian'],
      'pentatonic': ['major', 'dorian', 'mixolydian']
    }

    const related = relations[targetScale] || ['major', 'minor', 'dorian']
    const available = related.filter(scale =>
      scale !== currentScale && !recentScales.includes(scale)
    )
    return available.length > 0 ?
      available[Math.floor(Math.random() * available.length)] : getRandomScale().name
  }

  // Función para cuantizar notas a una escala
  const quantizeToScale = (notes, targetScale, baseNote) => {
    const targetIntervals = scales[targetScale] || scales.major

    return notes.map(note => {
      if (typeof note !== 'number') return note

      // Calcular la distancia desde la nota base
      const distance = note - baseNote
      const octave = Math.floor(distance / 12)
      const relativePitch = ((distance % 12) + 12) % 12 // Asegurar valor positivo

      // Encontrar el intervalo más cercano en la escala objetivo
      let closestInterval = targetIntervals[0]
      let minDistance = Math.abs(relativePitch - closestInterval)

      targetIntervals.forEach(interval => {
        const distance = Math.abs(relativePitch - interval)
        if (distance < minDistance) {
          minDistance = distance
          closestInterval = interval
        }
      })

      // Devolver la nota cuantizada en rango válido
      const quantizedNote = baseNote + closestInterval + (octave * 12)
      return Math.max(24, Math.min(84, quantizedNote))
    })
  }

  return {
    getConsonantScale,
    getDissonantScale,
    getRelatedScale,
    quantizeToScale
  }
}