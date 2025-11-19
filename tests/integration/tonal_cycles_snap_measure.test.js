import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '../../src/stores/audioStore.js'
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { startCycle, stopCycle, listCycles } from '../../src/modules/tonalCycles.js'

function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed') }

async function run() {
  setActivePinia(createPinia())
  const audioStore = useAudioStore()
  const notesMatrix = useNotesMatrix()

  // Set up baseline
  notesMatrix.initializeMatrix()
  notesMatrix.initializeLoop(0, { isActive: true, length: 8, baseNote: 60, scale: 'major' })
  audioStore.updateScale('major')
  // start cycle with snapToMeasure true; do not start immediately
  const h1 = startCycle({ scope: 'loop', loopId: 0, strategy: 'rotateMode', intervalBeats: 4, snapToMeasure: true, startImmediately: false })
  assert(h1 && h1.id, 'h1 created')

  // list cycles and verify config
  const info = listCycles().find(c => c.id === h1.id)
  assert(info && info.config.snapToMeasure === true, 'Cycle created with snapToMeasure true')

  // resumeCycle should schedule waiting timeout (can't assert exact timeout ms reliably here), but we can ensure not running immediately
  // There is no direct API to inspect waitingTimeout here; the cycle state exposes 'waiting' via listCycles() (waiting property should be true)
  const cycles = listCycles()
  const cycleInfo = cycles.find(c => c.id === h1.id)
  // waiting probably false until resume invoked; ensure we can resume
  const { resumeCycle } = await import('../../src/modules/tonalCycles.js')
  await resumeCycle(h1.id)
  // after resume we expect paused is false and either waiting or timer set (can't easily read timer from test)
  const post = listCycles().find(c => c.id === h1.id)
  assert(post && !post.paused, 'Cycle resumed and not paused')

  stopCycle(h1.id)
  console.log('tonal_cycles_snap_measure test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
