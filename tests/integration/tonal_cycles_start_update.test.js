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

  // start cycle for loop 0
  const h1 = startCycle({ scope: 'loop', loopId: 0, strategy: 'rotateMode', intervalBeats: 2, startImmediately: false })
  assert(h1 && h1.id, 'h1 created')

  // start again for same loop but different strategy; should update the existing cycle
  const h2 = startCycle({ scope: 'loop', loopId: 0, strategy: 'shiftKey', intervalBeats: 2, startImmediately: false })
  assert(h2 && h2.id === h1.id, `Update should reuse the same id: ${h2.id} vs ${h1.id}`)

  const info = listCycles().find(c => c.id === h1.id)
  assert(info.config.strategy === 'shiftKey', `Strategy updated to shiftKey; got ${info.config.strategy}`)

  stopCycle(h1.id)
  console.log('tonal_cycles_start_update test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
