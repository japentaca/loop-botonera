export const clampToMidiRange = (note, maxNote = 96) => {
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

export const quantizeToScale = (midiNote, scale, baseNote = 60) => {
  if (typeof midiNote !== 'number') return midiNote
  const relativeNote = midiNote - baseNote
  const octave = Math.floor(relativeNote / 12)
  const noteInOctave = ((relativeNote % 12) + 12) % 12
  let closestInterval = scale[0]
  let minDistance = Math.abs(noteInOctave - scale[0])
  scale.forEach(interval => {
    const distance = Math.abs(noteInOctave - interval)
    if (distance < minDistance) {
      minDistance = distance
      closestInterval = interval
    }
  })
  const quantizedNote = clampToMidiRange(baseNote + (octave * 12) + closestInterval, 84)
  return quantizedNote
}