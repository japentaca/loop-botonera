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
  notesMatrix.initializeLoop(0, { isActive: true, length: 8, baseNote: 60, scale: 'major' })

  // Start a cycle and ensure audioStore.activeTonalCycles is updated
  const h = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 1, startImmediately: false })
  assert(h && h.id, 'Cycle started')

  const active = audioStore.activeTonalCycles || []
  const found = active.find(c => c.id === h.id)
  assert(found, 'audioStore.activeTonalCycles should contain started cycle')

  // Pause cycle and check paused flag reflected
  audioStore.pauseTonalCycle(h.id)
  const pausedInfo = (audioStore.activeTonalCycles || []).find(c => c.id === h.id)
  assert(pausedInfo && pausedInfo.paused === true, 'Cycle should be paused')

  // Resume cycle and check not paused
  audioStore.resumeTonalCycle(h.id)
  const resumedInfo = (audioStore.activeTonalCycles || []).find(c => c.id === h.id)
  assert(resumedInfo && resumedInfo.paused === false, 'Cycle should be resumed')

  // Stop cycle and ensure it is removed
  stopCycle(h.id)
  const afterStop = (audioStore.activeTonalCycles || []).find(c => c.id === h.id)
  assert(!afterStop, 'Cycle should be removed after stop')

  console.log('tonal_cycles_auto_refresh test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
