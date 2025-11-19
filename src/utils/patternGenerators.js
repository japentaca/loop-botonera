/**
 * Pattern Generation Module
 * Loop-aware generators that fetch parameters from the central store
 * All functions return arrays of MIDI note numbers or null (for rests)
 */
import { useAudioStore } from '../stores/audioStore.js'
import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { useScales } from '../composables/useMusic.js'
import { generatePossibleNotes } from './noteUtils.js'
// Global debug flag: set window.__LOOP_DEBUG = true in the browser console or in
// `index.html` to enable debug logs at runtime. For builds you can also set
// `VITE_LOOP_DEBUG=true` in a `.env` file so `import.meta.env.VITE_LOOP_DEBUG` is
// available at build time.
const DEBUG = (typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)) || (typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_LOOP_DEBUG) === 'true')

// Generators should be agnostic to the global pulse: they just produce
// note arrays. Start offset/alignment must be handled by the caller.

/**
 * Generate Euclidean rhythm pattern using Bjorklund's algorithm
 *
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
  // No pulse-dependent offsets: generators only return arrays of notes.
  const startOffset = typeof options.startOffset === 'number' ? options.startOffset : 0
  const sel1 = chooseTimingAndJitter(loopId, length, density, options)
  // For the Euclidean generator, force the algorithm to use euclidean mode
  const timing = 'euclidean'
  const jitter = sel1.jitter ?? 0
  const seed1 = stableHash(String(loopId) + ':' + String(length) + ':' + String(Math.floor(performance.now())))

  const positions = computePositions({ length, density, mode: 'euclidean', startOffset, allowZero: true, jitter, seed: seed1 })
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange, { tag: 'PatternGen' })
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

 *
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
  // Generators are pulse-agnostic: they return note arrays without alignment.
  const startOffset = typeof options.startOffset === 'number' ? options.startOffset : 0
  const sel2 = chooseTimingAndJitter(loopId, length, density, options)
  const timingMode = options.densityTiming ?? (sel2.timingMode ?? 'even')
  const jitter2 = sel2.jitter ?? 0
  const seed2 = stableHash(String(loopId) + ':' + String(length) + ':' + String(Math.floor(performance.now())))

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange, { tag: 'PatternGen' })
  if (possibleNotes.length === 0) {
    return new Array(length).fill(null)
  }
  const sortedNotes = [...possibleNotes]
  const it = timingIterator({ length, density, mode: timingMode, startOffset, allowZero: true, jitter: jitter2, seed: seed2 })
  const allow = new Set()
  for (const p of it) allow.add(p)
  const placements = allow.size
  if (placements === 0) return new Array(length).fill(null)

  const seqGen = generateHeadTailScaleSequence({
    scaleNotes: sortedNotes,
    startIndex: Math.floor(Math.random() * Math.max(1, sortedNotes.length)),
    moves: length,
    direction: options.direction,
    tailSize: options.tailSize
  })
  const seq = Array.isArray(seqGen.sequence) ? seqGen.sequence : []
  const skeleton = new Array(length).fill(null)
  for (let i = 0; i < length; i++) {
    let note = seq[i % Math.max(1, seq.length)]
    if (typeof note !== 'number') note = sortedNotes[i % Math.max(1, sortedNotes.length)]
    if (i > 0 && note === skeleton[i - 1] && sortedNotes.length > 1) {
      const altIdx = (sortedNotes.indexOf(note) + 1) % sortedNotes.length
      note = sortedNotes[altIdx]
    }
    skeleton[i] = note
  }

  const pattern = new Array(length).fill(null)
  for (let i = 0; i < length; i++) {
    if (allow.has(i)) pattern[i] = skeleton[i]
  }

  const elapsed = performance.now() - startTime
  const oob = pattern.filter(n => typeof n === 'number' && (n < noteRange.min || n > noteRange.max)).length
  if (typeof options.log === 'function') options.log({ loopId, patternType: 'scale', length, range: { min: noteRange.min, max: noteRange.max }, baseNote, density, placements, oob, timeMs: Number(elapsed.toFixed(1)) })
  return pattern
}

/**
 * Generate enhanced random pattern (improved version of current random generation)
 *
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
  const startOffset = typeof options.startOffset === 'number' ? options.startOffset : 0

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange, { tag: 'PatternGen' })
  if (possibleNotes.length === 0) {
    DEBUG && console.log('generateRandomPattern failed: no possible notes in range')
    return new Array(length).fill(null)
  }

  const sel3 = chooseTimingAndJitter(loopId, length, density, options)
  const mode3 = sel3.timingMode ?? (options.timing ?? 'random')
  const jitter3 = sel3.jitter ?? 0
  const seed3 = stableHash(String(loopId) + ':' + String(length) + ':' + String(Math.floor(performance.now())))
  const positions = computePositions({ length, density, mode: mode3, startOffset, allowZero: true, jitter: jitter3, seed: seed3 })
  const noteCount = positions.length
  const sortedNotes = [...possibleNotes]
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
 *
 * @returns {Array<number>} Array of valid MIDI notes
 */
