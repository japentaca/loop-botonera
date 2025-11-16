import { computed } from 'vue'

export function useScales() {
  const _scaleCache = new Map()

  const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    pentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    majorBlues: [0, 2, 3, 4, 7, 9],
    wholeTone: [0, 2, 4, 6, 8, 10],
    diminished: [0, 1, 3, 4, 6, 7, 9, 10],
    acoustic: [0, 2, 4, 6, 7, 9, 10],
    altered: [0, 1, 3, 4, 6, 8, 10],
    hirajoshi: [0, 2, 3, 7, 8],
    kumoi: [0, 2, 3, 7, 9],
    pelog: [0, 1, 3, 7, 8],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    augmented: [0, 3, 4, 7, 8, 11],
    bebop: [0, 2, 4, 5, 7, 9, 10, 11]
  }

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

  const getRandomScale = () => {
    const names = scaleNames.value
    const randomName = names[Math.floor(Math.random() * names.length)]
    return {
      name: randomName,
      intervals: scales[randomName]
    }
  }

  const getScale = (name) => {
    if (_scaleCache.has(name)) {
      return _scaleCache.get(name)
    }
    if (!scales[name]) {
      console.error(`Scale not found: "${name}". Available scales: ${Object.keys(scales).join(', ')}`)
      throw new Error(`Invalid scale name: "${name}"`)
    }
    const scaleIntervals = scales[name]
    _scaleCache.set(name, scaleIntervals)
    return scaleIntervals
  }

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

  const generateChord = (rootNote, chordType = 'major') => {
    const intervals = chordTypes[chordType] || chordTypes.major
    return intervals.map(interval => rootNote + interval)
  }

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