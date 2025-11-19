/**
 * Markov Generators (stub PoC)
 * Minimal placeholder to implement degree-based markov generator in future.
 */
export function generateMarkovDegrees(seedTransitions = {}, options = {}) {
  // Placeholder implementation returns an array of nulls
  const length = options.length || 16
  return new Array(length).fill(null)
}

export default { generateMarkovDegrees }
