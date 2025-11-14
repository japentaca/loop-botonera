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
  console.log(`generateEuclideanPattern steps=${length} pulses=${pulses} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

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
    console.log('generateScalePattern failed: no possible notes in range');
    return new Array(length).fill(null);
  }

  // Sort notes so stepping is predictable
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);

  // Compute placement positions using randomized spacing (honours density)
  const positions = computePositions({ length, density, mode: 'random', startOffset: options.startOffset ?? 0, allowZero: true });
  console.log(`generateScalePattern using randomized positions density=${density}`);
  const placements = positions.length;
  if (placements === 0) return new Array(length).fill(null);

  // Choose a lead note index randomly
  let leadIdx = Math.floor(Math.random() * sortedNotes.length);
  const leadNote = sortedNotes[leadIdx];


  // Determine tail length at start and reuse it for the whole sequence
  const maxTail = typeof options.maxTail === 'number' && isFinite(options.maxTail) ? Math.max(0, Math.floor(options.maxTail)) : 5;
  const tailLength = (typeof options.tailLength === 'number' && isFinite(options.tailLength))
    ? Math.max(0, Math.min(options.tailLength, maxTail))
    : Math.floor(Math.random() * (maxTail + 1)); // chosen once at start

  // Determine tail direction: 'up' | 'down' | 'random' (default random)
  let dir = options.direction ?? 'random';
  if (dir === 'random') dir = Math.random() < 0.5 ? 'up' : 'down';
  const step = dir === 'up' ? 1 : -1;
  // Log chosen tail parameters for debugging
  console.log(`generateScalePattern chosen tailLength=${tailLength} direction=${dir} leadIdx=${leadIdx} leadNote=${leadNote}`);

  // Build a full-length scale stream (one note per step) so density only controls placement
  // and does not truncate or mute the generated scale. We'll generate notes until we
  // have 'length' notes and then place them into the pattern at the positions selected by density.
  const seqFull = [];
  if (sortedNotes.length === 1) {
    while (seqFull.length < length) seqFull.push(sortedNotes[0]);
  } else {
    let currLead = leadIdx;
    let currStep = step; // will bounce at extremes

    while (seqFull.length < length) {
      // Add lead
      seqFull.push(sortedNotes[currLead]);
      if (seqFull.length >= length) break;

      // Add tails using cumulative stepping from the lead (lead-1, lead-2, ... for down)
      for (let t = 1; t <= tailLength && seqFull.length < length; t++) {
        const tailIdx = currLead + currStep * t;
        if (tailIdx < 0 || tailIdx >= sortedNotes.length) break; // stop tails at boundary
        seqFull.push(sortedNotes[tailIdx]);
      }

      // Advance lead index by one step so successive groups overlap as in your example
      let nextLead = currLead + currStep;
      if (nextLead < 0 || nextLead >= sortedNotes.length) {
        // reverse direction at boundaries
        currStep = -currStep;
        nextLead = currLead + currStep;
        if (nextLead < 0) nextLead = 0;
        if (nextLead >= sortedNotes.length) nextLead = sortedNotes.length - 1;
      }
      currLead = nextLead;
    }
  }

  // Build the pattern: place notes from the full scale stream into selected positions
  const pattern = new Array(length).fill(null);
  const posSet = new Set(positions);
  for (let i = 0; i < length; i++) {
    if (posSet.has(i)) {
      pattern[i] = seqFull[i];
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(`generateScalePattern simplified lead=${leadNote} tail=${tailLength} dir=${dir} placements=${placements} time=${elapsed.toFixed(1)}ms`);
  // Print full pattern so it can be copied for inspection
  // Randomly shift the final pattern left or right by 0..length-1 steps
  const shiftAmount = Math.floor(Math.random() * length);
  if (shiftAmount > 0) {
    const shiftDir = Math.random() < 0.5 ? 'left' : 'right';
    if (shiftDir === 'left') {
      const shifted = pattern.slice(shiftAmount).concat(pattern.slice(0, shiftAmount));
      console.log(`Shifted left by ${shiftAmount} steps`);
      console.log(shifted);
      return shifted;
    } else {
      const shifted = pattern.slice(-shiftAmount).concat(pattern.slice(0, -shiftAmount));
      console.log(`Shifted right by ${shiftAmount} steps`);
      console.log(shifted);
      return shifted;
    }
  }

  console.log(pattern);
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
    console.log('generateRandomPattern failed: no possible notes in range')
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
  console.log(`generateRandomPattern steps=${length} notes=${noteCount} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`)

  console.log(pattern)
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
