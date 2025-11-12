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
  console.log(`generateEuclideanPattern steps=${length} pulses=${pulses} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

  return pattern;
}

/**
 * Generate arpeggio pattern (broken chord progression)
 * @param {Object} params
 * @param {number} params.length - Total number of steps in the pattern
 * @param {Array<number>} params.scale - Scale intervals array
 * @param {number} params.baseNote - Base MIDI note number
 * @param {Object} params.noteRange - {min: number, max: number} MIDI range
 * @param {number} params.density - Density factor (0-1), controls number of arpeggio sequences
 * @param {Object} params.options - Additional options (arpeggioType, etc.)
 * @returns {Array<number|null>} Array of MIDI notes or nulls
 */
export function generateArpeggioPattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const startTime = performance.now();

  // Arpeggio subtypes: support 'UP_RANDOM_BACK' and 'DOWN_RANDOM_BACK'
  // If no subtype is provided, select randomly between the two
  // Older forms (UP, DOWN, UP_DOWN, DOWN_UP) are deprecated and removed.
  // Cadence now BOUNCES at min/max note limits (no wrapping across range).
  const arpeggioType = options.arpeggioType ?? (Math.random() < 0.5 ? 'UP_RANDOM_BACK' : 'DOWN_RANDOM_BACK');

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  if (possibleNotes.length === 0) {
    console.log(`generateArpeggioPattern failed: no possible notes in range`);
    return new Array(length).fill(null);
  }

  // Helper function for debug logging (defined before use)
  const noteToMidi = (midi) => {
    const noteNumber = midi % 12;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteNames[noteNumber]}${octave}`;
  };

  // Sort notes for directional arpeggios
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);

  // Debug: log the scale notes being used
  console.log(`Scale notes (${sortedNotes.length}): ${sortedNotes.map(noteToMidi).join(', ')}`);

  // Choose fixed spacing restricted to 16th/8th/quarter.
  const allowedIntervals = [1, 2, 4];
  let stepInterval;
  if (typeof options.stepInterval === 'string') {
    const map = { '16n': 1, '8n': 2, '4n': 4 };
    stepInterval = map[options.stepInterval] ?? null;
  } else if (typeof options.stepInterval === 'number' && isFinite(options.stepInterval)) {
    const v = Math.floor(options.stepInterval);
    stepInterval = allowedIntervals.includes(v) ? v : null;
  }
  if (!stepInterval) {
    stepInterval = allowedIntervals[Math.floor(Math.random() * allowedIntervals.length)];
  }
  // Determine start offset: use explicit metadata pulse index if provided,
  // otherwise default to a 3th-grid phase within the first measure window.
  const hasExplicitStart = typeof options.startOffset === 'number' && isFinite(options.startOffset);
  const startOffset = hasExplicitStart
    ? Math.max(0, Math.min(length - 1, Math.floor(options.startOffset)))
    : Math.floor(Math.random() * Math.min(3, length)); // 0..length-1 (first measure window)

  // Compute placement positions
  // If options.fillAll is true, use unit-step bounce to cover all indices.
  // Otherwise, place notes at fixed interval positions and leave other steps as rests.
  const positions = [];
  const min = 0;
  const max = length - 1;

  if (options.fillAll === true) {
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
    // Calculate max possible sequences based on stepInterval
    const maxSequences = Math.floor(length / stepInterval);
    // Number of sequences based on density
    const numSequences = Math.max(1, Math.floor(maxSequences * density));
    // Use Euclidean rhythm to distribute positions evenly
    const rawPositions = euclideanRhythm(numSequences, length);
    // Apply startOffset for phasing
    positions.push(...rawPositions.map(p => (p + startOffset) % length));
  }

  // Generate arpeggio sequence sized to placements
  const sequenceLength = positions.length;
  const arpeggioSequence = [];
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

  if (sortedNotes.length === 1) {
    while (arpeggioSequence.length < sequenceLength) {
      arpeggioSequence.push(sortedNotes[0]);
    }
  } else {
    const randomStartIndex = Math.floor(Math.random() * sortedNotes.length);
    let leadIdx = randomStartIndex;
    // Primary cadence direction: UP = +1, DOWN = -1
    let dir = arpeggioType === 'UP_RANDOM_BACK' ? 1 : -1;

    while (arpeggioSequence.length < sequenceLength) {
      // Use fixed tail length for the entire sequence
      const tailLength = tailLengthFixed;

      // Add the lead note
      const leadNote = sortedNotes[leadIdx];
      arpeggioSequence.push(leadNote);
      leadNotes.push(leadNote);
      console.log(`Lead: ${noteToMidi(leadNote)} (idx ${leadIdx}, dir=${dir})`);

      const currentTail = [];

      if (arpeggioSequence.length >= sequenceLength) break;

      // Create the "tail" - notes that follow the lead in opposite direction
      if (tailLength > 0) {
        if (dir === 1) {
          // Lead going UP: tail follows DOWN
          for (let step = 1; step <= tailLength && arpeggioSequence.length < sequenceLength; step++) {
            const tailIdx = leadIdx - step;
            if (tailIdx < 0) {
              console.log(`  Tail boundary hit: leadIdx=${leadIdx}, step=${step}, tailIdx=${tailIdx} (too low)`);
              break; // guard bottom boundary
            }
            const tailNote = sortedNotes[tailIdx];
            console.log(`  Tail DOWN: lead=${noteToMidi(sortedNotes[leadIdx])}, tail=${noteToMidi(tailNote)} (idx ${tailIdx})`);
            arpeggioSequence.push(tailNote);
            currentTail.push(tailNote);
          }
        } else {
          // Lead going DOWN: tail follows UP
          for (let step = 1; step <= tailLength && arpeggioSequence.length < sequenceLength; step++) {
            const tailIdx = leadIdx + step;
            if (tailIdx >= sortedNotes.length) {
              console.log(`  Tail boundary hit: leadIdx=${leadIdx}, step=${step}, tailIdx=${tailIdx} (too high, max=${sortedNotes.length - 1})`);
              break; // guard top boundary
            }
            const tailNote = sortedNotes[tailIdx];
            console.log(`  Tail UP: lead=${noteToMidi(sortedNotes[leadIdx])}, tail=${noteToMidi(tailNote)} (idx ${tailIdx})`);
            arpeggioSequence.push(tailNote);
            currentTail.push(tailNote);
          }
        }
      }

      tailGroups.push(currentTail);

      // Advance lead index with BOUNCE at extremes (no wrapping)
      let nextLead = leadIdx + dir;
      if (nextLead < 0 || nextLead >= sortedNotes.length) {
        // Reverse cadence when hitting min/max note limits
        dir = -dir;
        nextLead = leadIdx + dir;
        // Clamp just in case of single-element boundaries
        if (nextLead < 0) nextLead = 0;
        if (nextLead >= sortedNotes.length) nextLead = sortedNotes.length - 1;
      }
      leadIdx = nextLead;
    }

    // Log detailed cascade visualization
    console.log('=== ARPEGGIO CASCADE PATTERN ===');
    leadNotes.forEach((lead, i) => {
      const tail = tailGroups[i];
      const leadName = noteToMidi(lead);
      if (tail && tail.length > 0) {
        const tailNames = tail.map(note => noteToMidi(note)).join('-');
        console.log(`${leadName} → ${tailNames}`);
      } else {
        console.log(`${leadName} (no tail)`);
      }
    });
    console.log('================================');
  }

  // Build pattern with placements; rest elsewhere
  const pattern = new Array(length).fill(null);
  for (let i = 0; i < positions.length; i++) {
    pattern[positions[i]] = arpeggioSequence[i];
  }

  // Log the generated arpeggio sequence for debugging (compact format)
  const noteToCompactName = (note) => {
    if (note === null) return 'r';
    return noteToMidi(note);
  };

  const compactNames = arpeggioSequence.map(noteToCompactName);
  console.log(`Full sequence: ${compactNames.join(' ')}`);

  const elapsed = performance.now() - startTime;
  console.log(`generateArpeggioPattern steps=${length} type=${arpeggioType} density=${density.toFixed(2)} offset=${startOffset} placements=${positions.length} range=${noteRange.min}..${noteRange.max} tail=on time=${elapsed.toFixed(1)}ms`);
  console.log(pattern)
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
 * @returns {Array<boolean>} Boolean rhythm pattern (true=active, false=rest)
*/
export function generateRandomPattern({ length, scale, baseNote, noteRange, density, options = {} }) {
  const startTime = performance.now()

  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3

  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange)
  if (possibleNotes.length === 0) {
    console.log('generateRandomPattern failed: no possible notes in range')
    return new Array(length).fill(null)
  }

  const noteCount = Math.max(1, Math.floor(length * density))

  const positions = new Set()
  while (positions.size < noteCount) {
    positions.add(Math.floor(Math.random() * length))
  }

  // Select notes to place, evenly distributed across the available range
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b)
  const notesToPlace = []
  if (noteCount <= sortedNotes.length) {
    // Pick evenly spaced notes across the range
    for (let i = 0; i < noteCount; i++) {
      const index = Math.floor(i * sortedNotes.length / noteCount)
      notesToPlace.push(sortedNotes[index])
    }
  } else {
    // Cycle through all notes to ensure full range coverage even with repeats
    for (let i = 0; i < noteCount; i++) {
      notesToPlace.push(sortedNotes[i % sortedNotes.length])
    }
  }

  const pattern = new Array(length).fill(null)
  const posArray = Array.from(positions)
  for (let i = 0; i < posArray.length; i++) {
    pattern[posArray[i]] = notesToPlace[i]
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
