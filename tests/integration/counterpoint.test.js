import { setCounterpointEnabled, analyzeActiveLoopsWithContext, avoidConflicts } from '../../src/services/counterpointService.js'

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

async function run() {
  setCounterpointEnabled(true)

  // Simulate two loops: prev step notes and current other note create parallel perfects
  // Loop 0 prev: 60 (C4), Loop 1 prev: 67 (G4) -> P5
  // Current step other loop: 69 (A4) (moved up 2 semitones), proposed for loop 0: 62 (D4) (moved up 2 semitones)
  // This would create a parallel P5 (62 vs 69 differ by 7 semitones and both moved up)

  const otherLoopPrev = [60, 67] // actual mapping for prev: not used directly but included for clarity
  const otherLoopCurr = [62, 69]

  const loopsArray = [
    // loop 0 array: prev at index 0: 60, current at index 1: null (we'll set proposed)
    [60, null],
    // loop 1 array: prev 67, current 69
    [67, 69]
  ]

  const step = 1
  const ctx = analyzeActiveLoopsWithContext(loopsArray, step)
  // test that mapping returns expected mapping
  assert(ctx.mapping.get(1) === 69, 'Other mapping should contain loop 1 -> 69')
  // Proposed note for loop 0
  const proposed = 62
  const scale = [0, 2, 4, 5, 7, 9, 11]
  const adjusted = avoidConflicts(proposed, ctx.occupied, scale, { baseNote: 60, noteRange: { min: 24, max: 96 }, otherMapping: ctx.mapping, otherPrevMapping: ctx.prevMapping, prevOwn: 60, currentStep: step })

  assert(adjusted !== proposed, 'Parallel perfect should be avoided and candidate changed')
  console.log('counterpoint basic test passed (parallel perfect avoided)')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
