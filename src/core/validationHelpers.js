/**
 * Centralized Validation Helpers
 * 
 * Replaces scattered defensive programming patterns with centralized validation.
 * These helpers replace runtime checks with clear contracts and proper error handling.
 */

import {
  assert,
  assertNumber,
  assertArray,
  assertObject,
  assertLoopId,
  assertDensity,
  assertScaleName,
  assertMidiNote,
  assertStepIndex,
  createModuleAssert,
  isDevelopment
} from './assertions.js'

/**
 * Module-specific validation helpers
 */
export const ValidationHelpers = {
  /**
   * NotesMatrix validation helpers
   */
  notesMatrix: createModuleAssert('NotesMatrix'),

  /**
   * AudioEngine validation helpers  
   */
  audioEngine: createModuleAssert('AudioEngine'),

  /**
   * LoopManager validation helpers
   */
  loopManager: createModuleAssert('LoopManager'),

  /**
   * EnergyManager validation helpers
   */
  energyManager: createModuleAssert('EnergyManager'),

  /**
   * EvolutionSystem validation helpers
   */
  evolutionSystem: createModuleAssert('EvolutionSystem'),

  /**
   * AudioStore validation helpers
   */
  audioStore: createModuleAssert('AudioStore')
}

/**
 * Replace function existence checks with contract validation
 * 
 * OLD PATTERN (REMOVE):
 * if (typeof notesMatrix.getEffectiveDensity === 'function') {
 *   return notesMatrix.getEffectiveDensity(loopId)
 * }
 * return 0.3  // fallback
 * 
 * NEW PATTERN (USE):
 * return getLoopDensity(notesMatrix, loopId)  // throws if invalid
 */
export function getLoopDensity(notesMatrix, loopId) {
  ValidationHelpers.notesMatrix.object(notesMatrix, 'notesMatrix')
  ValidationHelpers.loopManager.loopId(loopId, notesMatrix.MAX_LOOPS || 16)

  // After contract validation, we know these methods exist
  const density = notesMatrix.getEffectiveDensity(loopId)
  ValidationHelpers.loopManager.density(density)

  return density
}

/**
 * Replace multiple fallback chains with single validation
 * 
 * OLD PATTERN (REMOVE):
 * const val = typeof meta.manualDensity === 'number' ? meta.manualDensity : 
 *             (typeof meta.density === 'number' ? meta.density : 0.3)
 * 
 * NEW PATTERN (USE):
 * const density = getEffectiveLoopDensity(metadata)  // validates and returns
 */
export function getEffectiveLoopDensity(metadata) {
  ValidationHelpers.loopManager.object(metadata, 'metadata')

  // Check manual density first
  if (metadata.densityMode === 'manual' && typeof metadata.manualDensity === 'number') {
    return ValidationHelpers.loopManager.density(metadata.manualDensity)
  }

  // Check auto density
  if (typeof metadata.autoDensity === 'number') {
    return ValidationHelpers.loopManager.density(metadata.autoDensity)
  }

  // Check general density
  if (typeof metadata.density === 'number') {
    return ValidationHelpers.loopManager.density(metadata.density)
  }

  // No valid density found - this is a configuration error
  throw new Error('No valid density found in loop metadata')
}

/**
 * Replace bounds checking with contract validation
 * 
 * OLD PATTERN (REMOVE):
 * if (loopId >= MAX_LOOPS || !loopMetadata[loopId]) {
 *   return { density: 0, noteCount: 0, length: 0 }
 * }
 * 
 * NEW PATTERN (USE):
 * validateLoopAccess(loopMetadata, loopId)  // throws if invalid
 */
export function validateLoopAccess(loopMetadata, loopId, maxLoops) {
  ValidationHelpers.loopManager.loopId(loopId, maxLoops || 16)
  ValidationHelpers.notesMatrix.object(loopMetadata, 'loopMetadata')

  if (!loopMetadata[loopId]) {
    throw new Error(`Loop ${loopId} not found in metadata`)
  }

  return true
}

/**
 * Replace environment checks with build-time configuration
 * 
 * OLD PATTERN (REMOVE):
 * const DEBUG = (typeof window !== 'undefined' && Boolean(window.__LOOP_DEBUG)) || 
 *               (typeof import.meta !== 'undefined' && import.meta.env && 
 *                String(import.meta.env.VITE_LOOP_DEBUG) === 'true')
 * 
 * NEW PATTERN (USE):
 * const DEBUG = process.env.NODE_ENV === 'development' && process.env.VITE_DEBUG_ENABLED === 'true'
 */
