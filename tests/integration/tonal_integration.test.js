import { intervalLabelFromMidi, midiToNoteName, TonalLoaded } from '../../src/services/tonalService.js'

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

async function run() {
  const a = 60 // C4
  const b = 67 // G4
  const label = intervalLabelFromMidi(a, b)
  console.log('Tonal loaded:', TonalLoaded, 'label', label)
  const okLabel = label && ((label === 'P5') || (label === '5P') || label.startsWith('P') || label.endsWith('P'))
  assert(okLabel, `Expected P5 or perfect interval, got ${label}`)
  console.log('tonal_integration test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
