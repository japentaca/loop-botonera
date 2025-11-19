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

  // Set tempo for deterministic behavior; scheduling uses beats/pulses, not ms
  audioStore.updateTempo(60) // tempo set to 60 BPM
  console.log('TEST: audioStore.tempo =', audioStore.tempo)
  console.log('TEST: audioStore.tempo.value =', audioStore.tempo.value)

  // We do not expect tonalCycles to use ms-based timers anymore.

  try {
    const intervalBeats = 4 // expecting 4 * 1000 = 4000 ms
    const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats, startImmediately: true })
    assert(handle && handle.id, 'handle created')

    // ensure config stores correct interval
    const info = listCycles().find(c => c.id === handle.id)
    assert(info.config.intervalBeats === intervalBeats, `config.intervalBeats should be ${intervalBeats} got ${info.config.intervalBeats}`)

    // ensure config stores correct pulses and beats
    const expectedPulses = 4 * 4 // 4 beats -> 16 pulses
    const expectedBeats = 4
    assert(info.config.intervalBeats === expectedBeats, `config.intervalBeats should be ${expectedBeats} got ${info.config.intervalBeats}`)
    assert(info.config.intervalPulses === expectedPulses, `config.intervalPulses should be ${expectedPulses} got ${info.config.intervalPulses}`)

    // cleanup
    stopCycle(handle.id)
    console.log('tonal_cycles_interval_beats test passed (beats/pulses based)')
  } catch (err) {
    throw err
  }
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
