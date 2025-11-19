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
  console.log('TEST: audioStore.tempo =', audioStore.tempo)
  console.log('TEST: audioStore.tempo.value =', audioStore.tempo.value)

  // Spy on setInterval
  const originalSetInterval = global.setInterval
  let capturedIntervalMs = null
  let timers = []
  global.setInterval = (fn, ms) => {
    capturedIntervalMs = ms
    const id = originalSetInterval(fn, ms)
    timers.push(id)
    return id
  }

  try {
    const intervalBeats = 4 // expecting 4 * 1000 = 4000 ms
    const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats, startImmediately: true })
    assert(handle && handle.id, 'handle created')

    // ensure config stores correct interval
    const info = listCycles().find(c => c.id === handle.id)
    assert(info.config.intervalBeats === intervalBeats, `config.intervalBeats should be ${intervalBeats} got ${info.config.intervalBeats}`)

    // Wait shortly to allow setInterval to be called
    await new Promise(resolve => setTimeout(resolve, 50))

    const expectedMs = 4 * 1000
    assert(capturedIntervalMs === expectedMs, `Expected interval ms to be ${expectedMs} but got ${capturedIntervalMs}`)

    // cleanup
    stopCycle(handle.id)
    timers.forEach(t => clearInterval(t))
    console.log('tonal_cycles_interval_beats test passed')
  } catch (err) {
    // restore and rethrow
    global.setInterval = originalSetInterval
    throw err
  }

  // restore
  global.setInterval = originalSetInterval
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