// generatePossibleNotes is now provided by src/utils/noteUtils.js

/**
 * Generate Euclidean rhythm using Bjorklund's algorithm
 *
 * @returns {Array<number>} Array of positions where pulses occur
 */
function euclideanRhythm(pulses, steps) {
  if (pulses <= 0) return [];
  if (pulses >= steps) {
    return Array.from({ length: steps }, (_, i) => i);
  }

  // Simple working implementation
  let positions = [];
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
 * Jitter: when `jitter` is > 0, some modes (even/euclidean/default) apply
 * small position perturbations to avoid deterministic spacing. Jitter is
 * seeded by `seed` to produce deterministic randomness when needed.
 * allowZero: when true, density==0 yields zero positions instead of forcing 1
 */
function computePositions({ length, density, mode = 'even', startOffset = 0, allowZero = false, jitter = 0, seed }) {
  let positions = [];
  const d = Math.max(0, Math.min(1, typeof density === 'number' && !isNaN(density) ? density : 0));
  const rng = createRng(seed);

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
    if (jitter && jitter > 0) {
      positions = applyJitterToPositions(positions, jitter, rng, length)
    }
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'euclidean') {
    // Use pulses based on density
    const pulses = Math.round(length * d);
    if (pulses <= 0) return [];
    let epos = euclideanRhythm(pulses, length);
    if (jitter && jitter > 0) epos = applyJitterToPositions(epos, jitter, rng, length);
    return epos.map(p => (p + startOffset) % length);
  }

  if (mode === 'random') {
    const set = new Set();
    while (set.size < count) set.add(Math.floor((rng() || Math.random()) * length));
    return Array.from(set).map(p => (p + startOffset) % length);
  }

  if (mode === 'bernoulli') {
    for (let i = 0; i < length; i++) {
      if ((rng() || Math.random()) < d) positions.push(i);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'poisson') {
    const lambda = Math.max(1e-6, d);
    let t = 0;
    while (t < length) {
      const u = rng() || Math.random();
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
      const u = rng() || Math.random();
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
        if ((rng() || Math.random()) < d) state = 1; else state = 0;
      } else {
        if ((rng() || Math.random()) < (1 - d)) state = 0; else state = 1;
      }
      if (state === 1) positions.push(i);
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  if (mode === 'organic') {
    let budget = Math.max(0, Math.round(length * d));
    if (!allowZero) budget = Math.max(1, budget);
    let pcur = d;
    let gap = 3;
    for (let i = 0; i < length; i++) {
      const noise = ((rng() || Math.random()) - 0.5) * 0.25;
      const bias = gap >= 2 ? 0.12 : -0.12;
      pcur = Math.max(0, Math.min(1, pcur + (d - pcur) * 0.35 + noise + bias));
      const hit = ((rng() || Math.random()) < pcur) && budget > 0;
      if (hit) {
        positions.push(i);
        budget--;
        gap = 0;
      } else {
        gap++;
      }
    }
    if (positions.length === 0 && !allowZero && length > 0) positions.push(startOffset % length);
    return positions.map(p => (p + startOffset) % length);
  }

  // default: even
  const raw = [];
  for (let i = 0; i < count; i++) {
    raw.push(Math.floor((i * length) / count));
  }
  if (jitter && jitter > 0) {
    positions = applyJitterToPositions(raw, jitter, rng, length)
    return positions.map(p => (p + startOffset) % length);
  }
  return raw.map(p => (p + startOffset) % length);
}

function* timingIterator({ length, density, mode, startOffset, allowZero, jitter, seed }) {
  const pos = computePositions({ length, density, mode, startOffset, allowZero, jitter, seed })
  for (let i = 0; i < pos.length; i++) yield pos[i]
}

/**
 * Apply jitter to a set of integer positions (0..length-1). Ensures unique positions
 * by attempting random jittered candidate picks and falling back to closest available
 * indices when collisions persist.
 */
function applyJitterToPositions(positions, jitter, rng, length) {
  if (!Array.isArray(positions) || positions.length === 0) return [];
  const maxJ = Math.max(0, Math.floor(Math.min(jitter, Math.floor(length / 2))));
  if (maxJ <= 0) return positions.slice();
  const out = [];
  const used = new Set();
  for (let p of positions) {
    let candidate = p;
    let tries = 0;
    const maxTries = 12;
    while (tries < maxTries) {
      const offset = Math.floor(((rng() || Math.random()) * (2 * maxJ + 1)) - maxJ);
      let r = p + offset;
      if (r < 0) r = 0;
      if (r >= length) r = length - 1;
      if (!used.has(r)) { candidate = r; break; }
      tries++;
    }
    if (used.has(candidate)) {
      // fallback: pick nearest free slot scanning outwards
      let found = -1;
      for (let d = 1; d < length; d++) {
        const c1 = candidate - d;
        const c2 = candidate + d;
        if (c1 >= 0 && !used.has(c1)) { found = c1; break; }
        if (c2 < length && !used.has(c2)) { found = c2; break; }
      }
      if (found >= 0) candidate = found; else candidate = candidate; // keep original if nowhere else
    }
    used.add(candidate);
    out.push(candidate);
  }
  // Keep original order but dedup and sort
  return out.sort((a, b) => a - b);
}


function createRng(seed) {
  if (typeof seed !== 'number' || !isFinite(seed)) return () => Math.random()
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
    const modes = ['organic', 'bernoulli', 'poisson', 'geometric', 'markov', 'random']
    mode = modes[Math.floor(Math.random() * modes.length)]
  }
  if (typeof j !== 'number' || isNaN(j)) {
    // Make jitter scale with the length and inversely with density; sparse patterns
    // get slightly more jitter to avoid sounding too robotic.
    const baseMax = Math.max(0, Math.floor(length / 6))
    const densityScale = typeof density === 'number' && !isNaN(density) ? (1 + (1 - Math.max(0, Math.min(1, density))) * 0.6) : 1
    const maxJ = Math.max(0, Math.floor(baseMax * densityScale))
    j = maxJ > 0 ? Math.floor(Math.random() * (maxJ + 1)) : 0
  }
  return { timingMode: mode, jitter: j }
}

export function generateHeadTailScaleSequence({ scaleNotes, startIndex, moves, direction, tailSize }) {
  // do not sort here; `scaleNotes` should already be sorted by the caller
  const arr = Array.isArray(scaleNotes) ? scaleNotes.slice() : [];
  const n = arr.length;
  if (n === 0) return { sequence: [], steps: [], direction: 'ascending', tailSize: 1 };
  // We need to be able to change the direction (bounce) as the head hits
  // the boundaries so that the head can travel across the full set of notes.
  let dir = direction === 'descending' ? 'descending' : (direction === 'ascending' ? 'ascending' : (Math.random() < 0.5 ? 'ascending' : 'descending'));
  const ts = typeof tailSize === 'number' && isFinite(tailSize) ? Math.max(1, Math.min(4, Math.floor(tailSize))) : (1 + Math.floor(Math.random() * 4));
  let head = Math.max(0, Math.min(n - 1, Math.floor(startIndex ?? 0)));
  let remaining = Math.max(0, Math.floor(moves ?? 0));
  const seq = [];
  const steps = [];
  while (remaining > 0) {
    let { minJ, maxJ } = computeMaxJump(n, head, dir, ts);
    if (maxJ < 1) {
      // We're at the boundary: flip direction but keep head at the boundary so
      // the boundary note itself can be used as a head position before moving.
      if (dir === 'ascending' && head >= n - 1) {
        dir = 'descending';
        // keep head at n - 1, so the boundary is included
      } else if (dir === 'descending' && head <= 0) {
        dir = 'ascending';
        // keep head at 0
      }
      ({ minJ, maxJ } = computeMaxJump(n, head, dir, ts));
      if (maxJ < 1) break;
    }
    // If the min allowed jump is greater than max (can't fit full tail),
    // fall back to allowing any jump available (1..maxJ), which will produce
    // truncated tails in that case.
    const effectiveMin = (minJ && minJ > 1) ? minJ : 1;
    const effectiveMax = Math.max(0, maxJ);
    if (effectiveMax < effectiveMin) {
      // no full-tail-safe jump available; allow any smaller jump
      if (effectiveMax < 1) break;
      const j1 = 1 + Math.floor(Math.random() * effectiveMax);
      var j = j1;
    } else {
      const range = effectiveMax - effectiveMin + 1;
      const j2 = effectiveMin + Math.floor(Math.random() * range);
      var j = j2;
    }
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
      const ti = dir === 'ascending' ? head - k : head + k;
      if (ti < 0 || ti >= n) break;
      const tailNote = arr[ti];
      tail.push({ index: ti, note: tailNote, jump: dir === 'ascending' ? -1 : 1 });
      // Tail should just follow the head directly (no duplicate avoidance)
      seq.push(tailNote);
    }
    steps.push({ headIndex: head, headJump: dir === 'ascending' ? j : -j, tail });
    remaining--;
  }
  return { sequence: seq, steps, direction: dir, tailSize: ts };
}

function computeMaxJump(n, headIdx, dir, ts) {
  // Returns an object with minJ and maxJ that are safe bounds for the head
  // to jump while allowing a full tail of size `ts` to exist.
  const tail = typeof ts === 'number' && isFinite(ts) ? Math.max(0, Math.floor(ts)) : 0;
  if (dir === 'ascending') {
    const maxByBounds = Math.max(0, (n - 1) - headIdx);
    // Ensure newHead - tail >= 0 => head + j >= tail => j >= tail - head
    const minByTail = Math.max(1, tail - headIdx);
    return { minJ: minByTail, maxJ: maxByBounds };
  } else {
    const maxByBounds = Math.max(0, headIdx);
    // Ensure newHead + tail <= n - 1 => head - j + tail <= n - 1 => j >= head + tail - (n - 1)
    const minByTail = Math.max(1, headIdx + tail - (n - 1));
    return { minJ: minByTail, maxJ: maxByBounds };
  }
}
