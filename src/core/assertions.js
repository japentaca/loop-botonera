/**
 * Assertion utilities for contract validation and defensive code removal
 * 
 * Provides clear, throw-based validation that replaces defensive programming patterns.
 * These assertions should only be used in development mode where appropriate.
 */

/**
 * Simple assertion function
 */
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message)
  }
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined(value, name = 'value') {
  if (value === null || value === undefined) {
    throw new Error(`${name} is required but was ${value}`)
  }
  return value
}

/**
 * Assert that a value is a function
 */
export function assertFunction(value, name = 'value') {
  if (typeof value !== 'function') {
    throw new Error(`${name} must be a function, got ${typeof value}`)
  }
  return value
}

/**
 * Assert that a value is an array
 */
export function assertArray(value, name = 'value') {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array, got ${typeof value}`)
  }
  return value
}

/**
 * Assert that a value is a number
 */
export function assertNumber(value, name = 'value') {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${name} must be a valid number, got ${typeof value}`)
  }
  return value
}

/**
 * Assert that a number is in a valid range
 */
export function assertNumberInRange(value, min, max, name = 'value') {
  assertNumber(value, name)
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}, got ${value}`)
  }
  return value
}

/**
 * Assert that a value is a string
 */
export function assertString(value, name = 'value') {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string, got ${typeof value}`)
  }
  return value
}

/**
 * Assert that a string is not empty
 */
export function assertNonEmptyString(value, name = 'value') {
  assertString(value, name)
  if (value.trim().length === 0) {
    throw new Error(`${name} cannot be empty`)
  }
  return value
}

/**
 * Assert that a value is an object (not null, not array)
 */
export function assertObject(value, name = 'value') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object, got ${typeof value}`)
  }
  return value
}

/**
 * Assert that an object has required properties
 */
export function assertHasProperties(obj, properties, name = 'object') {
  assertObject(obj, name)

  properties.forEach(prop => {
    if (!(prop in obj)) {
      throw new Error(`${name} is missing required property: ${prop}`)
    }
  })

  return obj
}

/**
 * Assert that a loop ID is valid
 */
export function assertLoopId(loopId, maxLoops) {
  assertNumber(loopId, 'loopId')
  assertNumberInRange(loopId, 0, maxLoops - 1, 'loopId')
  return loopId
}

/**
 * Assert that a density value is valid (0-1 range)
 */
export function assertDensity(density, name = 'density') {
  assertNumber(density, name)
  assertNumberInRange(density, 0, 1, name)
  return density
}

/**
 * Assert that a MIDI note value is valid (0-127)
 */
export function assertMidiNote(note, name = 'note') {
  assertNumber(note, name)
  assertNumberInRange(note, 0, 127, name)
  return note
}

/**
 * Assert that a scale name is valid
 */
export function assertScaleName(scaleName) {
  assertNonEmptyString(scaleName, 'scaleName')

  // Common scales that should be supported
  const validScales = [
    'major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
    'majorPentatonic', 'minorPentatonic', 'blues', 'chromatic'
  ]

  if (!validScales.includes(scaleName)) {
    console.warn(`Unknown scale name: ${scaleName}. Valid scales: ${validScales.join(', ')}`)
    // Don't throw - allow custom scales, just warn
  }

  return scaleName
}

/**
 * Assert that an array of MIDI notes is valid
 */
export function assertMidiNoteArray(notes, name = 'notes') {
  assertArray(notes, name)

  notes.forEach((note, index) => {
    if (note !== null) {
      assertMidiNote(note, `${name}[${index}]`)
    }
  })

  return notes
}

/**
 * Assert that a step index is valid for a given loop length
 */
export function assertStepIndex(stepIndex, loopLength) {
  assertNumber(stepIndex, 'stepIndex')
  assertNumberInRange(stepIndex, 0, loopLength - 1, 'stepIndex')
  return stepIndex
}

/**
 * Assert that synth configuration is valid
 */
export function assertSynthConfig(config) {
  assertObject(config, 'synthConfig')

  assertString(config.type, 'synthConfig.type')
  assertObject(config.oscillator, 'synthConfig.oscillator')
  assertString(config.oscillator.type, 'synthConfig.oscillator.type')

  if (config.envelope) {
    assertObject(config.envelope, 'synthConfig.envelope')
      ;['attack', 'decay', 'sustain', 'release'].forEach(prop => {
        if (config.envelope[prop] !== undefined) {
          assertNumber(config.envelope[prop], `synthConfig.envelope.${prop}`)
        }
      })
  }

  return config
}

/**
 * Assert that loop metadata is valid
 */
export function assertLoopMetadata(metadata) {
  assertObject(metadata, 'loopMetadata')

  if (metadata.scale) {
    assertScaleName(metadata.scale)
  }

  if (metadata.baseNote !== undefined) {
    assertMidiNote(metadata.baseNote, 'loopMetadata.baseNote')
  }

  if (metadata.length !== undefined) {
    assertNumber(metadata.length, 'loopMetadata.length')
  }

  if (metadata.density !== undefined) {
    assertDensity(metadata.density, 'loopMetadata.density')
  }

  if (metadata.octaveRange !== undefined) {
    assertNumberInRange(metadata.octaveRange, 1, 8, 'loopMetadata.octaveRange')
  }

  return metadata
}

/**
 * Development-only assertion wrapper
 */
export function devAssert(condition, message = 'Development assertion failed') {
  if (process.env.NODE_ENV === 'development') {
    assert(condition, message)
  }
  return condition
}

/**
 * Check if we're in development mode
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

/**
 * Create a module-specific assertion with custom error messages
 */
export function createModuleAssert(moduleName) {
  return {
    defined: (value, name) => assertDefined(value, `${moduleName}.${name}`),
    func: (value, name) => assertFunction(value, `${moduleName}.${name}`),
    array: (value, name) => assertArray(value, `${moduleName}.${name}`),
    number: (value, name) => assertNumber(value, `${moduleName}.${name}`),
    range: (value, min, max, name) => assertNumberInRange(value, min, max, `${moduleName}.${name}`),
    string: (value, name) => assertString(value, `${moduleName}.${name}`),
    nonEmpty: (value, name) => assertNonEmptyString(value, `${moduleName}.${name}`),
    object: (value, name) => assertObject(value, `${moduleName}.${name}`),
    props: (obj, props, name) => assertHasProperties(obj, props, `${moduleName}.${name}`),
    loopId: (id, max) => assertLoopId(id, max),
    density: (d) => assertDensity(d, `${moduleName}.density`),
    midiNote: (note, name) => assertMidiNote(note, `${moduleName}.${name}`),
    scaleName: (name) => assertScaleName(name),
    notesArray: (notes, name) => assertMidiNoteArray(notes, `${moduleName}.${name}`),
    stepIndex: (step, length) => assertStepIndex(step, length),
    synthConfig: (config) => assertSynthConfig(config),
    metadata: (meta) => assertLoopMetadata(meta),
    dev: (condition, message) => devAssert(condition, `${moduleName}: ${message}`)
  }
}

/**
 * Validate a module interface (used for contract validation)
 */
export function validateModuleInterface(moduleName, instance, requiredMethods = [], optionalMethods = []) {
  const assert = createModuleAssert(moduleName)

  // Check required methods
  requiredMethods.forEach(method => {
    assert.func(instance[method], method)
  })

  // Check optional methods (warn only in development)
  optionalMethods.forEach(method => {
    if (instance[method] !== undefined && typeof instance[method] !== 'function') {
      if (isDevelopment()) {
        console.warn(`${moduleName}.${method} is defined but not a function`)
      }
    }
  })

  return instance
}