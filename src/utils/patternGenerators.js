/**
 * Pattern Generation Module
 * Pure functions for generating melodic patterns with counterpoint awareness
 * All functions return arrays of MIDI note numbers or null (for rests)
 */
const DEBUG = false

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
  const startTime = performance.now();

  // Ensure density is a valid number (allow 0 for silent patterns)
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Choose timing mode (euclidean|even|random|fillAll)
  const timing = options.timing ?? 'euclidean';

  // Compute placement positions using unified helper (allows zero density)
  const positions = computePositions({ length, density, mode: timing, startOffset: options.startOffset ?? 0, allowZero: true });

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  // Sort notes to ensure smooth transitions
  possibleNotes.sort((a, b) => a - b);

  // Create pattern array
  const pattern = new Array(length).fill(null);

  // Place notes at selected positions with controlled randomness
  if (possibleNotes.length > 0 && positions.length > 0) {
    let currentIndex = Math.floor(Math.random() * possibleNotes.length);
    positions.forEach(pos => {
      pattern[pos] = possibleNotes[currentIndex];
      // Move to a nearby note (1-3 steps forward) for smooth but random progression
      currentIndex = (currentIndex + Math.floor(Math.random() * 3) + 1) % possibleNotes.length;
    });
  }

  const elapsed = performance.now() - startTime;
  const pulses = positions.length;
  DEBUG && console.log(`generateEuclideanPattern steps=${length} pulses=${pulses} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

  return pattern;
}

/**
 * Generate scale pattern (formerly called "arpeggio" / broken chord progression)
 * @param {Object} params
 * @param {number} params.length - Total number of steps in the pattern
 * @param {Array<number>} params.scale - Scale intervals array
 * @param {number} params.baseNote - Base MIDI note number
 * @param {Object} params.noteRange - {min: number, max: number} MIDI range
 * @param {number} params.density - Density factor (0-1), controls number of scale sequences
 * @param {Object} params.options - Additional options (scaleType, etc.)
 * @returns {Array<number|null>} Array of MIDI notes or nulls
 */
export function generateScalePattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const startTime = performance.now();
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);
  if (possibleNotes.length === 0) {
    return new Array(length).fill(null);
  }
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);
  const timingMode = options.densityTiming ?? 'random';
  const positions = computePositions({ length, density, mode: timingMode, startOffset: options.startOffset ?? 0, allowZero: true });
  const placements = positions.length;
  if (placements === 0) return new Array(length).fill(null);
  const dir = Math.random() < 0.5 ? 'ascending' : 'descending';
  const ts = 1 + Math.floor(Math.random() * 4);
  const startIdx = Math.floor(Math.random() * sortedNotes.length);
  const moves = Math.max(1, Math.ceil(placements / (1 + ts)));
  const seqObj = generateHeadTailScaleSequence({ scaleNotes: sortedNotes, startIndex: startIdx, moves, direction: dir, tailSize: ts });
  const seq = seqObj.sequence;
  const pattern = new Array(length).fill(null);
  const mapping = options.positionMapping ?? 'sequential';
  if (mapping === 'sequential') {
    const sortedPos = [...positions].sort((a, b) => a - b);
    for (let k = 0; k < sortedPos.length; k++) {
      if (k >= seq.length) break;
      pattern[sortedPos[k]] = seq[k];
    }
  } else {
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      pattern[pos] = seq.length ? seq[i % seq.length] : null;
    }
  }
  const elapsed = performance.now() - startTime;
  const oob = pattern.filter(n => typeof n === 'number' && (n < noteRange.min || n > noteRange.max)).length;
  if (typeof options.log === 'function') options.log({ loopId: options.loopId ?? null, patternType: 'scale', length, range: { min: noteRange.min, max: noteRange.max }, baseNote, density, direction: dir, tailSize: ts, movesGenerated: seqObj.steps.length, oob, timeMs: Number(elapsed.toFixed(1)) });
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
  const startTime = performance.now()
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    DEBUG && console.log('generateRandomPattern failed: no possible notes in range')
    return new Array(length).fill(null)
  }

  // Compute positions based on density using random timing mode
  const positions = computePositions({ length, density, mode: options.timing ?? 'random', startOffset: options.startOffset ?? 0, allowZero: true })
  const noteCount = positions.length

  // Select notes to place, evenly distributed across the available range
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const notesToPlace = []
  if (noteCount <= sortedNotes.length) {
    // Pick evenly spaced notes across the range
    for (let i = 0; i < noteCount; i++) {
      const index = Math.floor(i * sortedNotes.length / Math.max(1, noteCount))
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    // Cycle through all notes to ensure full range coverage even with repeats
    for (let i = 0; i < noteCount; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }

  const pattern = new Array(length).fill(null)
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = notesToPlace[i]
  }

  const elapsed = performance.now() - startTime
  DEBUG && console.log(`generateRandomPattern steps=${length} notes=${noteCount} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`)

  DEBUG && console.log(pattern)
  return pattern
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

/**
 * Compute positions (indices) for note placement based on mode and density
 * mode: 'euclidean' | 'even' | 'random' | 'fillAll'
 * allowZero: when true, density==0 yields zero positions instead of forcing 1
 */
function computePositions({ length, density, mode = 'euclidean', startOffset = 0, allowZero = false }) {
  const positions = [];
  const d = Math.max(0, Math.min(1, typeof density === 'number' && !isNaN(density) ? density : 0));

  if (mode === 'fillAll') {
    // full unit-step bounce (same as existing behaviour)
    let pos = startOffset % length;
    let dir = 1;
    const min = 0;
    const max = length - 1;
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
    return positions;
  }

  // Compute count based on density. Use Math.round for more intuitive mapping but allow zero.
  let count = Math.round(length * d);
  if (!allowZero) count = Math.max(1, count);

  if (count <= 0) return [];

  if (mode === 'even') {
    for (let i = 0; i < count; i++) {
      positions.push(Math.floor((i * length) / count));
    }
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'random') {
    const set = new Set();
    while (set.size < count) set.add(Math.floor(Math.random() * length));
    return Array.from(set).map(p => (p + startOffset) % length);
  }

  // default: euclidean
  const raw = euclideanRhythm(count, length);
  return raw.map(p => (p + startOffset) % length);
}

export function generateHeadTailScaleSequence({ scaleNotes, startIndex, moves, direction, tailSize }) {
  const arr = Array.isArray(scaleNotes) ? scaleNotes.slice().sort((a, b) => a - b) : [];
  const n = arr.length;
  if (n === 0) return { sequence: [], steps: [], direction: 'ascending', tailSize: 1 };
  const dir = direction === 'descending' ? 'descending' : (direction === 'ascending' ? 'ascending' : (Math.random() < 0.5 ? 'ascending' : 'descending'));
  const ts = typeof tailSize === 'number' && isFinite(tailSize) ? Math.max(1, Math.min(4, Math.floor(tailSize))) : (1 + Math.floor(Math.random() * 4));
  let head = Math.max(0, Math.min(n - 1, Math.floor(startIndex ?? 0)));
  let remaining = Math.max(0, Math.floor(moves ?? 0));
  const seq = [];
  const steps = [];
  while (remaining > 0) {
    const maxJ = computeMaxJump(n, head, dir, ts);
    if (maxJ < 1) break;
    const j = 1 + Math.floor(Math.random() * maxJ);
    head = dir === 'ascending' ? head + j : head - j;
    const headNote = arr[head];
    seq.push(headNote);
    const tail = [];
    for (let k = 1; k <= ts; k++) {
      const ti = dir === 'ascending' ? head - j * k : head + j * k;
      if (ti < 0 || ti >= n) break;
      tail.push({ index: ti, note: arr[ti], jump: dir === 'ascending' ? -j : j });
      seq.push(arr[ti]);
    }
    steps.push({ headIndex: head, headJump: dir === 'ascending' ? j : -j, tail });
    remaining--;
  }
  return { sequence: seq, steps, direction: dir, tailSize: ts };
}

function computeMaxJump(n, headIdx, dir, ts) {
  if (dir === 'ascending') {
    const headBound = (n - 1) - headIdx;
    if (ts <= 1) return Math.max(0, headBound);
    const tailBound = Math.floor(headIdx / (ts - 1));
    return Math.max(0, Math.min(headBound, tailBound));
  } else {
    const headBound = headIdx;
    if (ts <= 1) return Math.max(0, headBound);
    const tailBound = Math.floor(((n - 1) - headIdx) / (ts - 1));
    return Math.max(0, Math.min(headBound, tailBound));
  }
}
