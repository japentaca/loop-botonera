// Tonal Service: dynamic, optional integration with @tonaljs modules
// Provides simple helpers for note name conversion and interval labeling

let TonalLoaded = false
let NoteModule = null
let IntervalModule = null

// Try to load tonal modules with a top-level await (works in Node ESM)
try {
  NoteModule = await import('@tonaljs/note')
  IntervalModule = await import('@tonaljs/interval')
  TonalLoaded = true
} catch (e) {
  TonalLoaded = false
}

function midiToNoteName(midi) {
  if (TonalLoaded && NoteModule && typeof NoteModule.fromMidi === 'function') {
    try { return NoteModule.fromMidi(midi) } catch (e) { /* fallback */ }
  }
  // fallback: crude mapping C0 = 12, use octave and note names
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  if (typeof midi !== 'number' || Number.isNaN(midi)) return null
  const midiInt = Math.round(midi)
  const note = NOTE_NAMES[(midiInt % 12 + 12) % 12]
  const octave = Math.floor(midiInt / 12) - 1
  return `${note}${octave}`
}

function intervalLabelFromMidi(aMidi, bMidi) {
  if (TonalLoaded && IntervalModule && NoteModule && typeof IntervalModule.distance === 'function' && typeof NoteModule.fromMidi === 'function') {
    try {
      const aName = NoteModule.fromMidi(aMidi)
      const bName = NoteModule.fromMidi(bMidi)
      const dist = IntervalModule.distance(aName, bName)
      if (dist) return dist
    } catch (e) {
      // fallback to semitone-based mapping
    }
  }
  const semis = Math.abs(aMidi - bMidi) % 12
  switch (semis) {
    case 0: return 'P1'
    case 7: return 'P5'
    case 12: return 'P8'
    case 4: return 'M3'
    case 3: return 'm3'
    case 9: return 'M6'
    case 8: return 'm6'
    case 5: return 'P4'
    default: return `I${semis}`
  }
}

export { midiToNoteName, intervalLabelFromMidi, TonalLoaded }
