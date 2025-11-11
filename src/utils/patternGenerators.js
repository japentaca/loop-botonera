/**
 * Pattern Generation Module
 * Pure functions for generating melodic patterns with counterpoint awareness
 * All functions return arrays of MIDI note numbers or null (for rests)
 */

/**
 * Generate Euclidean rhythm pattern using Bjorklund's algorithm
 * @param {Object} params
 * @param {number} params.length - Total number of steps in the pattern
 * @param {Array<number>} params.scale - Scale intervals array (e.g., [0,2,4,5,7,9,11])
 * @param {number} params.baseNote - Base MIDI note number
 * @param {Object} params.noteRange - {min: number, max: number} MIDI range
 * @param {number} params.density - Density factor (0-1), controls number of pulses
 * @param {Object} params.options - Additional options
 * @returns {Array<number|null>} Array of MIDI notes or nulls
 */
export function generateEuclideanPattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

  const startTime = performance.now();

  // Ensure density is a valid number
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Calculate number of pulses based on density
  const pulses = Math.max(1, Math.floor(length * density));

  // Generate Euclidean distribution
  const positions = euclideanRhythm(pulses, length);

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  // Create pattern array
  const pattern = new Array(length).fill(null);

  // Place notes at Euclidean positions
  positions.forEach(pos => {
    if (possibleNotes.length > 0) {
      pattern[pos] = possibleNotes[Math.floor(Math.random() * possibleNotes.length)];
    }
  });

  const elapsed = performance.now() - startTime;
  melLog(`generateEuclideanPattern steps=${length} pulses=${pulses} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

  return pattern;
}

/**
 * Generate arpeggio pattern (broken chord progression)
 * @param {Object} params
 * @param {number} params.length - Total number of steps in the pattern
 * @param {Array<number>} params.scale - Scale intervals array
 * @param {number} params.baseNote - Base MIDI note number
 * @param {Object} params.noteRange - {min: number, max: number} MIDI range
 * @param {number} params.density - Density factor (0-1), controls rests between notes
 * @param {Object} params.options - Additional options (arpeggioType, etc.)
 * @returns {Array<number|null>} Array of MIDI notes or nulls
 */
export function generateArpeggioPattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

  const startTime = performance.now();

  // Density is ignored for arpeggio placement; spacing is fixed per generation

  // Arpeggio subtypes: support 'UP_RANDOM_BACK' and 'DOWN_RANDOM_BACK'
  // If no subtype is provided, select randomly between the two
  // Older forms (UP, DOWN, UP_DOWN, DOWN_UP) are deprecated and removed.
  const arpeggioType = options.arpeggioType ?? (Math.random() < 0.5 ? 'UP_RANDOM_BACK' : 'DOWN_RANDOM_BACK');

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  if (possibleNotes.length === 0) {
    melLog(`generateArpeggioPattern failed: no possible notes in range`);
    return new Array(length).fill(null);
  }

  // Sort notes for directional arpeggios
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);

  // Choose fixed spacing: integer grid steps (1=16th, 2=8th, 3=dotted 8th, 4=quarter)
  const stepInterval = Math.floor(Math.random() * 4) + 1; // 1..4
  // Determine start offset: use explicit metadata pulse index if provided,
  // otherwise default to a 16th-grid phase within the first measure window.
  const hasExplicitStart = typeof options.startOffset === 'number' && isFinite(options.startOffset);
  const startOffset = hasExplicitStart
    ? Math.max(0, Math.min(length - 1, Math.floor(options.startOffset)))
    : Math.floor(Math.random() * Math.min(16, length)); // 0..length-1 (first measure window)

  // Compute placement positions: same spacing for all notes
  const positions = [];
  let pos = startOffset;
  let dir = 1; // unit-step bounce to guarantee full coverage
  const min = 0;
  const max = length - 1;

  // Keep bouncing until we have placements for the full loop length
  for (let i = 0; i < length; i++) {
    positions.push(pos);

    let next = pos + dir;
    if (next > max || next < min) {
      // Reverse direction and step with the same interval
      dir = -dir;
      next = pos + dir;
      // Safety clamp for degenerate cases
      if (next > max) next = max;
      if (next < min) next = min;
    }
    pos = next;
  }

  // Generate arpeggio sequence sized to placements
  const sequenceLength = positions.length;
  const arpeggioSequence = [];
  if (sortedNotes.length === 1) {
    while (arpeggioSequence.length < sequenceLength) {
      arpeggioSequence.push(sortedNotes[0]);
    }
  } else {
    const randomStartIndex = Math.floor(Math.random() * sortedNotes.length);
    const maxBack = Math.max(1, Math.min(options.backJumpMax ?? 2, sortedNotes.length));
    let leadIdx = randomStartIndex;

    while (arpeggioSequence.length < sequenceLength) {
      // Choose random backward jump length [1..maxBack]
      const backLen = Math.floor(Math.random() * maxBack) + 1;

      // Emit the lead note first
      arpeggioSequence.push(sortedNotes[leadIdx]);
      if (arpeggioSequence.length >= sequenceLength) break;

      if (arpeggioType === 'UP_RANDOM_BACK') {
        // Backward relative to UP is descending
        for (let step = 1; step < backLen && arpeggioSequence.length < sequenceLength; step++) {
          const backIdx = leadIdx - step;
          if (backIdx < 0) break; // Clamp at bottom; avoid wrapping for clean runs
          arpeggioSequence.push(sortedNotes[backIdx]);
        }
        // Advance the lead index upwards; wrap across range
        leadIdx = (leadIdx + 1) % sortedNotes.length;
      } else {
        // DOWN_RANDOM_BACK: backward relative to DOWN is ascending
        for (let step = 1; step < backLen && arpeggioSequence.length < sequenceLength; step++) {
          const backIdx = leadIdx + step;
          if (backIdx >= sortedNotes.length) break; // Clamp at top; avoid wrapping for clean runs
          arpeggioSequence.push(sortedNotes[backIdx]);
        }
        // Advance the lead index downwards; wrap across range
        leadIdx = (leadIdx - 1 + sortedNotes.length) % sortedNotes.length;
      }
    }
  }

  // Build pattern with placements; rest elsewhere
  const pattern = new Array(length).fill(null);
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = arpeggioSequence[i];
  }

  const elapsed = performance.now() - startTime;
  melLog(`generateArpeggioPattern steps=${length} type=${arpeggioType} interval=${stepInterval} offset=${startOffset} placements=${positions.length} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

  return pattern;
}

