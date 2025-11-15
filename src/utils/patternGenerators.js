/**
 * Pattern Generation Module
 * Loop-aware generators that fetch parameters from the central store
 * All functions return arrays of MIDI note numbers or null (for rests)
 */
import { useAudioStore } from '../stores/audioStore'
import { useNotesMatrix } from '../composables/useNotesMatrix'
import { useScales } from '../composables/useMusic'
const DEBUG = typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)

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
export function generateEuclideanPattern(loopId, options = {}) {
  const startTime = performance.now()
  const notesMatrix = useNotesMatrix()
  const audioStore = useAudioStore()
  const { getScale } = useScales()

  const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loopId]
  if (!meta || typeof meta.length !== 'number' || meta.length <= 0) {
    return []
  }

  const length = meta.length
  const scale = getScale(audioStore.currentScale)
  const baseNote = meta.baseNote
  const noteRange = { min: meta.noteRangeMin, max: meta.noteRangeMax }
  const density = notesMatrix.getEffectiveDensity ? notesMatrix.getEffectiveDensity(loopId) : (typeof meta.density === 'number' ? meta.density : 0.3)
  const currentPulse = audioStore.currentPulse && typeof audioStore.currentPulse.value === 'number' ? audioStore.currentPulse.value : 0
  const startOffset = options.startOffset ?? (meta.startOffset ?? (length > 0 ? (currentPulse % length) : 0))
  const sel1 = chooseTimingAndJitter(loopId, length, density, options)
  const timing = sel1.timingMode ?? 'euclidean'
  const jitter = sel1.jitter ?? 0

  const positions = computePositions({ length, density, mode: timing, startOffset, allowZero: true, jitter })
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  possibleNotes.sort((a, b) => a - b)
  const pattern = new Array(length).fill(null)

  if (possibleNotes.length > 0 && positions.length > 0) {
    let currentIndex = Math.floor(Math.random() * possibleNotes.length)
    positions.forEach(pos => {
      pattern[pos] = possibleNotes[currentIndex]
      currentIndex = (currentIndex + Math.floor(Math.random() * 3) + 1) % possibleNotes.length
    })
  }

  const elapsed = performance.now() - startTime
  const pulses = positions.length
  DEBUG && console.log(`generateEuclideanPattern loop=${loopId} steps=${length} pulses=${pulses} density=${Number(density).toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`)
  return pattern
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
export function generateScalePattern(loopId, options = {}) {
  const startTime = performance.now()
  const notesMatrix = useNotesMatrix()
  const audioStore = useAudioStore()
  const { getScale } = useScales()

  const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loopId]
  if (!meta || typeof meta.length !== 'number' || meta.length <= 0) {
    return []
  }
  const length = meta.length
  const scale = getScale(audioStore.currentScale)
  const baseNote = meta.baseNote
  const noteRange = { min: meta.noteRangeMin, max: meta.noteRangeMax }
  const density = notesMatrix.getEffectiveDensity ? notesMatrix.getEffectiveDensity(loopId) : (typeof meta.density === 'number' ? meta.density : 0.3)
  const currentPulse = audioStore.currentPulse && typeof audioStore.currentPulse.value === 'number' ? audioStore.currentPulse.value : 0
  const startOffset = options.startOffset ?? (meta.startOffset ?? (length > 0 ? (currentPulse % length) : 0))
  const sel2 = chooseTimingAndJitter(loopId, length, density, options)
  const timingMode = options.densityTiming ?? (sel2.timingMode ?? 'even')
  const jitter2 = sel2.jitter ?? 0

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    return new Array(length).fill(null)
  }
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const positions = computePositions({ length, density, mode: timingMode, startOffset, allowZero: true, jitter: jitter2 })
  const placements = positions.length
  if (placements === 0) return new Array(length).fill(null)

  const pattern = new Array(length).fill(null)
  const notesToPlace = []
  if (placements <= sortedNotes.length) {
    for (let i = 0; i < placements; i++) {
      const index = Math.floor(i * sortedNotes.length / Math.max(1, placements))
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    for (let i = 0; i < placements; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }

  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = notesToPlace[i]
  }

  const elapsed = performance.now() - startTime
  const oob = pattern.filter(n => typeof n === 'number' && (n < noteRange.min || n > noteRange.max)).length
  if (typeof options.log === 'function') options.log({ loopId, patternType: 'scale', length, range: { min: noteRange.min, max: noteRange.max }, baseNote, density, placements, oob, timeMs: Number(elapsed.toFixed(1)) })
  return pattern
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
export function generateRandomPattern(loopId, options = {}) {
  const startTime = performance.now()
  const notesMatrix = useNotesMatrix()
  const audioStore = useAudioStore()
  const { getScale } = useScales()

  const meta = notesMatrix.loopMetadata && notesMatrix.loopMetadata[loopId]
  if (!meta || typeof meta.length !== 'number' || meta.length <= 0) {
    return []
  }

  const length = meta.length
  const scale = getScale(audioStore.currentScale)
  const baseNote = meta.baseNote
  const noteRange = { min: meta.noteRangeMin, max: meta.noteRangeMax }
  const density = notesMatrix.getEffectiveDensity ? notesMatrix.getEffectiveDensity(loopId) : (typeof meta.density === 'number' ? meta.density : 0.3)
  const currentPulse = audioStore.currentPulse && typeof audioStore.currentPulse.value === 'number' ? audioStore.currentPulse.value : 0
  const startOffset = options.startOffset ?? (meta.startOffset ?? (length > 0 ? (currentPulse % length) : 0))

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    DEBUG && console.log('generateRandomPattern failed: no possible notes in range')
    return new Array(length).fill(null)
  }

  const sel3 = chooseTimingAndJitter(loopId, length, density, options)
  const mode3 = sel3.timingMode ?? (options.timing ?? 'random')
  const jitter3 = sel3.jitter ?? 0
  const positions = computePositions({ length, density, mode: mode3, startOffset, allowZero: true, jitter: jitter3 })
  const noteCount = positions.length
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const notesToPlace = []
  if (noteCount <= sortedNotes.length) {
    for (let i = 0; i < noteCount; i++) {
      const index = Math.floor(i * sortedNotes.length / Math.max(1, noteCount))
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    for (let i = 0; i < noteCount; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }

  const pattern = new Array(length).fill(null)
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = notesToPlace[i]
  }

  const elapsed = performance.now() - startTime
  DEBUG && console.log(`generateRandomPattern loop=${loopId} steps=${length} notes=${noteCount} density=${Number(density).toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`)
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
function computePositions({ length, density, mode = 'euclidean', startOffset = 0, allowZero = false, jitter = 0 }) {
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

  if (mode === 'bernoulli') {
    for (let i = 0; i < length; i++) {
      if (Math.random() < d) positions.push(i);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'poisson') {
    const lambda = Math.max(1e-6, d);
    let t = 0;
    while (t < length) {
      const u = Math.random();
      const gap = Math.max(0, Math.floor(-Math.log(1 - u) / lambda));
      t += gap + 1;
      if (t < length) positions.push(t);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'geometric') {
    const p = Math.max(1e-6, d);
    let t = 0;
    while (t < length) {
      const u = Math.random();
      const gap = Math.max(0, Math.floor(Math.log(1 - u) / Math.log(1 - p)));
      t += gap + 1;
      if (t < length) positions.push(t);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'markov') {
    let state = 0;
    for (let i = 0; i < length; i++) {
      if (state === 0) {
        if (Math.random() < d) state = 1; else state = 0;
      } else {
        if (Math.random() < (1 - d)) state = 0; else state = 1;
      }
      if (state === 1) positions.push(i);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  // default: euclidean
  const raw = euclideanRhythm(count, length);
  if (jitter && jitter > 0) {
    const j = Math.floor(jitter);
    for (let i = 0; i < raw.length; i++) {
      const r = (raw[i] + (Math.floor(Math.random() * (2 * j + 1)) - j)) % length;
      const rp = r < 0 ? r + length : r;
      positions.push(rp);
    }
    return positions.map(p => (p + startOffset) % length);
  }
  return raw.map(p => (p + startOffset) % length);
}

function stableHash(input) {
  const s = String(input ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

function chooseTimingAndJitter(loopId, length, density, options) {
  let mode = options.timing ?? options.densityTiming
  let j = options.jitter
  if (!mode) {
    const modes = ['random', 'bernoulli', 'poisson', 'geometric', 'markov', 'euclidean']
    mode = modes[Math.floor(Math.random() * modes.length)]
  }
  if (typeof j !== 'number' || isNaN(j)) {
    const maxJ = Math.max(0, Math.floor(length / 6))
    j = maxJ > 0 ? Math.floor(Math.random() * (maxJ + 1)) : 0
  }
  return { timingMode: mode, jitter: j }
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
    let headNote = arr[head];
    if (seq.length && headNote === seq[seq.length - 1]) {
      const altUp = head + (dir === 'ascending' ? 1 : -1);
      const altDown = head - (dir === 'ascending' ? 1 : -1);
      if (altUp >= 0 && altUp < n) headNote = arr[altUp];
      else if (altDown >= 0 && altDown < n) headNote = arr[altDown];
    }
    seq.push(headNote);
    const tail = [];
    for (let k = 1; k <= ts; k++) {
      const ti = dir === 'ascending' ? head - j * k : head + j * k;
      if (ti < 0 || ti >= n) break;
      const tailNote = arr[ti];
      tail.push({ index: ti, note: tailNote, jump: dir === 'ascending' ? -j : j });
      const nextNote = (seq.length && tailNote === seq[seq.length - 1])
        ? (ti + 1 < n ? arr[ti + 1] : (ti - 1 >= 0 ? arr[ti - 1] : tailNote))
        : tailNote;
      seq.push(nextNote);
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
