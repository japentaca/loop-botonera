import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '../../src/stores/audioStore.js'
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { startCycle, stopCycle, stepCycle, listCycles } from '../../src/modules/tonalCycles.js'

function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed') }

async function run() {
  // Initialize Pinia for tests that use stores outside Vue components
  setActivePinia(createPinia())
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()
  // Initialize test: set global scale
  audioStore.updateScale('major')

  // Create a loop in notesMatrix
  notesMatrix.initializeMatrix()
  notesMatrix.initializeLoop(0, { isActive: true, length: 8, baseNote: 60, scale: 'major' })

  // Start a global cycle in rotateMode (we won't rely on setInterval, we'll call step)
  const handle = startCycle({ scope: 'global', strategy: 'rotateMode', intervalBeats: 1, startImmediately: false })
  assert(handle && handle.id, 'Cycle handle created')
  const initialScale = audioStore.currentScale

  // Step the cycle and check the scale changed
  handle.step()
  const newScale = audioStore.currentScale
  assert(newScale !== initialScale, `Scale should change; was ${initialScale} now ${newScale}`)
  console.log('global tonal cycle changed from', initialScale, 'to', newScale)

  // Now test group scope: create a group and assign loops
  notesMatrix.initializeLoop(1, { isActive: true, length: 8, baseNote: 48, scale: 'minor' })
  // link loops as voices
  const gid = notesMatrix.linkLoopsAsVoices(0, [1])
  assert(gid, 'Group created')
  // Start a group cycle and step
  const gh = startCycle({ scope: 'group', groupId: gid, strategy: 'rotateMode', startImmediately: false })
  const meta0 = notesMatrix.loopMetadata[0]
  const prevScale0 = meta0.scale || audioStore.currentScale
  gh.step()
  const nextScale0 = notesMatrix.loopMetadata[0].scale || audioStore.currentScale
  assert(nextScale0 !== prevScale0, `Loop 0 scale rotated: ${prevScale0} -> ${nextScale0}`)

  // Cleanup
  stopCycle(handle.id)
  stopCycle(gh.id)
  console.log('tonal cycles test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
