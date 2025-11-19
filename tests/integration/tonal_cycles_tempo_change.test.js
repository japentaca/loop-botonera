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

  // Start cycle with 4 beats and immediate start
  const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 4, startImmediately: true })
  // validate config is stored in beats/pulses
  const info = listCycles().find(c => c.id === handle.id)
  assert(info.config.intervalBeats === 4, `intervalBeats expected 4, got ${info.config.intervalBeats}`)
  assert(info.config.intervalPulses === 16, `intervalPulses expected 16, got ${info.config.intervalPulses}`)

  // Now change tempo to 120bpm - in beats-based scheduling, intervalPulses shouldn't change
  audioStore.updateTempo(120)
  const infoAfterTempo = listCycles().find(c => c.id === handle.id)
  assert(infoAfterTempo.config.intervalBeats === 4, `intervalBeats expected 4 after tempo change, got ${infoAfterTempo.config.intervalBeats}`)
  assert(infoAfterTempo.config.intervalPulses === 16, `intervalPulses expected 16 after tempo change, got ${infoAfterTempo.config.intervalPulses}`)

  // cleanup
  stopCycle(handle.id)
  console.log('tonal_cycles_tempo_change test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
