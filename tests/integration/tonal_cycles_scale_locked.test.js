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

  // lock the global scale (use toggleScaleLock) to ensure it's active
  if (typeof audioStore.toggleScaleLock === 'function') {
    audioStore.toggleScaleLock()
  }

  // Start a global rotate cycle but do not start immediately
  const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 1, startImmediately: false })
  const currentScaleBefore = audioStore.currentScale
  // Step the cycle (should be blocked by scaleLock)
  audioStore.stepTonalCycle(handle.id)

  const currentScaleAfter = audioStore.currentScale
  assert(currentScaleBefore === currentScaleAfter, `Expected scale to remain ${currentScaleBefore} but got ${currentScaleAfter}`)

  // cleanup
  stopCycle(handle.id)
  // unlock
  if (audioStore.scaleLocked && audioStore.scaleLocked.value) audioStore.toggleScaleLock()

  console.log('tonal_cycles_scale_locked test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
