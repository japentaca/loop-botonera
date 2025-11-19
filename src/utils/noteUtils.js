// Utility functions for note generation
// Centralize generatePossibleNotes to avoid duplication across modules

/**
 * Generate possible MIDI notes from a scale and base note inside a given range.
 * Returns an ascending-sorted array of MIDI notes (immutable copy is recommended by callers).
 */
export function generatePossibleNotes(scale, baseNote, noteRange, options = {}) {
  const possibleNotes = []
  if (!Array.isArray(scale) || typeof baseNote !== 'number' || !noteRange || typeof noteRange.min !== 'number' || typeof noteRange.max !== 'number') {
    return possibleNotes
  }
  const minOctave = Math.floor((noteRange.min - baseNote) / 12)
  const maxOctave = Math.floor((noteRange.max - baseNote) / 12)
  for (let oct = minOctave; oct <= maxOctave; oct++) {
    for (const interval of scale) {
      const note = baseNote + interval + (oct * 12)
      if (note >= noteRange.min && note <= noteRange.max) possibleNotes.push(note)
    }
  }
  // Ensure returned notes are in ascending order and immutable to callers
  possibleNotes.sort((a, b) => a - b)
  const DEBUG = typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)
  if (DEBUG) {
    const serialize = (v) => {
      try {
        return JSON.stringify(v)
      } catch (e) {
        if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? String(x) : x)).join(', ')
        return String(v)
      }
    }
    if (options && typeof options.tag === 'string') {
      console.log(`[${options.tag}] POSSIBLE`, serialize(possibleNotes))
    } else {
      console.log('POSSIBLE', serialize(possibleNotes))
    }
  }
  return possibleNotes
}
