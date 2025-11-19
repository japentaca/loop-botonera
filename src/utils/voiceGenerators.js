/**
 * Voice Generators
 * Minimal PoC for generating voiced group patterns using existing generators
 */
import { useNotesMatrix } from '../composables/useNotesMatrix.js'
import { generateEuclideanPattern, generateScalePattern, generateRandomPattern } from './patternGenerators.js'

// Default voice generator mapping
const DEFAULT_VOICE_GENERATOR = 'auto' // let loop metadata decide

export function generateVoicedGroupPattern(groupId, options = {}) {
  const notesMatrix = useNotesMatrix()
  const members = notesMatrix.getGroupMembers(groupId)
  if (!members || members.length === 0) return false

  // Determine master loop by first member (caller can pass explicit masterLoopId)
  let masterLoopId = options.masterLoopId ?? members[0]
  if (!members.includes(masterLoopId)) masterLoopId = members[0]

  const masterMeta = notesMatrix.loopMetadata[masterLoopId] || {}
  const masterBase = masterMeta.baseNote || 60

  // Save original metadata to restore later
  const backup = {}

  members.forEach(loopId => {
    const meta = notesMatrix.loopMetadata[loopId]
    if (!meta) return
    backup[loopId] = { baseNote: meta.baseNote, generationMode: meta.generationMode }
    // Skip if voices disabled on loop
    if (!meta.voicesEnabled && !options.force) return

    // Determine voice offset from voiceConfig (first config found)
    const vcfg = Array.isArray(meta.voiceConfig) && meta.voiceConfig.length > 0 ? meta.voiceConfig[0] : { offset: 0 }
    const offset = typeof vcfg.offset === 'number' ? vcfg.offset : 0
    const newBase = masterBase + offset
    // Update base note
    notesMatrix.updateLoopMetadata(loopId, { baseNote: newBase })
  })

  // Generate patterns for each member using existing generators
  members.forEach(loopId => {
    const meta = notesMatrix.loopMetadata[loopId]
    if (!meta) return
    if (!meta.voicesEnabled && !options.force) return

    // Strategy: choose the generator based on metadata or passed option
    const generator = options.generator || meta.voiceGenerator || DEFAULT_VOICE_GENERATOR
    // Generator selection: if 'auto' call normal generateLoopNotes which will choose
    if (generator === 'auto' || generator === DEFAULT_VOICE_GENERATOR) {
      notesMatrix.generateLoopNotes(loopId, { silent: true })
    } else if (generator === 'euclidean') {
      const pattern = generateEuclideanPattern(loopId, options)
      notesMatrix.setLoopNotes(loopId, pattern)
    } else if (generator === 'scale') {
      const pattern = generateScalePattern(loopId, options)
      notesMatrix.setLoopNotes(loopId, pattern)
    } else if (generator === 'random') {
      const pattern = generateRandomPattern(loopId, options)
      notesMatrix.setLoopNotes(loopId, pattern)
    } else {
      // fallback to generateLoopNotes
      notesMatrix.generateLoopNotes(loopId, { silent: true })
    }
  })

  // Restore metadata if needed
  members.forEach(loopId => {
    if (!backup[loopId]) return
    const meta = notesMatrix.loopMetadata[loopId]
    // Only restore baseNote if we changed it (and the meta still has a value)
    notesMatrix.updateLoopMetadata(loopId, { baseNote: backup[loopId].baseNote, generationMode: backup[loopId].generationMode })
  })

  return true
}

export default { generateVoicedGroupPattern }
