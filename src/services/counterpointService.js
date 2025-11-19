/**
 * Counterpoint Service
 * Implements simple counterpoint logic for melodic note avoidance across loops
 */

// Global kill-switch to temporarily disable counterpoint behavior
let COUNTERPOINT_ENABLED = false
export function setCounterpointEnabled(enabled) { COUNTERPOINT_ENABLED = !!enabled }
export function isCounterpointEnabled() { return COUNTERPOINT_ENABLED }

/**
 * Analyze active loops at a specific step to find occupied notes
 * @param {Array<Array<number|null>>} loopsArray - Array of loop note arrays
 * @param {number} currentStep - The step index to analyze
 * @returns {Set<number>} Set of occupied MIDI note numbers
 */
export function analyzeActiveLoops(loopsArray, currentStep) {
  // Early exit when counterpoint is disabled
  if (!COUNTERPOINT_ENABLED) {
    return new Set()
  }

  const occupiedNotes = new Set();

  for (let loopId = 0; loopId < loopsArray.length; loopId++) {
    const loopNotes = loopsArray[loopId];
    if (loopNotes && loopNotes[currentStep] !== null) {
      const note = loopNotes[currentStep];
      if (occupiedNotes.has(note)) {
        //console.log(`[MelGen] analyzeActiveLoops step=${currentStep} collision detected: note ${note} in multiple loops`);
      }
      occupiedNotes.add(note);
    }
  }

  //console.log(`[MelGen] analyzeActiveLoops step=${currentStep} occupied=${Array.from(occupiedNotes).sort().join(',') || 'none'}`);
  return occupiedNotes;
}

/**
 * analyzeActiveLoopsWithContext: return occupied notes and per-loop note mapping
 * returns { occupied: Set<number>, mapping: Map<loopId, note>, prevMapping: Map<loopId, prevNote> }
 */
export function analyzeActiveLoopsWithContext(loopsArray, currentStep) {
  if (!COUNTERPOINT_ENABLED) {
    return { occupied: new Set(), mapping: new Map(), prevMapping: new Map() }
  }

  const occupied = new Set()
  const mapping = new Map()
  const prevMapping = new Map()

  for (let loopId = 0; loopId < loopsArray.length; loopId++) {
    const arr = loopsArray[loopId]
    if (!arr) continue
    const curr = arr[currentStep]
    if (curr !== null && curr !== undefined) {
      mapping.set(loopId, curr)
      occupied.add(curr)
    }
    if (currentStep - 1 >= 0) {
      const prev = arr[currentStep - 1]
      if (prev !== null && prev !== undefined) prevMapping.set(loopId, prev)
    }
  }

  return { occupied, mapping, prevMapping }
}

/**
 * Avoid conflicts by finding an alternative note in the scale
 * @param {number} proposedNote - The originally proposed MIDI note
 * @param {Set<number>} occupiedNotes - Set of notes already occupied at this step
 * @param {Array<number>} scale - Scale intervals array
 * @param {Object} options - Additional options
 * @param {number} options.baseNote - Base note for scale calculations
 * @param {Object} options.noteRange - {min, max} MIDI range
 * @returns {number} Adjusted note (or original if no conflict)
 */
import { midiToNoteName, intervalLabelFromMidi, TonalLoaded } from './tonalService.js'

export function avoidConflicts(proposedNote, occupiedNotes, scale, options = {}) {
  // Bypass adjustments when counterpoint is disabled
  if (!COUNTERPOINT_ENABLED) {
    return proposedNote
  }

  // No conflict if note is not occupied and does not create perfect consonance with any mapping
  const { baseNote = 60, noteRange = { min: 24, max: 96 }, otherMapping = new Map(), otherPrevMapping = new Map(), prevOwn = null, currentStep = null } = options;
  if (!occupiedNotes.has(proposedNote) && !hasPerfectConsonanceWithAny(proposedNote, otherMapping)) {
    // debug: early return condition - both occupied and perfect checks failed
    return proposedNote
  }



  // Generate all possible notes in the scale within range
  const possibleNotes = generateScaleNotes(scale, baseNote, noteRange);

  // Find available alternatives, preferring notes close to the original
  const alternatives = possibleNotes.filter(note => !occupiedNotes.has(note));

  if (alternatives.length === 0) {
    console.log(`[MelGen] avoidConflicts note=${proposedNote} no alternatives available, keeping original`);
    return proposedNote; // No alternatives, keep original
  }

  // Score alternatives based on distance and counterpoint rules
  alternatives.sort((a, b) => {
    const scoreA = Math.abs(a - proposedNote) + scoreCounterpointViolation(a, proposedNote, otherMapping, otherPrevMapping, prevOwn)
    const scoreB = Math.abs(b - proposedNote) + scoreCounterpointViolation(b, proposedNote, otherMapping, otherPrevMapping, prevOwn)
    return scoreA - scoreB
  })

  const chosen = alternatives[0];
  console.log(`[MelGen] avoidConflicts note=${proposedNote} occupied, moved to ${chosen}`);
  return chosen;
}

/**
 * Check if proposed note forms a perfect consonance (P5/P8) with any note in mapping
 * mapping is a Map(loopId -> note)
 */
export function hasPerfectConsonanceWithAny(note, mapping) {
  if (!mapping || mapping.size === 0) return false
  for (const otherNote of mapping.values()) {
    if (isPerfectConsonance(note, otherNote)) return true
  }
  return false
}

// Counterpoint helpers
function semitoneClass(n1, n2) {
  return Math.abs(n1 - n2) % 12
}

