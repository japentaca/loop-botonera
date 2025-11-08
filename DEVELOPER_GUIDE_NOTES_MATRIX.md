# Central Notes Matrix - Developer Guide

## Quick Reference: How Notes Flow

### Where Each Type of Note Operation Stores Results

| Operation | Use This Method | Location |
|-----------|----------------|----------|
| Create new loop notes | `notesMatrix.generateLoopNotes(loopId)` | `useNotesMatrix.js` |
| Set/update specific note | `notesMatrix.setNote(loopId, stepIndex, note)` | `useNotesMatrix.js` |
| Set all notes for loop | `notesMatrix.setLoopNotes(loopId, notesArray)` | `useNotesMatrix.js` |
| Get notes from loop | `notesMatrix.getLoopNotes(loopId)` | `useNotesMatrix.js` |
| Get single note | `notesMatrix.getNote(loopId, stepIndex)` | `useNotesMatrix.js` |
| Quantize to scale | `notesMatrix.quantizeLoop(loopId)` | `useNotesMatrix.js` |
| Apply evolution | `notesMatrix.setLoopNotes(loopId, evolvedNotes)` | After calling `evolveNotes()` |
| Generate response | First generate, then `notesMatrix.setLoopNotes()` | From `generateResponseFromCall()` result |
| Play note | `notesMatrix.getNote(loopId, step)` → `playNote()` | During transport callback |

## Key Principles

### ✅ DO
- **Always** use `notesMatrix` methods for any note operation
- **Always** read from the matrix before playing notes
- **Always** sync evolutionary changes back to the matrix
- Pass `notesMatrix` to any module that creates/modifies notes

### ❌ DON'T
- Store notes in `loop.notes` directly
- Assume loop objects maintain their own note state
- Create notes and forget to sync with the matrix
- Read notes from places other than `notesMatrix`

## Integration Checklist for New Features

When adding a feature that creates, modifies, or plays notes:

1. ☐ Ensure the module receives `notesMatrix` as a parameter
2. ☐ Call `notesMatrix.getLoopNotes()` or `getNote()` to read notes
3. ☐ Call `notesMatrix.setLoopNotes()` or `setNote()` after any modification
4. ☐ Never store notes in loop objects or elsewhere
5. ☐ Test that changes are reflected during playback
6. ☐ Update this guide if new patterns emerge

## Code Examples

### Example 1: Creating Notes for a New Loop
```javascript
import { useNotesMatrix } from '@/composables/useNotesMatrix'

export const useMyFeature = (notesMatrix) => {
  const generateSpecialNotes = (loopId) => {
    // Generate some notes
    const notes = [...generateSomeNotes()]
    
    // Store in central matrix
    notesMatrix.setLoopNotes(loopId, notes)
    
    // Return for any immediate use
    return notes
  }
}
```

### Example 2: Modifying Notes Based on User Input
```javascript
const modifyLoopNotes = (loopId, transformation) => {
  // Get current notes
  const currentNotes = notesMatrix.getLoopNotes(loopId)
  
  // Apply transformation
  const modified = currentNotes.map(transformation)
  
  // Store back
  notesMatrix.setLoopNotes(loopId, modified)
}
```

### Example 3: Playing Notes (Already Correct)
```javascript
const playLoopNote = (loop, audioEngine, step, time) => {
  // Read from matrix
  const midiNote = notesMatrix.getNote(loop.id, step)
  
  // Play if note exists
  if (midiNote !== null) {
    audioEngine.playNote(audioChain, midiNote, duration, volume, time)
  }
}
```

## Evolution System Architecture

The evolution system now properly integrates with the central matrix:

```
evolutionSystem(notesMatrix) ← Receives matrix reference
    ↓
evolveLoop(loop) ← Called for each loop to evolve
    ↓
getCurrentNotes = notesMatrix.getLoopNotes(loop.id) ← Read from matrix
    ↓
modifiedNotes = evolveNotes(currentNotes, scale) ← Compute evolution
    ↓
notesMatrix.setLoopNotes(loop.id, modifiedNotes) ← Write back to matrix
    ↓
playLoopNote() reads from matrix during next transport tick
```

## Call & Response Architecture

The call & response system stores generated responses in the central matrix:

```
applyCallResponse(loopsToReharmonize)
    ↓
caller = Select caller loop from active loops
    ↓
responseNotes = generateResponseFromCall(caller, responder, scale, baseNote)
    ↓
notesMatrix.setLoopNotes(responder.id, responseNotes) ← IMPORTANT: Store in matrix
    ↓
On next transport tick, playLoopNote() reads response from matrix
```

## Related Files

- **Central Storage**: `src/composables/useNotesMatrix.js`
- **Evolution System**: `src/stores/modules/evolutionSystem.js` (passes notesMatrix)
- **Audio Store**: `src/stores/audioStore.js` (initializes with notesMatrix)
- **Loop Manager**: `src/stores/modules/loopManager.js` (uses notesMatrix for creation/playback)
- **Audio Engine**: `src/stores/modules/audioEngine.js` (plays notes, not responsible for storage)

## Troubleshooting

### Problem: Notes don't change after evolution
→ Verify `notesMatrix.setLoopNotes()` is called after `evolveNotes()`
→ Check evolutionSystem was initialized with notesMatrix

### Problem: Call & Response doesn't generate new notes
→ Verify `applyCallResponse()` calls `notesMatrix.setLoopNotes()`
→ Check responder ID is valid

### Problem: Old notes still playing
→ Check that `playLoopNote()` reads from matrix: `notesMatrix.getNote()`
→ Verify matrix was actually updated with new notes

### Problem: New feature doesn't integrate notes correctly
→ Follow the Integration Checklist above
→ Add logging: `console.log('Matrix notes:', notesMatrix.getLoopNotes(loopId))`
