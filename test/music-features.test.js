import { describe, it, expect } from 'vitest'
import { usePolyrhythm, useMusicalStyles, useChords } from '../src/composables/useMusic'

describe('Polyrhythm utilities', () => {
  it('calculates LCM correctly', () => {
    const { lcm } = usePolyrhythm()
    expect(lcm(3, 4)).toBe(12)
    expect(lcm(5, 7)).toBe(35)
  })

  it('calculates polyrhythm cycle length', () => {
    const { calculatePolyrythmCycle } = usePolyrhythm()
    expect(calculatePolyrythmCycle([3, 4])).toBe(12)
    expect(calculatePolyrythmCycle([3, 4, 5])).toBe(60)
  })

  it('generates polyrhythmic sets', () => {
    const { generatePolyrhythmicSet } = usePolyrhythm()
    const set = generatePolyrhythmicSet(4, 16)
    
    expect(set).toHaveProperty('name')
    expect(set).toHaveProperty('patterns')
    expect(set.patterns.length).toBeGreaterThan(0)
  })

  it('has available polyrhythm ratios', () => {
    const { polyrhythmRatios } = usePolyrhythm()
    expect(polyrhythmRatios.length).toBeGreaterThan(0)
    expect(polyrhythmRatios[0]).toHaveProperty('name')
    expect(polyrhythmRatios[0]).toHaveProperty('lengths')
  })
})

describe('Musical styles', () => {
  it('has multiple style definitions', () => {
    const { styles, getStyleNames } = useMusicalStyles()
    const styleNames = getStyleNames()
    
    expect(styleNames.length).toBeGreaterThan(0)
    expect(styleNames).toContain('ambient')
    expect(styleNames).toContain('jazz')
    expect(styleNames).toContain('techno')
  })

  it('returns valid style info', () => {
    const { getStyle } = useMusicalStyles()
    const ambient = getStyle('ambient')
    
    expect(ambient).toHaveProperty('name')
    expect(ambient).toHaveProperty('scalePreferences')
    expect(ambient).toHaveProperty('density')
    expect(ambient).toHaveProperty('evolutionIntensity')
    expect(ambient).toHaveProperty('chordTypes')
  })

  it('returns style-appropriate scales', () => {
    const { getRandomStyleScale } = useMusicalStyles()
    const scale = getRandomStyleScale('jazz')
    
    expect(scale).toBeDefined()
    expect(typeof scale).toBe('string')
  })

  it('returns style-appropriate chord types', () => {
    const { getStyleChordType } = useMusicalStyles()
    const chordType = getStyleChordType('jazz')
    
    expect(chordType).toBeDefined()
    expect(typeof chordType).toBe('string')
  })
})

describe('Enhanced chord system', () => {
  it('has extended chord types', () => {
    const { chordTypes } = useChords()
    
    expect(chordTypes).toHaveProperty('major')
    expect(chordTypes).toHaveProperty('minor')
    expect(chordTypes).toHaveProperty('diminished7')
    expect(chordTypes).toHaveProperty('major9')
  })

  it('generates chord progressions with metadata', () => {
    const { generateChordProgression } = useChords()
    const scale = [0, 2, 4, 5, 7, 9, 11] // major scale
    const baseNote = 60 // C4
    
    const progression = generateChordProgression(scale, baseNote, 4, 'major')
    
    expect(progression.length).toBe(4)
    expect(progression[0]).toHaveProperty('notes')
    expect(progression[0]).toHaveProperty('root')
    expect(progression[0]).toHaveProperty('type')
    expect(progression[0]).toHaveProperty('degree')
  })

  it('has chord progression templates', () => {
    const { chordProgressionTemplates } = useChords()
    
    expect(chordProgressionTemplates).toHaveProperty('major')
    expect(chordProgressionTemplates).toHaveProperty('minor')
    expect(chordProgressionTemplates.major.length).toBeGreaterThan(0)
  })

  it('gets scale degree chords', () => {
    const { getScaleDegreeChord } = useChords()
    const scale = [0, 2, 4, 5, 7, 9, 11]
    const baseNote = 60
    
    const chord = getScaleDegreeChord(scale, baseNote, 0, 'major')
    
    expect(chord).toHaveProperty('notes')
    expect(chord).toHaveProperty('root')
    expect(chord.root).toBe(60)
  })

  it('detects chord from note', () => {
    const { generateChordProgression, detectChordFromNote } = useChords()
    const scale = [0, 2, 4, 5, 7, 9, 11]
    const baseNote = 60
    
    const progression = generateChordProgression(scale, baseNote, 2, 'major')
    const noteInChord = progression[0].notes[0]
    
    const detected = detectChordFromNote(noteInChord, progression)
    expect(detected).toBeDefined()
  })
})

describe('Integration tests', () => {
  it('style and chord system work together', () => {
    const { getStyle } = useMusicalStyles()
    const { generateChord } = useChords()
    
    const style = getStyle('jazz')
    const chordType = style.chordTypes[0]
    const chord = generateChord(60, chordType)
    
    expect(chord.length).toBeGreaterThan(0)
  })

  it('polyrhythm and style have compatible tempo ranges', () => {
    const { getStyle } = useMusicalStyles()
    const { polyrhythmRatios } = usePolyrhythm()
    
    const style = getStyle('techno')
    expect(style.tempo.min).toBeGreaterThan(0)
    expect(style.tempo.max).toBeGreaterThan(style.tempo.min)
    expect(polyrhythmRatios.length).toBeGreaterThan(0)
  })
})