function isPerfectConsonance(n1, n2) {
  // Prefer Tonal labels when available for robust interval naming
  if (TonalLoaded) {
    try { const label = intervalLabelFromMidi(n1, n2); if (isPerfectLabel(label)) return true } catch (e) { }
  }
  const sc = semitoneClass(n1, n2)
  // P8 (0 mod 12) and P5 (7 mod 12)
  return sc === 0 || sc === 7
}

function isPerfectLabel(label) {
  if (!label) return false
  const l = String(label).toUpperCase()
  return l.includes('P') && (l.includes('1') || l.includes('5') || l.includes('8'))
}

function sign(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0) }

function isParallelPerfect(prevA, currA, prevB, currB) {
  if (prevA == null || prevB == null) return false
  let wasPerfect = isPerfectConsonance(prevA, prevB)
  let isPerfect = isPerfectConsonance(currA, currB)
  // extra detection: if Tonal is loaded, check labels
  if (!wasPerfect && TonalLoaded) {
    try {
      const prevLabel = intervalLabelFromMidi(prevA, prevB)
      if (isPerfectLabel(prevLabel)) wasPerfect = true
    } catch (e) { }
  }
  if (!isPerfect && TonalLoaded) {
    try {
      const currLabel = intervalLabelFromMidi(currA, currB)
      if (isPerfectLabel(currLabel)) isPerfect = true
    } catch (e) { }
  }
  if (!wasPerfect || !isPerfect) return false
  const dirA = sign(currA - prevA)
  const dirB = sign(currB - prevB)
  return dirA !== 0 && dirA === dirB
}

function isHiddenDirectPerfect(prevA, currA, prevB, currB) {
  // Hidden direct perfects: approaching a perfect by similar motion where one voice leaps
  if (prevA == null || prevB == null) return false
  const isPerfectNow = isPerfectConsonance(currA, currB)
  if (!isPerfectNow) return false
  const dirA = sign(currA - prevA)
  const dirB = sign(currB - prevB)
  if (dirA === 0 || dirB === 0) return false
  if (dirA !== dirB) return false // must be similar motion
  const leapA = Math.abs(currA - prevA)
  const leapB = Math.abs(currB - prevB)
  // If either voice leaps more than a step (e.g., >2 semitones), consider it a forbidden hidden perfect
  return leapA >= 3 || leapB >= 3
}

function scoreCounterpointViolation(candidate, proposedNote, otherMapping, otherPrevMapping, prevOwn) {
  // score 0 for no violation; higher scores penalize alternatives that create forbidden situations
  let score = 0
  if (!otherMapping || otherMapping.size === 0) return score
  // For each other voice, check if chosen candidate creates parallel/hide violations
  for (const [otherId, otherNote] of otherMapping.entries()) {
    const otherPrev = otherPrevMapping ? otherPrevMapping.get(otherId) : null
    // Check parallel perfects with prevOwn
    if (isParallelPerfect(prevOwn, candidate, otherPrev, otherNote)) score += 1000
    if (isHiddenDirectPerfect(prevOwn, candidate, otherPrev, otherNote)) score += 500
    // Prefer contrary motion: decrease score if candidate moves contrary to other voice
    if (prevOwn != null && otherPrev != null) {
      const dirOwn = sign(candidate - prevOwn)
      const dirOther = sign(otherNote - otherPrev)
      if (dirOwn !== 0 && dirOther !== 0 && dirOwn !== dirOther) {
        score -= 1
      }
    }
  }
  return Math.max(0, score)
}

/**
 * Validate that a loop's notes don't conflict with other loops
 * @param {number} loopId - ID of the loop being validated
 * @param {Array<number|null>} noteArray - Note array for this loop
 * @param {Array<Array<number|null>>} otherLoops - Array of other loop note arrays
 * @returns {boolean} True if no conflicts, false if conflicts exist
 */
export function validateCounterpoint(loopId, noteArray, otherLoops) {
  // Assume valid when counterpoint is disabled
  if (!COUNTERPOINT_ENABLED) {
    return true
  }

  let hasConflicts = false;
  const conflicts = [];

  // Check each step
  for (let step = 0; step < noteArray.length; step++) {
    const note = noteArray[step];
    if (note === null) continue;

    // Check against all other loops at this step
    for (let otherLoopId = 0; otherLoopId < otherLoops.length; otherLoopId++) {
      const otherNotes = otherLoops[otherLoopId];
      if (otherNotes && otherNotes[step] === note) {
        hasConflicts = true;
        conflicts.push({ step, note, conflictingLoop: otherLoopId });
        console.log(`[MelGen] validateCounterpoint loop=${loopId} conflict at step=${step} note=${note} with loop=${otherLoopId}`);
      }
    }
  }

  if (!hasConflicts) {
    console.log(`[MelGen] validateCounterpoint loop=${loopId} no conflicts detected`);
  } else {
    console.log(`[MelGen] validateCounterpoint loop=${loopId} found ${conflicts.length} conflicts`);
  }

  return !hasConflicts;
}

// Helper function

/**
 * Generate all notes in a scale within a given range
 * @param {Array<number>} scale - Scale intervals
 * @param {number} baseNote - Base MIDI note
 * @param {Object} noteRange - {min, max} MIDI range
 * @returns {Array<number>} Array of valid MIDI notes
 */
function generateScaleNotes(scale, baseNote, noteRange) {
  const notes = [];

  // Generate notes across multiple octaves within range
  const minOctave = Math.floor((noteRange.min - baseNote) / 12);
  const maxOctave = Math.floor((noteRange.max - baseNote) / 12);

  for (let oct = minOctave; oct <= maxOctave; oct++) {
    for (const interval of scale) {
      const note = baseNote + interval + (oct * 12);
      if (note >= noteRange.min && note <= noteRange.max) {
        notes.push(note);
      }
    }
  }

  return notes;
}
