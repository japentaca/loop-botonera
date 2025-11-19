import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '../../src/stores/audioStore.js'
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { startCycle, stopCycle } from '../../src/modules/tonalCycles.js'

function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed') }

async function run() {
  setActivePinia(createPinia())
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()

  notesMatrix.initializeMatrix()
  notesMatrix.initializeLoop(2, { isActive: true, length: 8, baseNote: 60, scale: 'major' })
  audioStore.updateScale('major')

  const beforeBase = notesMatrix.loopMetadata[2].baseNote
  const handle = startCycle({ scope: 'loop', loopId: 2, strategy: 'shiftKey', intervalBeats: 1, startImmediately: false })
  // step cycle
  audioStore.stepTonalCycle(handle.id)
  const afterBase = notesMatrix.loopMetadata[2].baseNote
  assert(afterBase === (beforeBase + 1), `Expected baseNote to increase by 1 from ${beforeBase} to ${afterBase}`)

  stopCycle(handle.id)
  console.log('tonal_cycles_shift_key test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
