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

  // Ensure density is a valid number
  density = typeof density === 'number' && !isNaN(density) ? Math.max(0, Math.min(1, density)) : 0.3;

  // Arpeggio types (removed RANDOM - use dedicated random generator instead)
  const arpeggioTypes = ['UP', 'DOWN', 'UP_DOWN', 'DOWN_UP'];
  const arpeggioType = options.arpeggioType || arpeggioTypes[Math.floor(Math.random() * arpeggioTypes.length)];

  // Generate possible notes within range
  const possibleNotes = generatePossibleNotes(scale, baseNote, noteRange);

  if (possibleNotes.length === 0) {
    melLog(`generateArpeggioPattern failed: no possible notes in range`);
    return new Array(length).fill(null);
  }

  // Sort notes for directional arpeggios
  const sortedNotes = [...possibleNotes].sort((a, b) => a - b);

  // Generate arpeggio sequence with bounce behavior from a random start
  // Start at a random note inside the allowed range, then move in the
  // selected direction and bounce at the edges (min/max note).
  const randomStartIndex = Math.floor(Math.random() * sortedNotes.length);
  let direction = (arpeggioType === 'DOWN' || arpeggioType === 'DOWN_UP') ? -1 : 1; // initial movement
  const arpeggioSequence = [];

  if (sortedNotes.length === 1) {
    // Only one note available; just repeat it
    while (arpeggioSequence.length < length) {
      arpeggioSequence.push(sortedNotes[0]);
    }
  } else {
    let idx = randomStartIndex;
    while (arpeggioSequence.length < length) {
      arpeggioSequence.push(sortedNotes[idx]);

      if (direction === 1) {
        // moving up
        if (idx === sortedNotes.length - 1) {
          // hit max note: bounce down without repeating the edge
          direction = -1;
          idx = sortedNotes.length - 2;
        } else {
          idx += 1;
        }
      } else {
        // moving down
        if (idx === 0) {
          // hit min note: bounce up without repeating the edge
          direction = 1;
          idx = 1;
        } else {
          idx -= 1;
        }
      }
    }
  }

  // Adapt sequence length to pattern length
  let fullSequence;
  if (length <= arpeggioSequence.length) {
    // Short pattern: use subset
    fullSequence = arpeggioSequence.slice(0, length);
  } else {
    // Long pattern: repeat and extend with bouncing
    fullSequence = [];
    let idx = 0;
    let direction = 1; // 1 for forward, -1 for backward
    
    while (fullSequence.length < length) {
      fullSequence.push(arpeggioSequence[idx]);
      
      // Move index with bouncing behavior
      idx += direction;
      
      // Bounce at boundaries
      if (idx >= arpeggioSequence.length) {
        idx = arpeggioSequence.length - 2; // Go back one step from end
        direction = -1;
      } else if (idx < 0) {
        idx = 1; // Go forward one step from start
        direction = 1;
      }
    }
  }

  // Apply density (add rests) - distribute notes evenly across the pattern
  const pattern = new Array(length).fill(null);
  const notesToPlace = Math.max(1, Math.floor(length * density));
  
  // Calculate spacing between notes
  const spacing = length / notesToPlace;
  
  for (let i = 0; i < notesToPlace; i++) {
    const position = Math.min(Math.floor(i * spacing), length - 1);
    pattern[position] = fullSequence[i % fullSequence.length];
  }

  const elapsed = performance.now() - startTime;
  melLog(`generateArpeggioPattern steps=${length} type=${arpeggioType} density=${density.toFixed(2)} range=${noteRange.min}..${noteRange.max} time=${elapsed.toFixed(1)}ms`);

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
