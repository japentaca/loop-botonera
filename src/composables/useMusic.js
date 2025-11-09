import { ref, computed } from 'vue'

// Helper function for efficient MIDI note clamping
const clampToMidiRange = (note, maxNote = 96) => {
  const MIN_MIDI = 24
  const OCTAVE = 12

  if (note < MIN_MIDI) {
    const octavesBelow = Math.ceil((MIN_MIDI - note) / OCTAVE)
    return note + (octavesBelow * OCTAVE)
  }
  if (note > maxNote) {
    const octavesAbove = Math.ceil((note - maxNote) / OCTAVE)
    return note - (octavesAbove * OCTAVE)
  }
  return note
}

export function useScales() {
  const scales = {
    // Escalas diatónicas
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],

    // Modos griegos
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],

    // Escalas menores
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],

    // Escalas pentatónicas
    pentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],

    // Escalas de blues
    blues: [0, 3, 5, 6, 7, 10],
    majorBlues: [0, 2, 3, 4, 7, 9],

    // Escalas exóticas
    wholeTone: [0, 2, 4, 6, 8, 10],
    diminished: [0, 1, 3, 4, 6, 7, 9, 10],

    // Escalas modales modernas
    acoustic: [0, 2, 4, 6, 7, 9, 10],
    altered: [0, 1, 3, 4, 6, 8, 10],

    // Escalas étnicas
    hirajoshi: [0, 2, 3, 7, 8],
    kumoi: [0, 2, 3, 7, 9],
    pelog: [0, 1, 3, 7, 8],

    // Escalas adicionales
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    augmented: [0, 3, 4, 7, 8, 11],
    bebop: [0, 2, 4, 5, 7, 9, 10, 11]
  }

  // Nombres en español para mostrar en UI
  const scaleNamesSpanish = {
    major: 'Mayor natural',
    minor: 'Menor natural',
    dorian: 'Dórica',
    phrygian: 'Frigia',
    lydian: 'Lidia',
    mixolydian: 'Mixolidia',
    locrian: 'Locria',
    harmonicMinor: 'Menor armónica',
    melodicMinor: 'Menor melódica',
    pentatonic: 'Pentatónica mayor',
    minorPentatonic: 'Pentatónica menor',
    blues: 'Blues menor',
    majorBlues: 'Blues mayor',
    wholeTone: 'Tono entero',
    diminished: 'Disminuida',
    acoustic: 'Acústica',
    altered: 'Alterada',
    hirajoshi: 'Hirajoshi',
    kumoi: 'Kumoi',
    pelog: 'Pelog',
    chromatic: 'Cromática',
    augmented: 'Aumentada',
    bebop: 'Bebop'
  }

  const scaleNames = computed(() => Object.keys(scales))

  // Obtener escala aleatoria
  const getRandomScale = () => {
    const names = scaleNames.value
    const randomName = names[Math.floor(Math.random() * names.length)]
    return {
      name: randomName,
      intervals: scales[randomName]
    }
  }

  // Obtener escala por nombre
  const getScale = (name) => {
    return scales[name] || scales.minor
  }

  // Generar notas de una escala
  const generateScaleNotes = (scale, baseNote, octaves = 3) => {
    const notes = []

    for (let octave = 0; octave < octaves; octave++) {
      scale.forEach(interval => {
        notes.push(baseNote + interval + (octave * 12))
      })
    }

    return notes
  }

  return {
    scales,
    scaleNames,
    scaleNamesSpanish,
    getRandomScale,
    getScale,
    generateScaleNotes
  }
}

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

  // Cuantizar nota a escala
  const quantizeToScale = (midiNote, scale, baseNote = 60) => {
    if (typeof midiNote !== 'number') return midiNote

    const relativeNote = midiNote - baseNote
    const octave = Math.floor(relativeNote / 12)
    const noteInOctave = ((relativeNote % 12) + 12) % 12 // Asegurar valor positivo

    // Encontrar la nota más cercana en la escala
    let closestInterval = scale[0]
    let minDistance = Math.abs(noteInOctave - scale[0])

    scale.forEach(interval => {
      const distance = Math.abs(noteInOctave - interval)
      if (distance < minDistance) {
        minDistance = distance
        closestInterval = interval
      }
    })

    // Devolver la nota cuantizada en rango válido manteniendo la escala
    const quantizedNote = clampToMidiRange(baseNote + (octave * 12) + closestInterval, 84)

    return quantizedNote
  }

  return {
    midiToNoteName,
    noteNameToMidi,
    generateRandomBaseNote,
    quantizeToScale
  }
}

export function useChords() {
  const chordTypes = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dominant7: [0, 4, 7, 10],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7]
  }

  // Generar acorde
  const generateChord = (rootNote, chordType = 'major') => {
    const intervals = chordTypes[chordType] || chordTypes.major
    return intervals.map(interval => rootNote + interval)
  }

  // Generar progresión de acordes
  const generateChordProgression = (scale, baseNote, length = 4) => {
    const progression = []

    for (let i = 0; i < length; i++) {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const chordRoot = baseNote + scale[scaleIndex]
      const chordType = Math.random() > 0.7 ? 'minor' : 'major'
      progression.push(generateChord(chordRoot, chordType))
    }

    return progression
  }

  return {
    chordTypes,
    generateChord,
    generateChordProgression
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