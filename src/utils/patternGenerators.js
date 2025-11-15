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

  // keep density handling for compatibility
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);
  if (possibleNotes.length === 0) {
    DEBUG && console.log('generateScalePattern failed: no possible notes in range');
    return new Array(length).fill(null);
  }

  // Sort notes so stepping is predictable
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);
  const timingMode = options.densityTiming ?? 'random';
  const positions = computePositions({ length, density, mode: timingMode, startOffset: options.startOffset ?? 0, allowZero: true });
  const placements = positions.length;
  if (placements === 0) return new Array(length).fill(null);
  const override = (typeof window !== 'undefined' && window.__DBG && window.__DBG.__genParams) ? window.__DBG.__genParams : null;
  const mid = Math.floor(sortedNotes.length / 2);
  const hasOverrideBias = typeof override?.centerBias === 'number' && isFinite(override.centerBias);
  const bias = hasOverrideBias ? Math.max(-0.6, Math.min(0.6, override.centerBias)) : null;
  let leadIdx = hasOverrideBias
    ? Math.max(0, Math.min(sortedNotes.length - 1, mid + Math.round(bias * Math.floor(sortedNotes.length / 2))))
    : Math.floor(Math.random() * sortedNotes.length);
  const maxTail = typeof options.maxTail === 'number' && isFinite(options.maxTail) ? Math.max(0, Math.floor(options.maxTail)) : 5;
  const tailLength = typeof override?.tailLength === 'number' && isFinite(override.tailLength)
    ? Math.max(0, Math.min(override.tailLength, maxTail))
    : Math.max(3, Math.floor(Math.random() * (maxTail + 1)));
  const directionMode = (override?.directionMode === 'alternate' || override?.directionMode === 'random')
    ? override.directionMode
    : 'random';
  const leadAdvance = typeof override?.leadAdvance === 'number' && isFinite(override.leadAdvance)
    ? Math.max(1, Math.min(2, Math.floor(override.leadAdvance)))
    : 2;

  // Build a full-length scale stream (one note per step) so density only controls placement
  // and does not truncate or mute the generated scale. We'll generate notes until we
  // have 'length' notes and then place them into the pattern at the positions selected by density.
  const seqFull = [];
  if (sortedNotes.length === 1) {
    while (seqFull.length < length) seqFull.push(sortedNotes[0]);
  } else {
    let currLead = leadIdx;
    let currStep = Math.random() < 0.5 ? 1 : -1;
    let cycles = 0;

    while (seqFull.length < length) {
      seqFull.push(sortedNotes[currLead]);
      for (let t = 1; t <= tailLength && seqFull.length < length; t++) {
        const tailIdx = currLead + currStep * t;
        if (tailIdx < 0 || tailIdx >= sortedNotes.length) break;
        seqFull.push(sortedNotes[tailIdx]);
      }
      let nextLead = currLead + currStep * leadAdvance;
      if (nextLead < 0 || nextLead >= sortedNotes.length) {
        currStep = -currStep;
        nextLead = currLead + currStep * leadAdvance;
        if (nextLead < 0) nextLead = 0;
        if (nextLead >= sortedNotes.length) nextLead = sortedNotes.length - 1;
      }
      currLead = nextLead;
      cycles++;
      if (directionMode === 'random') {
        if (Math.random() < 0.1) currStep = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }

  const pattern = new Array(length).fill(null);
  const mapping = options.positionMapping ?? 'sequential';
  if (mapping === 'sequential') {
    const sortedPos = [...positions].sort((a, b) => a - b);
    for (let k = 0; k < sortedPos.length; k++) {
      const idx = Math.floor((k * seqFull.length) / sortedPos.length);
      pattern[sortedPos[k]] = seqFull[idx];
    }
  } else {
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      pattern[pos] = seqFull[pos % seqFull.length];
    }
  }

  const distinctPlaced = new Set(pattern.filter(n => typeof n === 'number'));
  const minDistinct = Math.max(5, Math.ceil(placements / 4));
  if (distinctPlaced.size < minDistinct) {
    const forcedTail = maxTail;
    const forcedAdvance = 2;
    const sortedPos = [...positions].sort((a, b) => a - b);
    const seq2 = [];
    let p = leadIdx;
    let d = Math.random() < 0.5 ? 1 : -1;
    while (seq2.length < length) {
      seq2.push(sortedNotes[p]);
      for (let t = 1; t <= forcedTail && seq2.length < length; t++) {
        const ti = p + d * t;
        if (ti < 0 || ti >= sortedNotes.length) break;
        seq2.push(sortedNotes[ti]);
      }
      let nx = p + d * forcedAdvance;
      if (nx < 0 || nx >= sortedNotes.length) {
        d = -d;
        nx = p + d * forcedAdvance;
        if (nx < 0) nx = 0;
        if (nx >= sortedNotes.length) nx = sortedNotes.length - 1;
      }
      p = nx;
    }
    for (let k = 0; k < sortedPos.length; k++) {
      const idx = Math.floor((k * seq2.length) / sortedPos.length);
      pattern[sortedPos[k]] = seq2[idx];
    }
  }

  const elapsed = performance.now() - startTime;
  const info = {
    loopId: options.loopId ?? null,
    patternType: 'scale',
    length,
    range: { min: noteRange.min, max: noteRange.max },
    baseNote,
    density,
    tailLength,
    directionMode,
    leadAdvance,
    centerBias: bias,
  };
  const oob = pattern.filter(n => typeof n === 'number' && (n < noteRange.min || n > noteRange.max)).length;
  if (typeof options.log === 'function') options.log({ ...info, oob });
  if (typeof window !== 'undefined' && window.__LOOP_DEBUG) {
    const preview = seqFull.slice(0, Math.min(16, seqFull.length));
    console.log('[ScaleGen Preview]', preview);
  }
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
