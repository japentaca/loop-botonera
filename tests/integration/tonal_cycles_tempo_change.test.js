import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '../../src/stores/audioStore.js'
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { startCycle, stopCycle, listCycles } from '../../src/modules/tonalCycles.js'

function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed') }

async function run() {
  setActivePinia(createPinia())
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()

  notesMatrix.initializeMatrix()
  notesMatrix.initializeLoop(0, { isActive: true, length: 8, baseNote: 60, scale: 'major' })
  audioStore.updateScale('major')

  // Set tempo for deterministic ms per beat
  audioStore.updateTempo(60) // 1000 ms per beat

  // Start cycle with 4 beats (expect 4000 ms) and immediate start
  let capturedIntervalMs = null
  const originalSetInterval = global.setInterval
  global.setInterval = (fn, ms) => {
    capturedIntervalMs = ms
    return originalSetInterval(fn, ms)
  }

  const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 4, startImmediately: true })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert(capturedIntervalMs === 4000, `Expected initial interval 4000ms got ${capturedIntervalMs}`)

  // Now change tempo to 120bpm - expect interval to become 2000ms
  global.setInterval = (fn, ms) => { capturedIntervalMs = ms; return originalSetInterval(fn, ms) }
  audioStore.updateTempo(120)
  // wait to give a chance to update
  await new Promise(resolve => setTimeout(resolve, 20))
  assert(capturedIntervalMs === 2000, `Expected updated interval 2000ms got ${capturedIntervalMs}`)

  // cleanup
  stopCycle(handle.id)
  // restore
  global.setInterval = originalSetInterval
  console.log('tonal_cycles_tempo_change test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
