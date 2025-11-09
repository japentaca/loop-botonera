import { ref, computed } from 'vue'
import { useChords, useScales } from './useMusic'

/**
 * Composable for managing chord progressions in the loop system
 * Tracks current chord, progression, and provides utilities for
 * chord-aware note generation
 */
export function useChordProgression() {
  const currentProgression = ref([])
  const currentChordIndex = ref(0)
  const progressionLength = ref(4)
  const chordChangeMeasures = ref(4) // How many measures per chord

  const { generateChordProgression, getScaleDegreeChord, detectChordFromNote } = useChords()
  const { getScale } = useScales()

  // Get the current chord in the progression
  const getCurrentChord = computed(() => {
    if (currentProgression.value.length === 0) return null
    return currentProgression.value[currentChordIndex.value % currentProgression.value.length]
  })

  // Initialize a new chord progression
  const initializeProgression = (scaleName, baseNote, length = 4) => {
    const scale = getScale(scaleName)
    if (!scale) {
      console.warn(`[ChordProgression] Invalid scale: ${scaleName}`)
      return
    }

    currentProgression.value = generateChordProgression(scale, baseNote, length, scaleName)
    currentChordIndex.value = 0
    progressionLength.value = length
    
    console.log(`[ChordProgression] Initialized ${length}-chord progression in ${scaleName}:`, 
      currentProgression.value.map(c => `${c.type}(${c.degree})`).join(' - '))
  }

  // Update progression when scale changes
  const updateProgressionForScale = (scaleName, baseNote) => {
    const scale = getScale(scaleName)
    if (!scale) return

    // Keep the same progression structure but update to new scale
    const newProgression = []
    for (const oldChord of currentProgression.value) {
      const newChord = getScaleDegreeChord(scale, baseNote, oldChord.degree, oldChord.type)
      newProgression.push(newChord)
    }

    currentProgression.value = newProgression
  }

  // Advance to the next chord in the progression
  const advanceChord = () => {
    if (currentProgression.value.length === 0) return
    currentChordIndex.value = (currentChordIndex.value + 1) % currentProgression.value.length
  }

  // Get notes that fit the current chord
  const getChordTones = (octaveRange = 2, baseOctave = 4) => {
    const chord = getCurrentChord.value
    if (!chord) return []

    const notes = []
    for (let octave = 0; octave < octaveRange; octave++) {
      chord.notes.forEach(note => {
        const octaveNote = note + (baseOctave + octave) * 12
        if (octaveNote >= 24 && octaveNote <= 96) {
          notes.push(octaveNote)
        }
      })
    }

    return notes
  }

  // Check if a note fits in the current chord
  const isChordTone = (midiNote) => {
    const chord = getCurrentChord.value
    if (!chord) return false

    const noteClass = midiNote % 12
    return chord.notes.some(chordNote => (chordNote % 12) === noteClass)
  }

  // Quantize note to nearest chord tone
  const quantizeToChord = (midiNote) => {
    const chord = getCurrentChord.value
    if (!chord) return midiNote

    const octave = Math.floor(midiNote / 12)
    const noteClass = midiNote % 12

    // Find nearest chord tone
    let closestInterval = chord.notes[0] % 12
    let minDistance = Math.abs(noteClass - closestInterval)

    chord.notes.forEach(chordNote => {
      const interval = chordNote % 12
      const distance = Math.abs(noteClass - interval)
      if (distance < minDistance) {
        minDistance = distance
        closestInterval = interval
      }
    })

    return octave * 12 + closestInterval
  }

  // Generate melody that follows the chord progression
  const generateChordAwareMelody = (length, scaleName, baseNote) => {
    const scale = getScale(scaleName)
    const melody = []

    for (let i = 0; i < length; i++) {
      // Calculate which chord we should be on for this step
      const chordIdx = Math.floor(i / (length / progressionLength.value)) % progressionLength.value
      const chord = currentProgression.value[chordIdx]

      if (!chord) {
        // Fallback to scale notes
        const scaleIdx = Math.floor(Math.random() * scale.length)
        melody.push(baseNote + scale[scaleIdx] + Math.floor(Math.random() * 24))
        continue
      }

      // 70% chance for chord tone, 30% for passing tone from scale
      if (Math.random() < 0.7) {
        // Use chord tone
        const chordNote = chord.notes[Math.floor(Math.random() * chord.notes.length)]
        const octave = Math.floor(Math.random() * 3)
        melody.push(chordNote + octave * 12)
      } else {
        // Use scale tone (passing tone)
        const scaleIdx = Math.floor(Math.random() * scale.length)
        const octave = Math.floor(Math.random() * 3)
        melody.push(baseNote + scale[scaleIdx] + octave * 12)
      }
    }

    return melody
  }

  // Get progression info for display
  const getProgressionInfo = () => {
    return {
      length: progressionLength.value,
      currentIndex: currentChordIndex.value,
      currentChord: getCurrentChord.value,
      progression: currentProgression.value.map(c => ({
        type: c.type,
        degree: c.degree,
        root: c.root
      }))
    }
  }

  return {
    // State
    currentProgression,
    currentChordIndex,
    progressionLength,
    chordChangeMeasures,
    
    // Computed
    getCurrentChord,
    
    // Methods
    initializeProgression,
    updateProgressionForScale,
    advanceChord,
    getChordTones,
    isChordTone,
    quantizeToChord,
    generateChordAwareMelody,
    getProgressionInfo
  }
}
