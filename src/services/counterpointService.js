/**
 * Counterpoint Service
 * Implements simple counterpoint logic for melodic note avoidance across loops
 */

/**
 * Analyze active loops at a specific step to find occupied notes
 * @param {Array<Array<number|null>>} loopsArray - Array of loop note arrays
 * @param {number} currentStep - The step index to analyze
 * @returns {Set<number>} Set of occupied MIDI note numbers
 */
export function analyzeActiveLoops(loopsArray, currentStep) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

  const occupiedNotes = new Set();

  for (let loopId = 0; loopId < loopsArray.length; loopId++) {
    const loopNotes = loopsArray[loopId];
    if (loopNotes && loopNotes[currentStep] !== null) {
      const note = loopNotes[currentStep];
      if (occupiedNotes.has(note)) {
        melLog(`analyzeActiveLoops step=${currentStep} collision detected: note ${note} in multiple loops`);
      }
      occupiedNotes.add(note);
    }
  }

  melLog(`analyzeActiveLoops step=${currentStep} occupied=${Array.from(occupiedNotes).sort().join(',') || 'none'}`);
  return occupiedNotes;
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
export function avoidConflicts(proposedNote, occupiedNotes, scale, options = {}) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

  // No conflict if note is not occupied
  if (!occupiedNotes.has(proposedNote)) {
    return proposedNote;
  }

  const { baseNote = 60, noteRange = { min: 24, max: 96 } } = options;

  // Generate all possible notes in the scale within range
  const possibleNotes = generateScaleNotes(scale, baseNote, noteRange);

  // Find available alternatives, preferring notes close to the original
  const alternatives = possibleNotes.filter(note => !occupiedNotes.has(note));

  if (alternatives.length === 0) {
    melLog(`avoidConflicts note=${proposedNote} no alternatives available, keeping original`);
    return proposedNote; // No alternatives, keep original
  }

  // Sort by distance from proposed note
  alternatives.sort((a, b) => Math.abs(a - proposedNote) - Math.abs(b - proposedNote));

  const chosen = alternatives[0];
  melLog(`avoidConflicts note=${proposedNote} occupied, moved to ${chosen}`);
  return chosen;
}

/**
 * Validate that a loop's notes don't conflict with other loops
 * @param {number} loopId - ID of the loop being validated
 * @param {Array<number|null>} noteArray - Note array for this loop
 * @param {Array<Array<number|null>>} otherLoops - Array of other loop note arrays
 * @returns {boolean} True if no conflicts, false if conflicts exist
 */
export function validateCounterpoint(loopId, noteArray, otherLoops) {
  const melLog = (...args) => console.log('[MelGen]', ...args);

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
        melLog(`validateCounterpoint loop=${loopId} conflict at step=${step} note=${note} with loop=${otherLoopId}`);
      }
    }
  }

  if (!hasConflicts) {
    melLog(`validateCounterpoint loop=${loopId} no conflicts detected`);
  } else {
    melLog(`validateCounterpoint loop=${loopId} found ${conflicts.length} conflicts`);
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