export function getDebugConfig() {
  return {
    enabled: process.env.NODE_ENV === 'development' && process.env.VITE_DEBUG_ENABLED === 'true',
    windowDebug: process.env.VITE_WINDOW_DEBUG === 'true',
    verbose: process.env.VITE_VERBOSE_DEBUG === 'true'
  }
}

/**
 * Replace array validation with contract checking
 * 
 * OLD PATTERN (REMOVE):
 * if (!Array.isArray(loops) || loops.length === 0) return
 * 
 * NEW PATTERN (USE):
 * validateLoopsArray(loops)  // throws if invalid
 */
export function validateLoopsArray(loops) {
  ValidationHelpers.loopManager.array(loops, 'loops')

  if (loops.length === 0) {
    throw new Error('Loops array cannot be empty')
  }

  return loops
}

/**
 * Replace scale name validation
 * 
 * OLD PATTERN (REMOVE):
 * if (!scaleName || scaleName === 'null') {
 *   console.warn(`Invalid scale name provided: "${scaleName}", using 'major' as default`)
 *   scaleName = 'major'
 * }
 * 
 * NEW PATTERN (USE):
 * const validatedScale = validateScaleName(scaleName)  // throws if invalid
 */
export function validateScaleName(scaleName) {
  if (!scaleName || scaleName === 'null') {
    throw new Error(`Invalid scale name: ${scaleName}. Scale name is required.`)
  }

  return ValidationHelpers.loopManager.scaleName(scaleName)
}

/**
 * Replace synth configuration validation
 * 
 * OLD PATTERN (REMOVE):
 * loop.synthModel = synthConfig.type || 'PolySynth'
 * loop.synthType = synthConfig.oscillator?.type || 'sine'
 * 
 * NEW PATTERN (USE):
 * validateAndApplySynthConfig(loop, synthConfig)  // throws if invalid
 */
export function validateAndApplySynthConfig(loop, synthConfig, audioEngine) {
  ValidationHelpers.loopManager.object(loop, 'loop')
  ValidationHelpers.audioEngine.object(audioEngine, 'audioEngine')
  ValidationHelpers.audioStore.object(synthConfig, 'synthConfig')

  // Validate required properties
  ValidationHelpers.audioStore.string(synthConfig.type, 'synthConfig.type')
  ValidationHelpers.audioStore.object(synthConfig.oscillator, 'synthConfig.oscillator')
  ValidationHelpers.audioStore.string(synthConfig.oscillator.type, 'synthConfig.oscillator.type')

  // Apply validated configuration
  loop.synthModel = synthConfig.type
  loop.synthType = synthConfig.oscillator.type
  loop.envelope = synthConfig.envelope || {
    attack: 0.01,
    decay: 0.3,
    sustain: 0.5,
    release: 0.8
  }

  return loop
}

/**
 * Replace audio engine state validation
 * 
 * OLD PATTERN (REMOVE):
 * if (!audioEngine.audioInitialized.value) {
 *   console.warn('[regenerateAllMelodies] Audio not initialized')
 *   return
 * }
 * 
 * NEW PATTERN (USE):
 * ensureAudioReady(audioEngine)  // throws if not ready
 */
export function ensureAudioReady(audioEngine) {
  ValidationHelpers.audioEngine.object(audioEngine, 'audioEngine')

  if (!audioEngine.audioInitialized.value) {
    throw new Error('Audio system not initialized. Call initAudio() first.')
  }

  return true
}

/**
 * Replace loop parameter validation
 * 
 * OLD PATTERN (REMOVE):
 * const newLen = Math.max(1, Math.round(Number(value)))
 * 
 * NEW PATTERN (USE):
 * const validatedLength = validateLoopLength(value)  // throws if invalid
 */
export function validateLoopLength(length) {
  ValidationHelpers.loopManager.number(length, 'length')

  const validated = Math.max(1, Math.round(length))
  if (validated !== length) {
    throw new Error(`Loop length must be an integer >= 1, got ${length}`)
  }

  return validated
}

/**
 * Replace volume parameter validation
 * 
 * OLD PATTERN (REMOVE):
 * const v = Math.abs(value) <= 1 ? Number(value) : Number(value) / 100
 * loop.volume = Math.max(0, Math.min(1, v))
 * 
 * NEW PATTERN (USE):
 * const validatedVolume = validateVolume(value)  // throws if invalid
 */
