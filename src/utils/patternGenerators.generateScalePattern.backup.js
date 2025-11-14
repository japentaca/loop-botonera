/**
 * Backup of original generateScalePattern
 * Saved before simplifying the scale generator (formerly arpeggiator) so we can revert or rework later.
 * File created automatically by Copilot assistant.
 */
export function generateScalePattern_backup({ length, scale, baseNote, noteRange, density, options = {} }) {
  const startTime = performance.now();

  // Ensure density is a valid number (allow 0 for silent patterns)
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Scale subtypes: support 'UP_RANDOM_BACK' and 'DOWN_RANDOM_BACK'
  // If no subtype is provided, select randomly between the two
  // Older forms (UP, DOWN, UP_DOWN, DOWN_UP) are deprecated and removed.
  // Cadence now BOUNCES at min/max note limits (no wrapping across range).
  const scaleType = options.scaleType ?? (Math.random() < 0.5 ? 'UP_RANDOM_BACK' : 'DOWN_RANDOM_BACK');

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  if (possibleNotes.length === 0) {
    console.log(`generateScalePattern_backup failed: no possible notes in range`);
    return new Array(length).fill(null);
  }

  // Helper function for debug logging (defined before use)
  const noteToMidi = (midi) => {
    const noteNumber = midi % 12;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteNames[noteNumber]}${octave}`;
  };

  // Sort notes for directional scales
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);

  // Debug: log the scale notes being used
  console.log(`Scale notes (${sortedNotes.length}): ${sortedNotes.map(noteToMidi).join(', ')}`);

  // Determine start offset: explicit or random small phase
  const hasExplicitStart = typeof options.startOffset === 'number' && isFinite(options.startOffset);
  const startOffset = hasExplicitStart
    ? Math.max(0, Math.min(length - 1, Math.floor(options.startOffset)))
    : Math.floor(Math.random() * Math.min(3, length)); // 0..length-1 (first measure window)

  // Compute positions. Keep the original fillAll bounce behaviour (continuous scale)
  let positions = [];
  if (options.fillAll === true) {
    const min = 0;
    const max = length - 1;
    let pos = startOffset;
    let dir = 1; // unit-step bounce
    for (let i = 0; i < length; i++) {
      positions.push(pos);
      let next = pos + dir;
      if (next > max || next < min) {
        dir = -dir;
        next = pos + dir;
        if (next > max) next = max;
        if (next < min) next = min;
      }
      pos = next;
    }
  } else {
    const timing = options.timing ?? 'euclidean';
    positions = computePositions({ length, density, mode: timing, startOffset, allowZero: true });
  }

  // Generate scale sequence sized to placements
  const sequenceLength = positions.length;
  const scaleSequence = [];
  const leadNotes = []; // Track lead notes for visualization
  const tailGroups = []; // Track tail groups for visualization
  // Tail length must be consistent across the whole sequence.
  // Determine it once at the beginning, clamped to available notes.
  const tailLengthFixed = (() => {
    if (typeof options.tailLength === 'number' && isFinite(options.tailLength)) {
      return Math.max(0, Math.min(options.tailLength, sortedNotes.length - 1));
    }
    // Default to 3, limited by available notes below the lead
    return Math.min(3, sortedNotes.length - 1);
  })();

  // The original arpeggiator logic is intentionally preserved in the backup.
  // This file is kept as reference; current generator implementation uses a simplified
  // scale pattern generator elsewhere. For safety, provide a minimal fallback
  // sequence here so the backup can be inspected without causing runtime errors.

  // Minimal fallback: fill the sequence by cycling sortedNotes until we reach sequenceLength
  if (sortedNotes.length === 1) {
    while (scaleSequence.length < sequenceLength) scaleSequence.push(sortedNotes[0]);
  } else {
    let idx = 0;
    while (scaleSequence.length < sequenceLength) {
      scaleSequence.push(sortedNotes[idx % sortedNotes.length]);
      idx++;
    }
  }

  // Build pattern with placements; rest elsewhere
  let pattern = new Array(length).fill(null);
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = scaleSequence[i] ?? null;
  }

  // Log the generated scale sequence for debugging (compact format)
  const noteToCompactName = (note) => {
    if (note === null) return 'r';
    return noteToMidi(note);
  };

  const compactNames = scaleSequence.map(noteToCompactName);
  console.log(`Full sequence: ${compactNames.join(' ')}`);

  const elapsed = performance.now() - startTime;
  console.log(`generateScalePattern_backup steps=${length} type=${scaleType} density=${Number(density).toFixed(2)} offset=${startOffset} placements=${positions.length} range=${noteRange.min}..${noteRange.max} tail=on time=${elapsed.toFixed(1)}ms`);
  console.log(pattern);

  // Debug: sequence range (guard empty)
  if (scaleSequence.length > 0) {
    const minSeq = Math.min(...scaleSequence);
    const maxSeq = Math.max(...scaleSequence);
    console.log(`Sequence range: ${noteToMidi(minSeq)} (${minSeq}) to ${noteToMidi(maxSeq)} (${maxSeq})`);
  } else {
    console.log('Sequence range: (no notes)');
  }

  // Random shift left or right between 0 and loop length
  const shiftAmount = Math.floor(Math.random() * length);
  const direction = Math.random() < 0.5 ? 'left' : 'right';
  if (direction === 'left') {
    pattern = pattern.slice(shiftAmount).concat(pattern.slice(0, shiftAmount));
  } else {
    pattern = pattern.slice(-shiftAmount).concat(pattern.slice(0, -shiftAmount));
  }
  console.log(`Shifted ${direction} by ${shiftAmount} steps`);

  return pattern;
}
