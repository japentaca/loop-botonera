import { ref, computed } from 'vue'

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
    let quantizedNote = baseNote + (octave * 12) + closestInterval

    // Si está fuera del rango, transponer por octavas completas para mantener la escala
    while (quantizedNote < 24) {
      quantizedNote += 12
    }
    while (quantizedNote > 84) {
      quantizedNote -= 12
    }

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
    sus4: [0, 5, 7],
    diminished7: [0, 3, 6, 9],
    halfDiminished7: [0, 3, 6, 10],
    major9: [0, 4, 7, 11, 14],
    minor9: [0, 3, 7, 10, 14],
    add9: [0, 4, 7, 14]
  }

  // Common chord progressions by scale type
  const chordProgressionTemplates = {
    major: [
      { name: 'I-IV-V-I', degrees: [0, 3, 4, 0], types: ['major', 'major', 'major', 'major'] },
      { name: 'I-V-vi-IV', degrees: [0, 4, 5, 3], types: ['major', 'major', 'minor', 'major'] },
      { name: 'ii-V-I', degrees: [1, 4, 0], types: ['minor', 'major', 'major'] },
      { name: 'I-vi-IV-V', degrees: [0, 5, 3, 4], types: ['major', 'minor', 'major', 'major'] },
      { name: 'I-iii-IV-V', degrees: [0, 2, 3, 4], types: ['major', 'minor', 'major', 'major'] }
    ],
    minor: [
      { name: 'i-iv-v', degrees: [0, 3, 4], types: ['minor', 'minor', 'minor'] },
      { name: 'i-VI-VII', degrees: [0, 5, 6], types: ['minor', 'major', 'major'] },
      { name: 'i-iv-VII-VI', degrees: [0, 3, 6, 5], types: ['minor', 'minor', 'major', 'major'] },
      { name: 'i-v-i', degrees: [0, 4, 0], types: ['minor', 'minor', 'minor'] }
    ],
    dorian: [
      { name: 'i-IV-i', degrees: [0, 3, 0], types: ['minor', 'major', 'minor'] },
      { name: 'i-IV-VII', degrees: [0, 3, 6], types: ['minor', 'major', 'minor'] }
    ],
    blues: [
      { name: 'I-IV-V', degrees: [0, 3, 4], types: ['dominant7', 'dominant7', 'dominant7'] },
      { name: 'I7-IV7-I7-V7', degrees: [0, 3, 0, 4], types: ['dominant7', 'dominant7', 'dominant7', 'dominant7'] }
    ]
  }

  // Generar acorde
  const generateChord = (rootNote, chordType = 'major') => {
    const intervals = chordTypes[chordType] || chordTypes.major
    return intervals.map(interval => rootNote + interval)
  }

  // Generar progresión de acordes basada en escala
  const generateChordProgression = (scale, baseNote, length = 4, scaleName = 'major') => {
    const progression = []
    
    // Get template for this scale type if available
    const templates = chordProgressionTemplates[scaleName] || chordProgressionTemplates.major
    const template = templates[Math.floor(Math.random() * templates.length)]
    
    // Generate progression from template
    const progressionLength = Math.min(length, template.degrees.length)
    
    for (let i = 0; i < progressionLength; i++) {
      const degreeIndex = template.degrees[i % template.degrees.length]
      const chordType = template.types[i % template.types.length]
      const chordRoot = baseNote + scale[degreeIndex % scale.length]
      
      progression.push({
        notes: generateChord(chordRoot, chordType),
        root: chordRoot,
        type: chordType,
        degree: degreeIndex
      })
    }
    
    // Fill remaining with random chords if needed
    for (let i = progressionLength; i < length; i++) {
      const scaleIndex = Math.floor(Math.random() * scale.length)
      const chordRoot = baseNote + scale[scaleIndex]
      const chordType = Math.random() > 0.7 ? 'minor' : 'major'
      
      progression.push({
        notes: generateChord(chordRoot, chordType),
        root: chordRoot,
        type: chordType,
        degree: scaleIndex
      })
    }

    return progression
  }

  // Get chord for a specific scale degree
  const getScaleDegreeChord = (scale, baseNote, degree, chordType = 'major') => {
    const rootNote = baseNote + scale[degree % scale.length]
    return {
      notes: generateChord(rootNote, chordType),
      root: rootNote,
      type: chordType,
      degree
    }
  }

  // Detect which chord a note belongs to in a progression
  const detectChordFromNote = (note, progression) => {
    for (const chord of progression) {
      if (chord.notes.some(chordNote => (note % 12) === (chordNote % 12))) {
        return chord
      }
    }
    return null
  }

  return {
    chordTypes,
    chordProgressionTemplates,
    generateChord,
    generateChordProgression,
    getScaleDegreeChord,
    detectChordFromNote
  }
}