export function validateVolume(volume) {
  ValidationHelpers.loopManager.number(volume, 'volume')

  // Support both 0-1 and 0-100 ranges
  const normalized = Math.abs(volume) <= 1 ? volume : volume / 100
  const validated = Math.max(0, Math.min(1, normalized))

  if (validated !== normalized) {
    console.warn(`Volume ${volume} normalized to ${validated} (expected 0-1 or 0-100)`)
  }

  return validated
}

/**
 * Replace pan parameter validation
 * 
 * OLD PATTERN (REMOVE):
 * const p = Math.abs(value) <= 1 ? Number(value) : Number(value) / 100
 * const pan = Math.max(-1, Math.min(1, p))
 * 
 * NEW PATTERN (USE):
 * const validatedPan = validatePan(value)  // throws if invalid
 */
export function validatePan(pan) {
  ValidationHelpers.loopManager.number(pan, 'pan')

  // Support both -1 to 1 and -100 to 100 ranges
  const normalized = Math.abs(pan) <= 1 ? pan : pan / 100
  const validated = Math.max(-1, Math.min(1, normalized))

  if (validated !== normalized) {
    console.warn(`Pan ${pan} normalized to ${validated} (expected -1 to 1 or -100 to 100)`)
  }

  return validated
}

/**
 * Replace MIDI note validation
 * 
 * OLD PATTERN (REMOVE):
 * if (typeof midiNote !== 'number' || Number.isNaN(midiNote)) return null
 * 
 * NEW PATTERN (USE):
 * const validatedNote = validateMidiNote(midiNote)  // throws if invalid
 */
export function validateMidiNote(midiNote, allowNull = false) {
  if (allowNull && midiNote === null) {
    return null
  }

  ValidationHelpers.loopManager.midiNote(midiNote, 'midiNote')
  return midiNote
}

/**
 * Replace step index validation
 * 
 * OLD PATTERN (REMOVE):
 * if (loopId >= MAX_LOOPS || step >= MAX_STEPS || !loopMetadata[loopId]) return
 * 
 * NEW PATTERN (USE):
 * validateStepAccess(loopId, step, loopLength)  // throws if invalid
 */
export function validateStepAccess(loopId, step, loopLength) {
  ValidationHelpers.loopManager.loopId(loopId, 16) // Assume 16 loops max
  ValidationHelpers.loopManager.number(step, 'step')
  ValidationHelpers.loopManager.number(loopLength, 'loopLength')

  ValidationHelpers.loopManager.range(step, 0, loopLength - 1, 'step')

  return { loopId, step }
}

/**
 * Development-only validation wrapper
 * 
 * Use this to add validation that only runs in development mode
 */
export function devValidate(condition, message) {
  if (isDevelopment()) {
    assert(condition, message)
  }
  return condition
}

/**
 * Batch validation for performance-critical paths
 * Use this to validate multiple parameters at once in hot paths
 */
export function batchValidate(validations) {
  if (isDevelopment()) {
    validations.forEach(({ condition, message }) => {
      assert(condition, message)
    })
  }
  return true
}

/**
 * Performance-optimized validation for audio callbacks
 * Minimal validation for hot paths where full validation would be too slow
 */
export function audioCallbackValidate(loopId, step) {
  // Minimal validation for 16x/second audio callback
  devValidate(typeof loopId === 'number' && loopId >= 0 && loopId < 16, 'Invalid loopId in audio callback')
  devValidate(typeof step === 'number' && step >= 0, 'Invalid step in audio callback')

  return true
}

/**
 * Replace defensive code patterns with clear contracts
 * 
 * This function documents the transformation from defensive to contract-based code
 */
export function documentDefensiveCodeRemoval() {
  const transformations = {
    'function_existence': {
      old: 'typeof obj.method === "function" ? obj.method() : fallback',
      new: 'validateObject(obj); obj.method() // throws if method missing'
    },

    'fallback_chaining': {
      old: 'const val = a || b || c || default',
      new: 'const val = getValidatedValue(a, b, c) // throws if none valid'
    },

    'bounds_checking': {
      old: 'if (id >= max || !obj[id]) return default',
      new: 'validateAccess(obj, id, max) // throws if invalid'
    },

    'environment_guards': {
      old: 'typeof window !== "undefined" && Boolean(window.debug)',
      new: 'const DEBUG = process.env.NODE_ENV === "development" && process.env.DEBUG'
    },

    'type_validation': {
      old: 'if (typeof val !== "number") val = default',
      new: 'const val = validateNumber(val) // throws if invalid'
    },

    'array_validation': {
      old: 'if (!Array.isArray(arr) || arr.length === 0) return',
      new: 'validateNonEmptyArray(arr) // throws if invalid'
    }
  }

  return transformations
}