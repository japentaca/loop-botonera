import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '../../src/stores/audioStore.js'
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { startCycle, stopCycle, listCycles } from '../../src/modules/tonalCycles.js'

function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed') }

async function run() {
  setActivePinia(createPinia())
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()

  audioStore.updateScale('major')
  notesMatrix.initializeMatrix()
  notesMatrix.initializeLoop(0, { isActive: true, length: 8, baseNote: 60, scale: 'major' })

  // start first cycle
  const h1 = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 2, startImmediately: false })
  assert(h1 && h1.id, 'h1 created')

  // start duplicate - should dedupe and return same id
  const h2 = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 2, startImmediately: false })
  assert(h2 && h2.id === h1.id, `expected dedupe: same id returned; got ${h2.id} vs ${h1.id}`)

  // start with allowMultiple true -> should create a new id
  const h3 = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 2, startImmediately: false, allowMultiple: true })
  assert(h3 && h3.id && h3.id !== h1.id, `allowMultiple should create a different id; got ${h3.id} vs ${h1.id}`)

  // test updating interval for existing cycle: start with same scope and target but changed interval beats
  const h4 = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 8, startImmediately: false })
  assert(h4 && h4.id === h1.id, 'Same cycle id returned for updated interval')
  const cycles = listCycles()
  const info = cycles.find(c => c.id === h1.id)
  const expectedPulses = 8 * 4 // 8 beats -> 32 pulses
  assert(info.config.intervalPulses === expectedPulses, `Interval updated in pulses: ${info.config.intervalPulses} === ${expectedPulses}`)

  // Cleanup
  stopCycle(h1.id)
  stopCycle(h3.id)
  console.log('tonal cycles dedupe test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