// Polyrhythmic pattern utilities
export function usePolyrhythm() {
  // Calculate least common multiple for syncing different loop lengths
  const lcm = (a, b) => {
    const gcd = (x, y) => y === 0 ? x : gcd(y, x % y)
    return Math.abs(a * b) / gcd(a, b)
  }

  // Find the cycle length for multiple loops
  const calculatePolyrythmCycle = (lengths) => {
    return lengths.reduce((acc, len) => lcm(acc, len), 1)
  }

  // Generate polyrhythmic pattern ratios (e.g., 3:4, 5:7)
  const polyrhythmRatios = [
    { name: '3:2', lengths: [3, 2], description: 'Hemiola' },
    { name: '3:4', lengths: [3, 4], description: 'Triple against quadruple' },
    { name: '5:4', lengths: [5, 4], description: 'Quintuple against quadruple' },
    { name: '7:4', lengths: [7, 4], description: 'Septuple against quadruple' },
    { name: '5:3', lengths: [5, 3], description: 'Quintuple against triple' },
    { name: '7:5', lengths: [7, 5], description: 'Septuple against quintuple' }
  ]

  // Generate a polyrhythmic pattern set for multiple loops
  const generatePolyrhythmicSet = (numLoops, baseLength = 16) => {
    const ratios = polyrhythmRatios[Math.floor(Math.random() * polyrhythmRatios.length)]
    const patterns = []

    for (let i = 0; i < numLoops; i++) {
      const lengthIndex = i % ratios.lengths.length
      const patternLength = ratios.lengths[lengthIndex] * Math.floor(baseLength / Math.max(...ratios.lengths))
      patterns.push({
        length: patternLength,
        ratio: ratios.lengths[lengthIndex],
        cycle: calculatePolyrythmCycle(ratios.lengths)
      })
    }

    return {
      name: ratios.name,
      description: ratios.description,
      patterns
    }
  }

  // Check if loops are aligned in polyrhythmic cycle
  const isPolyrythmicAlignment = (step, loopLength, cycleLength) => {
    return step % cycleLength === 0
  }

  return {
    lcm,
    calculatePolyrythmCycle,
    polyrhythmRatios,
    generatePolyrhythmicSet,
    isPolyrythmicAlignment
  }
}

// Musical style definitions for evolution
export function useMusicalStyles() {
  const styles = {
    ambient: {
      name: 'Ambient',
      description: 'Atmospheric, sparse, evolving textures',
      scalePreferences: ['major', 'lydian', 'pentatonic', 'wholeTone'],
      density: { min: 0.1, max: 0.3 },
      evolutionIntensity: 0.2,
      chordTypes: ['major', 'major7', 'sus2', 'sus4'],
      tempo: { min: 60, max: 90 }
    },
    jazz: {
      name: 'Jazz',
      description: 'Complex harmonies, swing feel, sophisticated',
      scalePreferences: ['dorian', 'mixolydian', 'altered', 'bebop'],
      density: { min: 0.4, max: 0.7 },
      evolutionIntensity: 0.5,
      chordTypes: ['major7', 'minor7', 'dominant7', 'halfDiminished7', 'major9'],
      tempo: { min: 120, max: 180 }
    },
    techno: {
      name: 'Techno',
      description: 'Repetitive, driving, minimal variation',
      scalePreferences: ['minor', 'phrygian', 'harmonicMinor'],
      density: { min: 0.6, max: 0.9 },
      evolutionIntensity: 0.3,
      chordTypes: ['minor', 'minor7', 'diminished'],
      tempo: { min: 120, max: 140 }
    },
    classical: {
      name: 'Classical',
      description: 'Traditional progressions, balanced',
      scalePreferences: ['major', 'minor', 'harmonicMinor'],
      density: { min: 0.4, max: 0.6 },
      evolutionIntensity: 0.4,
      chordTypes: ['major', 'minor', 'diminished', 'dominant7'],
      tempo: { min: 80, max: 140 }
    },
    minimal: {
      name: 'Minimal',
      description: 'Very sparse, slow evolution',
      scalePreferences: ['pentatonic', 'minorPentatonic', 'major'],
      density: { min: 0.1, max: 0.2 },
      evolutionIntensity: 0.1,
      chordTypes: ['major', 'minor'],
      tempo: { min: 80, max: 110 }
    },
    experimental: {
      name: 'Experimental',
      description: 'Unpredictable, dissonant, avant-garde',
      scalePreferences: ['chromatic', 'wholeTone', 'diminished', 'altered'],
      density: { min: 0.3, max: 0.8 },
      evolutionIntensity: 0.8,
      chordTypes: ['diminished', 'augmented', 'diminished7'],
      tempo: { min: 60, max: 160 }
    },
    world: {
      name: 'World',
      description: 'Ethnic scales, exotic flavors',
      scalePreferences: ['hirajoshi', 'kumoi', 'pelog', 'pentatonic'],
      density: { min: 0.3, max: 0.6 },
      evolutionIntensity: 0.4,
      chordTypes: ['major', 'minor', 'sus4'],
      tempo: { min: 90, max: 130 }
    }
  }

  const getStyle = (styleName) => {
    return styles[styleName] || styles.classical
  }

  const getStyleNames = () => {
    return Object.keys(styles)
  }

  const getRandomStyleScale = (styleName) => {
    const style = getStyle(styleName)
    return style.scalePreferences[Math.floor(Math.random() * style.scalePreferences.length)]
  }

  const getStyleChordType = (styleName) => {
    const style = getStyle(styleName)
    return style.chordTypes[Math.floor(Math.random() * style.chordTypes.length)]
  }

  return {
    styles,
    getStyle,
    getStyleNames,
    getRandomStyleScale,
    getStyleChordType
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