/**
 * Generate enhanced random pattern (improved version of current random generation)
 * @param {Object} params
 * @param {number} params.length - Total number of steps in the pattern
 * @param {Array<number>} params.scale - Scale intervals array
 * @param {number} params.baseNote - Base MIDI note number
 * @param {Object} params.noteRange - {min: number, max: number} MIDI range
 * @param {number} params.density - Density factor (0-1), controls number of notes
 * @param {Object} params.options - Additional options
 * @returns {Array<number|null>} Array of MIDI notes or nulls
 */
export function generateRandomPattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

  const startTime = performance.now();

  // Ensure density is a valid number
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  if (possibleNotes.length === 0) {
    melLog(`generateRandomPattern failed: no possible notes in range`);
    return new Array(length).fill(null);
  }

  // Calculate number of notes to place
  const noteCount = Math.max(1, Math.floor(length * density));

  // Select random positions
  const positions = new Set();
  while (positions.size < noteCount) {
    positions.add(Math.floor(Math.random() * length));
  }

  // Create pattern
  const pattern = new Array(length).fill(null);
  for (const pos of positions) {
    pattern[pos] = possibleNotes[Math.floor(Math.random() * possibleNotes.length)];
  }

  const elapsed = performance.now() - startTime;
  melLog(`generateRandomPattern steps=${length} notes=${noteCount} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

  return pattern;
}

// Helper functions

/**
 * Generate all possible notes within the given range for a scale
 * @param {Array<number>} scale - Scale intervals
 * @param {number} baseNote - Base MIDI note
 * @param {Object} noteRange - {min, max} MIDI range
 * @returns {Array<number>} Array of valid MIDI notes
 */
function generatePossibleNotes(scale, baseNote, noteRange) {
  const possibleNotes = [];

  // Generate notes across multiple octaves within range
  const minOctave = Math.floor((noteRange.min - baseNote) / 12);
  const maxOctave = Math.floor((noteRange.max - baseNote) / 12);

  for (let oct = minOctave; oct <= maxOctave; oct++) {
    for (const interval of scale) {
      const note = baseNote + interval + (oct * 12);
      if (note >= noteRange.min && note <= noteRange.max) {
        possibleNotes.push(note);
      }
    }
  }

  return possibleNotes;
}

/**
 * Generate Euclidean rhythm using Bjorklund's algorithm
 * @param {number} pulses - Number of pulses (notes)
 * @param {number} steps - Total number of steps
 * @returns {Array<number>} Array of positions where pulses occur
 */
function euclideanRhythm(pulses, steps) {
  if (pulses <= 0) return [];
  if (pulses >= steps) {
    return Array.from({ length: steps }, (_, i) => i);
  }

  // Simple working implementation
  const positions = [];
  for (let i = 0; i < steps; i++) {
    // Use modulo to distribute pulses evenly
    if ((i * pulses) % steps < pulses) {
      positions.push(i);
    }
  }
  return positions;
}
