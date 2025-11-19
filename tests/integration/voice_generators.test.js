/* Basic integration test for voice generators PoC.
 * Run with: node tests/integration/voice_generators.test.js
 * Note: This test requires dependencies (vue) to be resolvable by Node + ESM.
 */
import { useNotesMatrix } from '../../src/composables/useNotesMatrix.js'
import { generateVoicedGroupPattern } from '../../src/utils/voiceGenerators.js'

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

async function run() {
  const nm = useNotesMatrix()
  // initialize matrix and two loops
  nm.initializeMatrix()
  nm.initializeLoop(0, { isActive: true, length: 16, baseNote: 60, scale: 'major' })
  nm.initializeLoop(1, { isActive: true, length: 16, baseNote: 60, scale: 'major' })

  // enable voices
  nm.updateLoopMetadata(0, { voicesEnabled: true })
  nm.updateLoopMetadata(1, { voicesEnabled: true, voiceConfig: [{ offset: -12, role: 'bass' }] })

  const groupId = nm.linkLoopsAsVoices(0, [1])
  assert(groupId, 'GroupId should be created')

  const members = nm.getGroupMembers(groupId)
  assert(Array.isArray(members) && members.length === 2, 'Group must contain 2 members')

  // Generate voiced group pattern
  const ok = generateVoicedGroupPattern(groupId, { generator: 'auto' })
  assert(ok, 'generateVoicedGroupPattern must return true')

  // Check that both loops have notes (at least one non-null)
  const notes0 = nm.getLoopNotes(0)
  const notes1 = nm.getLoopNotes(1)

  // find any note
  const anyNote = arr => Array.isArray(arr) && arr.some(n => typeof n === 'number')
  assert(anyNote(notes0), 'Loop 0 should have at least one note')
  assert(anyNote(notes1), 'Loop 1 should have at least one note')

  console.log('voice_generators basic test passed')
}

run().catch(err => { console.error('Test failed', err); process.exit(1) })
